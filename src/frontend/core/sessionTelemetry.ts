import type { SessionEvent, SessionFinishReason, SessionInterruptionReason } from "./session";

export type SessionTelemetryContext = {
  mode?: "specialist" | "self";
  category?: MetricsGameCategory;
  targetKind: "interactive" | "control";
};

export function projectSessionEvent(event: SessionEvent, context: SessionTelemetryContext, fallbackSource: GazePoint["source"], currentLevelIndex = 0): MetricsEvent | undefined {
  const common = { gameId: event.gameId };
  const gameSessionId = event.sessionId;
  const levelIndex = safeInteger(event.payload?.levelIndex ?? event.payload?.step ?? currentLevelIndex, 0, 0xffffffff) ?? 0;
  const inputMethod = normalizeInputMethod(pointerSource(event.payload) ?? fallbackSource);

  switch (event.type) {
    case "session-start":
      return { eventName: "game_session_started", gameSessionId, properties: { ...common, mode: context.mode, gameCategory: context.category } };
    case "session-pause":
      return { eventName: "game_session_paused", gameSessionId, properties: { ...common, mode: context.mode, gameCategory: context.category } };
    case "session-resume":
      return { eventName: "game_session_resumed", gameSessionId, properties: { ...common, mode: context.mode, gameCategory: context.category } };
    case "session-finish": {
      const reason = event.payload?.reason as SessionFinishReason;
      return { eventName: "game_session_finished", gameSessionId, properties: { ...common, reason, result: finishResult(reason) } };
    }
    case "session-interrupt":
      return { eventName: "game_session_interrupted", gameSessionId, properties: { ...common, reason: event.payload?.reason as SessionInterruptionReason } };
    case "level-start":
      return { eventName: "level_entered", gameSessionId, properties: { ...common, levelIndex } };
    case "target-enter":
    case "target-cancel":
    case "target-click": {
      const names = { "target-enter": "target_entered", "target-cancel": "target_cancelled", "target-click": "target_clicked" } as const;
      const elapsedMs = safeInteger(event.payload?.elapsedMs ?? event.payload?.dwellMs, 0, 60000);
      const reason = oneOf(event.payload?.reason, "left", "invalid-gaze", "disabled");
      return { eventName: names[event.type], gameSessionId, properties: { ...common, levelIndex, targetKind: context.targetKind, inputMethod, elapsedMs, reason } };
    }
    case "success":
    case "mistake": {
      const responseMs = safeInteger(event.payload?.responseMs, 0, 86400000);
      return { eventName: event.type, gameSessionId, properties: { ...common, levelIndex, targetKind: context.targetKind, inputMethod, responseMs } };
    }
    case "hint":
      return { eventName: "hint_used", gameSessionId, properties: { ...common, levelIndex, hintKind: "generic" } };
    case "difficulty-change": {
      const difficulty = safeInteger(event.payload?.difficulty, 1, 10);
      return difficulty ? { eventName: "difficulty_changed", gameSessionId, properties: { ...common, difficulty } } : undefined;
    }
    case "gaze-lost":
    case "gaze-restored":
      return undefined;
  }
}

export function createGameSessionSummary(input: {
  sessionId: string;
  gameId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  pausedMs: number;
  mode?: "specialist" | "self";
  category?: MetricsGameCategory;
  finishReason?: SessionFinishReason;
  interruptionReason?: SessionInterruptionReason;
  stepsCompleted: number;
  maxSteps: number;
  successCount: number;
  mistakeCount: number;
  hintCount: number;
  targetCancelCount: number;
  gazeLostCount: number;
  difficultyChanges: number;
  gazeSampleCount: number;
  mouseSampleCount: number;
  validGazeRatio?: number;
  meanDwellMs?: number;
  configuredDwellMs: number;
}): MetricsSessionSummary {
  const endedAt = Math.max(input.startedAt, input.endedAt);
  const inputMethod = input.gazeSampleCount > 0 && input.mouseSampleCount > 0
    ? "mixed"
    : input.gazeSampleCount > 0 ? "gaze" : input.mouseSampleCount > 0 ? "mouse" : undefined;
  return {
    gameSessionId: input.sessionId,
    gameId: input.gameId,
    startedAt: new Date(input.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationMs: Math.min(604800000, Math.max(0, Math.round(input.durationMs))),
    pausedMs: Math.max(0, Math.round(input.pausedMs)),
    menuMode: input.mode,
    gameCategory: input.category,
    inputMethod,
    finishReason: input.finishReason,
    stepsCompleted: input.stepsCompleted,
    maxSteps: input.maxSteps,
    successCount: input.successCount,
    mistakeCount: input.mistakeCount,
    hintCount: input.hintCount,
    targetCancelCount: input.targetCancelCount,
    gazeLostCount: input.gazeLostCount,
    difficultyChanges: input.difficultyChanges,
    gazeSampleCount: input.gazeSampleCount,
    mouseSampleCount: input.mouseSampleCount,
    validGazeRatio: input.gazeSampleCount > 0 ? input.validGazeRatio : undefined,
    meanDwellMs: input.meanDwellMs,
    configuredDwellMs: input.configuredDwellMs,
    result: input.interruptionReason ? "interrupted" : finishResult(input.finishReason),
    interruptionReason: input.interruptionReason
  };
}

export function finishResult(reason?: SessionFinishReason): "completed" | "incomplete" | "lost" | "draw" {
  if (reason === "game-lost") return "lost";
  if (reason === "game-draw") return "draw";
  if (reason === "timeout" || reason === "too-many-mistakes") return "incomplete";
  return "completed";
}

function pointerSource(payload?: Record<string, unknown>) {
  const pointer = payload?.pointer;
  if (!pointer || typeof pointer !== "object") return undefined;
  const source = (pointer as { source?: unknown }).source;
  return source === "tobii" || source === "mouse" ? source : undefined;
}

function normalizeInputMethod(source: GazePoint["source"]): "gaze" | "mouse" {
  return source === "tobii" ? "gaze" : "mouse";
}

function safeInteger(value: unknown, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : undefined;
}

function oneOf<T extends string>(value: unknown, ...allowed: T[]): T | undefined {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : undefined;
}
