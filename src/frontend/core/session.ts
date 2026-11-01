import {
  computed,
  onUnmounted,
  provide,
  reactive,
  readonly,
  ref,
  watch,
  type InjectionKey,
} from "vue";
import { useGazePointer } from "../composables/useGazePointer";
import { createGazeMetricsTracker } from "./gaze";
import { isSoundDeclined } from "./audioUnlock";
import {
  continuesAfterFinish,
  isTimeEndedGame,
  useGameEndMode,
  type GameEndMode,
} from "./gameEndMode";
import {
  createGameSessionSummary,
  projectSessionEvent,
  type SessionTelemetryContext,
} from "./sessionTelemetry";
import type { SessionSettings } from "./settings";
import { createDefaultSettings, recommendNextSettings } from "./settings";
import { recordMetricsEvent, recordMetricsSummary } from "./telemetry";

export type SessionStatus = "idle" | "running" | "paused" | "finished";

export type SessionFinishReason =
  | "max-steps"
  | "timeout"
  | "too-many-mistakes"
  | "manual"
  | "game-complete"
  | "game-lost"
  | "game-draw";
export type SessionInterruptionReason =
  "route-leave" | "window-close" | "app-quit" | "update-restart" | "renderer-crash";

export type SessionEventType =
  | "session-start"
  | "session-pause"
  | "session-resume"
  | "session-finish"
  | "session-interrupt"
  | "level-start"
  | "target-enter"
  | "target-cancel"
  | "target-click"
  | "success"
  | "mistake"
  | "hint"
  | "gaze-lost"
  | "gaze-restored"
  | "difficulty-change";

export type SessionEvent = {
  id: string;
  sessionId: string;
  gameId: string;
  type: SessionEventType;
  at: number;
  payload?: Record<string, unknown>;
};

export type GameSessionState = {
  sessionId: string;
  gameId: string;
  startedAt: number;
  finishedAt?: number;
  pausedAt?: number;
  pausedMs: number;
  finishReason?: SessionFinishReason;
  interruptionReason?: SessionInterruptionReason;
  status: SessionStatus;
  step: number;
  maxSteps: number;
  score: number;
  mistakes: number;
  hintsUsed: number;
  settings: SessionSettings;
  events: SessionEvent[];
};

export type GameSessionTelemetry = {
  recordEvent: (type: SessionEventType, payload?: Record<string, unknown>) => void;
};

export const gameSessionTelemetryKey: InjectionKey<GameSessionTelemetry> =
  Symbol("game-session-telemetry");

// A run spans the rounds of one sitting: in the endless and timed modes a finished
// session restarts by itself, and the totals carry over to the next one.
export type GameSessionRun = {
  mode: GameEndMode;
  timeLimitMs: number;
  successesBefore: number;
  mistakesBefore: number;
  activeMsBefore: number;
};

export type GameSessionRunContext = {
  run: Readonly<GameSessionRun>;
  hasSessionTimer: () => boolean;
  willContinue: () => boolean;
  timeRanOut: () => boolean;
  // Games with a setup screen keep their instance, so that it is not asked again each round.
  keepsInstanceBetweenRounds: boolean;
  continueRun: () => void;
};

export const gameSessionRunKey: InjectionKey<GameSessionRunContext> = Symbol("game-session-run");

const MIN_CONTINUING_SESSION_MS = 1000;

// Handed from a finished session to the next one, which may be a new mount of the game.
let carriedRun: (GameSessionRun & { gameId: string }) | undefined;

function takeCarriedRun(gameId: string) {
  const carried = carriedRun?.gameId === gameId ? carriedRun : undefined;
  carriedRun = undefined;
  return carried;
}

const activeSessionStatusState = ref<SessionStatus>("idle");
const activeSessionEpochState = ref(0);
let activeSessionOwner: symbol | undefined;

export const activeGameSessionStatus = readonly(activeSessionStatusState);
export const activeGameSessionEpoch = readonly(activeSessionEpochState);

export function useGameSession(
  gameId: string,
  initialSettings: Partial<SessionSettings> = {},
  options: {
    autoStart?: boolean;
    finishOnMaxSteps?: boolean;
    finishOnMistakes?: boolean;
    finishOnTimeout?: boolean;
    telemetryContext?: SessionTelemetryContext;
  } = {},
) {
  const sessionOwner = Symbol(gameId);
  const settings = createDefaultSettings(
    isSoundDeclined() ? { ...initialSettings, sound: false } : initialSettings,
  );
  const { pointer } = useGazePointer();
  const gazeTracker = createGazeMetricsTracker();
  const telemetryContext = options.telemetryContext ?? { targetKind: "interactive" };
  const reportedSummaries = new Set<string>();
  const { gameEndMode, gameTimeLimitMinutes } = useGameEndMode();
  const run = reactive<GameSessionRun>({
    mode: gameEndMode.value,
    timeLimitMs: gameTimeLimitMinutes.value * 60_000,
    successesBefore: 0,
    mistakesBefore: 0,
    activeMsBefore: 0,
  });
  let autoPausedByVisibility = false;
  const session = reactive<GameSessionState>({
    sessionId: crypto.randomUUID(),
    gameId,
    startedAt: 0,
    pausedMs: 0,
    status: "idle",
    step: 0,
    maxSteps: settings.maxSteps,
    score: 0,
    mistakes: 0,
    hintsUsed: 0,
    settings,
    events: [],
  });
  const nowMs = ref(Date.now());
  const maxMistakesBeforeFinish = Math.max(6, settings.maxSteps * 3);
  const timer = window.setInterval(() => {
    nowMs.value = Date.now();
    if (session.status === "running" && hasTimedOut(nowMs.value)) finishSession("timeout");
  }, 250);

  function hasSessionTimer() {
    if (run.mode === "timed") return true;
    return run.mode === "successes" && options.finishOnTimeout !== false && isTimeEndedGame(gameId);
  }

  function hasTimedOut(at: number) {
    if (!hasSessionTimer()) return false;
    if (run.mode === "timed") return run.activeMsBefore + activeDurationMs(at) >= run.timeLimitMs;
    return activeDurationMs(at) >= session.settings.sessionSeconds * 1000;
  }

  function activeDurationMs(at = Date.now()) {
    if (!session.startedAt) return 0;
    const currentPausedMs =
      session.status === "paused" && session.pausedAt ? at - session.pausedAt : 0;
    return Math.max(0, at - session.startedAt - session.pausedMs - currentPausedMs);
  }

  const durationMs = computed(() => {
    if (session.status === "finished" && session.finishedAt)
      return activeDurationMs(session.finishedAt);
    return activeDurationMs(nowMs.value);
  });

  const metrics = computed(() => {
    const gaze = gazeTracker.snapshot();
    const targetCancels = session.events.filter(
      (event) => event.type === "target-cancel" && event.payload?.reason !== "disabled",
    ).length;
    const dwellEvents = session.events.filter(
      (event) => event.type === "target-click" && pointerSource(event.payload) === "tobii",
    );
    const dwellMs = dwellEvents
      .map((event) => Number(event.payload?.elapsedMs ?? event.payload?.dwellMs))
      .filter((value) => Number.isFinite(value));
    const meanDwellMs = dwellMs.length
      ? dwellMs.reduce((sum, value) => sum + value, 0) / dwellMs.length
      : undefined;

    return {
      sessionId: session.sessionId,
      gameId,
      durationMs: durationMs.value,
      pausedMs: session.pausedMs,
      finishReason: session.finishReason,
      stepsCompleted: session.step,
      maxSteps: session.maxSteps,
      successes: session.score,
      mistakes: session.mistakes,
      hintsUsed: session.hintsUsed,
      validGazeRatio: gaze.validGazeRatio,
      totalGazeSamples: gaze.totalGazeSamples,
      mouseSampleCount: gaze.mouseSampleCount,
      validGazeSamples: gaze.validGazeSamples,
      invalidGazeSamples: gaze.invalidGazeSamples,
      rawPathLength: gaze.rawPathLength,
      meanSampleIntervalMs: gaze.meanSampleIntervalMs,
      meanDwellMs,
      targetCancels,
      gazeLostCount: gaze.lostGazeEvents,
      gazeRestoredCount: gaze.restoredGazeEvents,
      difficultyChanges: session.events.filter((event) => event.type === "difficulty-change")
        .length,
    };
  });

  const recommendation = computed(() => recommendNextSettings(metrics.value));

  function recordEvent(type: SessionEventType, payload?: Record<string, unknown>) {
    if (session.status === "idle") return;
    const event: SessionEvent = {
      id: `${type}-${session.events.length}-${Date.now()}`,
      sessionId: session.sessionId,
      gameId,
      type,
      at: Date.now(),
      payload,
    };
    session.events.push(event);
    const projected = projectSessionEvent(
      event,
      telemetryContext,
      pointer.value.source,
      session.step,
    );
    if (projected) recordMetricsEvent(projected);
  }

  function startSession() {
    if (session.status === "running" || session.status === "paused") finishSession("manual");
    const carried = takeCarriedRun(gameId);
    run.mode = carried?.mode ?? gameEndMode.value;
    run.timeLimitMs = carried?.timeLimitMs ?? gameTimeLimitMinutes.value * 60_000;
    run.successesBefore = carried?.successesBefore ?? 0;
    run.mistakesBefore = carried?.mistakesBefore ?? 0;
    run.activeMsBefore = carried?.activeMsBefore ?? 0;
    activeSessionOwner = sessionOwner;
    activeSessionEpochState.value += 1;
    session.sessionId = crypto.randomUUID();
    session.startedAt = Date.now();
    session.finishedAt = undefined;
    session.pausedAt = undefined;
    session.pausedMs = 0;
    session.finishReason = undefined;
    session.interruptionReason = undefined;
    session.status = "running";
    activeSessionStatusState.value = "running";
    session.step = 0;
    session.score = 0;
    session.mistakes = 0;
    session.hintsUsed = 0;
    session.events = [];
    gazeTracker.reset();
    recordEvent("session-start");
    if (document.hidden) {
      autoPausedByVisibility = true;
      pauseSession();
    }
  }

  function pauseSession() {
    if (session.status !== "running") return;
    session.pausedAt = Date.now();
    session.status = "paused";
    if (activeSessionOwner === sessionOwner) activeSessionStatusState.value = "paused";
    recordEvent("session-pause");
  }

  function resumeSession() {
    if (session.status !== "paused") return;
    const now = Date.now();
    if (session.pausedAt) session.pausedMs += now - session.pausedAt;
    session.pausedAt = undefined;
    session.status = "running";
    if (activeSessionOwner === sessionOwner) activeSessionStatusState.value = "running";
    recordEvent("session-resume");
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      if (session.status === "running") {
        autoPausedByVisibility = true;
        pauseSession();
      }
      return;
    }
    if (autoPausedByVisibility && session.status === "paused") {
      autoPausedByVisibility = false;
      resumeSession();
    }
  }

  function finishSession(reason: SessionFinishReason = "manual") {
    if (session.status === "finished") return;
    const now = Date.now();
    if (session.status === "paused" && session.pausedAt) {
      session.pausedMs += now - session.pausedAt;
      session.pausedAt = undefined;
    }
    session.status = "finished";
    if (activeSessionOwner === sessionOwner) activeSessionStatusState.value = "finished";
    session.finishedAt = now;
    session.finishReason = reason;
    recordEvent("session-finish", {
      reason,
      durationMs: activeDurationMs(now),
      pausedMs: session.pausedMs,
    });
    emitSessionSummary();
  }

  function interruptSession(reason: SessionInterruptionReason = "route-leave") {
    if (session.status === "finished") return;
    const now = Date.now();
    if (session.status === "paused" && session.pausedAt) {
      session.pausedMs += now - session.pausedAt;
      session.pausedAt = undefined;
    }
    session.status = "finished";
    if (activeSessionOwner === sessionOwner) activeSessionStatusState.value = "finished";
    session.finishedAt = now;
    session.interruptionReason = reason;
    recordEvent("session-interrupt", { reason });
    emitSessionSummary();
  }

  function recordSuccess(payload: Record<string, unknown> = {}) {
    if (session.status !== "running") return;
    session.step += 1;
    session.score += 1;
    recordEvent("success", { step: session.step, ...payload });
    if (options.finishOnMaxSteps !== false && session.step >= session.maxSteps)
      finishSession("max-steps");
  }

  function recordMistake(payload: Record<string, unknown> = {}) {
    if (session.status !== "running") return;
    session.mistakes += 1;
    recordEvent("mistake", { step: session.step, ...payload });
    if (
      run.mode === "successes" &&
      options.finishOnMistakes !== false &&
      session.mistakes >= maxMistakesBeforeFinish
    )
      finishSession("too-many-mistakes");
  }

  function recordHint(payload: Record<string, unknown> = {}) {
    if (session.status !== "running") return;
    session.hintsUsed += 1;
    recordEvent("hint", payload);
  }

  function emitSessionSummary() {
    if (!session.startedAt || !session.finishedAt || reportedSummaries.has(session.sessionId))
      return;
    reportedSummaries.add(session.sessionId);
    const snapshot = metrics.value;
    recordMetricsSummary(
      createGameSessionSummary({
        sessionId: session.sessionId,
        gameId,
        startedAt: session.startedAt,
        endedAt: session.finishedAt,
        durationMs: snapshot.durationMs,
        pausedMs: snapshot.pausedMs,
        mode: telemetryContext.mode,
        category: telemetryContext.category,
        finishReason: session.finishReason,
        interruptionReason: session.interruptionReason,
        stepsCompleted: snapshot.stepsCompleted,
        maxSteps: snapshot.maxSteps,
        successCount: snapshot.successes,
        mistakeCount: snapshot.mistakes,
        hintCount: snapshot.hintsUsed,
        targetCancelCount: snapshot.targetCancels,
        gazeLostCount: snapshot.gazeLostCount,
        difficultyChanges: snapshot.difficultyChanges,
        gazeSampleCount: snapshot.totalGazeSamples,
        mouseSampleCount: snapshot.mouseSampleCount,
        validGazeRatio: snapshot.validGazeRatio,
        meanDwellMs: snapshot.meanDwellMs,
        configuredDwellMs: session.settings.dwellMs,
      }),
    );
  }

  if (options.autoStart !== false) startSession();
  document.addEventListener("visibilitychange", handleVisibilityChange);

  watch(
    pointer,
    (nextPointer) => {
      if (session.status !== "running") return;
      const transition = gazeTracker.record(nextPointer);
      if (transition === "lost") recordEvent("gaze-lost", { source: nextPointer.source });
      if (transition === "restored") recordEvent("gaze-restored", { source: nextPointer.source });
    },
    { deep: true },
  );

  provide(gameSessionTelemetryKey, { recordEvent });
  provide(gameSessionRunKey, {
    run,
    hasSessionTimer,
    willContinue: () =>
      session.status === "finished" &&
      continuesAfterFinish(run.mode, session.finishReason) &&
      activeDurationMs(session.finishedAt) >= MIN_CONTINUING_SESSION_MS,
    timeRanOut: () =>
      session.status === "finished" && run.mode === "timed" && session.finishReason === "timeout",
    keepsInstanceBetweenRounds: options.autoStart === false,
    continueRun: () => {
      carriedRun = {
        gameId,
        mode: run.mode,
        timeLimitMs: run.timeLimitMs,
        successesBefore: run.successesBefore + session.score,
        mistakesBefore: run.mistakesBefore + session.mistakes,
        activeMsBefore: run.activeMsBefore + activeDurationMs(session.finishedAt),
      };
    },
  });

  onUnmounted(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (session.status === "running" || session.status === "paused")
      interruptSession("route-leave");
    window.clearInterval(timer);
    if (activeSessionOwner === sessionOwner) {
      activeSessionOwner = undefined;
      activeSessionStatusState.value = "idle";
      activeSessionEpochState.value += 1;
    }
  });

  return {
    session,
    durationMs,
    metrics,
    recommendation,
    recordEvent,
    startSession,
    pauseSession,
    resumeSession,
    finishSession,
    interruptSession,
    recordSuccess,
    recordMistake,
    recordHint,
  };
}

function pointerSource(payload?: Record<string, unknown>) {
  const pointer = payload?.pointer;
  if (!pointer || typeof pointer !== "object") return undefined;
  const source = (pointer as { source?: unknown }).source;
  return source === "tobii" || source === "mouse" ? source : undefined;
}
