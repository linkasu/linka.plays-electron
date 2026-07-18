import { computed, onUnmounted, provide, reactive, ref, watch, type InjectionKey } from "vue";
import { useGazePointer } from "../composables/useGazePointer";
import { createGazeMetricsTracker } from "./gaze";
import { createGameSessionSummary, projectSessionEvent, type SessionTelemetryContext } from "./sessionTelemetry";
import type { SessionSettings } from "./settings";
import { createDefaultSettings, recommendNextSettings } from "./settings";
import { recordMetricsEvent, recordMetricsSummary } from "./telemetry";

export type SessionStatus = "idle" | "running" | "paused" | "finished";

export type SessionFinishReason = "max-steps" | "timeout" | "too-many-mistakes" | "manual" | "game-complete" | "game-lost" | "game-draw";
export type SessionInterruptionReason = "route-leave" | "window-close" | "app-quit" | "update-restart" | "renderer-crash";

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

export const gameSessionTelemetryKey: InjectionKey<GameSessionTelemetry> = Symbol("game-session-telemetry");

export function useGameSession(gameId: string, initialSettings: Partial<SessionSettings> = {}, options: { finishOnMaxSteps?: boolean; finishOnMistakes?: boolean; finishOnTimeout?: boolean; telemetryContext?: SessionTelemetryContext } = {}) {
  const settings = createDefaultSettings(initialSettings);
  const { pointer } = useGazePointer();
  const gazeTracker = createGazeMetricsTracker();
  const telemetryContext = options.telemetryContext ?? { targetKind: "interactive" };
  const reportedSummaries = new Set<string>();
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
    events: []
  });
  const nowMs = ref(Date.now());
  const maxMistakesBeforeFinish = Math.max(6, settings.maxSteps * 3);
  const timer = window.setInterval(() => {
    nowMs.value = Date.now();
    if (options.finishOnTimeout !== false && session.status === "running" && activeDurationMs(nowMs.value) >= session.settings.sessionSeconds * 1000) {
      finishSession("timeout");
    }
  }, 250);

  function activeDurationMs(at = Date.now()) {
    if (!session.startedAt) return 0;
    const currentPausedMs = session.status === "paused" && session.pausedAt ? at - session.pausedAt : 0;
    return Math.max(0, at - session.startedAt - session.pausedMs - currentPausedMs);
  }

  const durationMs = computed(() => {
    if (session.status === "finished" && session.finishedAt) return activeDurationMs(session.finishedAt);
    return activeDurationMs(nowMs.value);
  });

  const metrics = computed(() => {
    const gaze = gazeTracker.snapshot();
    const targetCancels = session.events.filter((event) => event.type === "target-cancel" && event.payload?.reason !== "disabled").length;
    const dwellEvents = session.events.filter((event) => event.type === "target-click" && pointerSource(event.payload) === "tobii");
    const dwellMs = dwellEvents
     .map((event) => Number(event.payload?.elapsedMs ?? event.payload?.dwellMs))
     .filter((value) => Number.isFinite(value));
    const meanDwellMs = dwellMs.length ? dwellMs.reduce((sum, value) => sum + value, 0) / dwellMs.length : undefined;

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
      difficultyChanges: session.events.filter((event) => event.type === "difficulty-change").length
    };
  });

  const recommendation = computed(() => recommendNextSettings(metrics.value));

  function recordEvent(type: SessionEventType, payload?: Record<string, unknown>) {
    const event: SessionEvent = {
      id: `${type}-${session.events.length}-${Date.now()}`,
      sessionId: session.sessionId,
      gameId,
      type,
      at: Date.now(),
      payload
    };
    session.events.push(event);
    const projected = projectSessionEvent(event, telemetryContext, pointer.value.source, session.step);
    if (projected) recordMetricsEvent(projected);
  }

  function startSession() {
    if (session.status === "running" || session.status === "paused") finishSession("manual");
    session.sessionId = crypto.randomUUID();
    session.startedAt = Date.now();
    session.finishedAt = undefined;
    session.pausedAt = undefined;
    session.pausedMs = 0;
    session.finishReason = undefined;
    session.interruptionReason = undefined;
    session.status = "running";
    session.step = 0;
    session.score = 0;
    session.mistakes = 0;
    session.hintsUsed = 0;
    session.events = [];
    gazeTracker.reset();
    recordEvent("session-start");
  }

  function pauseSession() {
    if (session.status !== "running") return;
    session.pausedAt = Date.now();
    session.status = "paused";
    recordEvent("session-pause");
  }

  function resumeSession() {
    if (session.status !== "paused") return;
    const now = Date.now();
    if (session.pausedAt) session.pausedMs += now - session.pausedAt;
    session.pausedAt = undefined;
    session.status = "running";
    recordEvent("session-resume");
  }

  function finishSession(reason: SessionFinishReason = "manual") {
    if (session.status === "finished") return;
    const now = Date.now();
    if (session.status === "paused" && session.pausedAt) {
      session.pausedMs += now - session.pausedAt;
      session.pausedAt = undefined;
    }
    session.status = "finished";
    session.finishedAt = now;
    session.finishReason = reason;
    recordEvent("session-finish", { reason, durationMs: activeDurationMs(now), pausedMs: session.pausedMs });
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
    if (options.finishOnMaxSteps !== false && session.step >= session.maxSteps) finishSession("max-steps");
  }

  function recordMistake(payload: Record<string, unknown> = {}) {
    if (session.status !== "running") return;
    session.mistakes += 1;
    recordEvent("mistake", { step: session.step, ...payload });
    if (options.finishOnMistakes !== false && session.mistakes >= maxMistakesBeforeFinish) finishSession("too-many-mistakes");
  }

  function recordHint(payload: Record<string, unknown> = {}) {
    session.hintsUsed += 1;
    recordEvent("hint", payload);
  }

  function emitSessionSummary() {
    if (!session.startedAt || !session.finishedAt || reportedSummaries.has(session.sessionId)) return;
    reportedSummaries.add(session.sessionId);
    const snapshot = metrics.value;
    recordMetricsSummary(createGameSessionSummary({
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
      configuredDwellMs: session.settings.dwellMs
    }));
  }

  startSession();

  watch(pointer, (nextPointer) => {
    if (session.status !== "running") return;
    const transition = gazeTracker.record(nextPointer);
    if (transition === "lost") recordEvent("gaze-lost", { source: nextPointer.source });
    if (transition === "restored") recordEvent("gaze-restored", { source: nextPointer.source });
  }, { deep: true });

  provide(gameSessionTelemetryKey, { recordEvent });

  onUnmounted(() => {
    if (session.status === "running" || session.status === "paused") interruptSession("route-leave");
    window.clearInterval(timer);
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
    recordHint
  };
}

function pointerSource(payload?: Record<string, unknown>) {
  const pointer = payload?.pointer;
  if (!pointer || typeof pointer !== "object") return undefined;
  const source = (pointer as { source?: unknown }).source;
  return source === "tobii" || source === "mouse" ? source : undefined;
}
