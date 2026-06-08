import { computed, onUnmounted, reactive, ref } from "vue";
import type { SessionSettings } from "./settings";
import { createDefaultSettings, recommendNextSettings } from "./settings";

export type SessionStatus = "idle" | "running" | "paused" | "finished";

export type SessionEventType =
  | "session-start"
  | "session-pause"
  | "session-resume"
  | "session-finish"
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
  status: SessionStatus;
  step: number;
  maxSteps: number;
  score: number;
  mistakes: number;
  hintsUsed: number;
  settings: SessionSettings;
  events: SessionEvent[];
};

export function useGameSession(gameId: string, initialSettings: Partial<SessionSettings> = {}) {
  const settings = createDefaultSettings(initialSettings);
  const session = reactive<GameSessionState>({
    sessionId: `${gameId}-${Date.now()}`,
    gameId,
    startedAt: 0,
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
    if (session.status === "running" && session.startedAt && nowMs.value - session.startedAt >= session.settings.sessionSeconds * 1000) {
      finishSession();
    }
  }, 250);

  const durationMs = computed(() => {
    if (!session.startedAt) return 0;
    return (session.finishedAt ?? nowMs.value) - session.startedAt;
  });

  const metrics = computed(() => {
    const targetCancels = session.events.filter((event) => event.type === "target-cancel").length;
    const gazeLostCount = session.events.filter((event) => event.type === "gaze-lost").length;
    const dwellEvents = session.events.filter((event) => event.type === "target-click");
    const dwellMs = dwellEvents
      .map((event) => Number(event.payload?.dwellMs))
      .filter((value) => Number.isFinite(value));
    const meanDwellMs = dwellMs.length ? dwellMs.reduce((sum, value) => sum + value, 0) / dwellMs.length : undefined;

    return {
      sessionId: session.sessionId,
      gameId,
      durationMs: durationMs.value,
      stepsCompleted: session.step,
      maxSteps: session.maxSteps,
      successes: session.score,
      mistakes: session.mistakes,
      hintsUsed: session.hintsUsed,
      validGazeRatio: 1,
      meanDwellMs,
      targetCancels,
      gazeLostCount,
      difficultyChanges: session.events.filter((event) => event.type === "difficulty-change").length
    };
  });

  const recommendation = computed(() => recommendNextSettings(metrics.value));

  function recordEvent(type: SessionEventType, payload?: Record<string, unknown>) {
    session.events.push({
      id: `${type}-${session.events.length}-${Date.now()}`,
      sessionId: session.sessionId,
      gameId,
      type,
      at: Date.now(),
      payload
    });
  }

  function startSession() {
    session.startedAt = Date.now();
    session.finishedAt = undefined;
    session.status = "running";
    session.step = 0;
    session.score = 0;
    session.mistakes = 0;
    session.hintsUsed = 0;
    session.events = [];
    recordEvent("session-start");
  }

  function pauseSession() {
    if (session.status !== "running") return;
    session.status = "paused";
    recordEvent("session-pause");
  }

  function resumeSession() {
    if (session.status !== "paused") return;
    session.status = "running";
    recordEvent("session-resume");
  }

  function finishSession() {
    if (session.status === "finished") return;
    session.status = "finished";
    session.finishedAt = Date.now();
    recordEvent("session-finish");
  }

  function recordSuccess(payload: Record<string, unknown> = {}) {
    if (session.status !== "running") return;
    session.step += 1;
    session.score += 1;
    recordEvent("success", { step: session.step, ...payload });
    if (session.step >= session.maxSteps) finishSession();
  }

  function recordMistake(payload: Record<string, unknown> = {}) {
    if (session.status !== "running") return;
    session.mistakes += 1;
    recordEvent("mistake", { step: session.step, ...payload });
    if (session.mistakes >= maxMistakesBeforeFinish) finishSession();
  }

  function recordHint(payload: Record<string, unknown> = {}) {
    session.hintsUsed += 1;
    recordEvent("hint", payload);
  }

  startSession();

  onUnmounted(() => {
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
    recordSuccess,
    recordMistake,
    recordHint
  };
}
