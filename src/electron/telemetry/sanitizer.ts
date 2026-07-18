import type { RendererSessionSummaryInput, SanitizedRendererEvent, StoredSessionSummary } from "./types";
import { allowedRendererErrorComponentSet, allowedTelemetryGameIdSet, allowedTelemetryPageIdSet } from "./allowlists";

const fingerprintPattern = /^(?:[A-Fa-f0-9]{16,96}|sha256:[A-Fa-f0-9]{64})$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const millisecondTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const gameCategories = new Set(["gaze-basics", "visual-search", "sequencing", "language-aac", "numeracy", "strategy", "continuous-control"]);
const finishReasons = new Set(["max-steps", "timeout", "too-many-mistakes", "manual", "game-complete", "game-lost", "game-draw"]);
const interruptionReasons = new Set(["route-leave", "window-close", "app-quit", "update-restart", "renderer-crash"]);
const results = new Set(["completed", "incomplete", "lost", "draw", "interrupted"]);
const tobiiStates = new Set(["unsupported", "service_starting", "service_unavailable", "connecting", "waiting_device", "connected", "tracking", "reconnecting", "error"]);

export function sanitizeRendererTelemetryEvent(input: unknown): SanitizedRendererEvent | undefined {
  if (!isExactObject(input, ["eventName", "gameSessionId", "properties"]) || typeof input.eventName !== "string") return undefined;
  const properties = input.properties;

  switch (input.eventName) {
    case "page_viewed": {
      if (input.gameSessionId !== undefined || !isExactObject(properties, ["page"]) || !isAllowed(properties.page, allowedTelemetryPageIdSet)) return undefined;
      return event(input.eventName, { page: properties.page });
    }
    case "mode_changed": {
      if (input.gameSessionId !== undefined || !isExactObject(properties, ["mode"]) || !oneOf(properties.mode, "specialist", "self")) return undefined;
      return event(input.eventName, { mode: properties.mode });
    }
    case "settings_changed": {
      if (input.gameSessionId !== undefined || !isExactObject(properties, ["settingKey", "number"]) || properties.settingKey !== "dwell_ms" || !isNumber(properties.number, 0, 100000)) return undefined;
      return event(input.eventName, { setting_key: properties.settingKey, number: properties.number });
    }
    case "game_session_started":
    case "game_session_paused":
    case "game_session_resumed": {
      if (!hasGameSession(input) || !isExactObject(properties, ["gameId", "mode", "gameCategory"]) || !isAllowedGameId(properties.gameId)) return undefined;
      if (properties.mode !== undefined && !oneOf(properties.mode, "specialist", "self")) return undefined;
      if (properties.gameCategory !== undefined && !gameCategories.has(String(properties.gameCategory))) return undefined;
      return event(input.eventName, compact({ game_id: properties.gameId, mode: properties.mode, game_category: properties.gameCategory }), input.gameSessionId);
    }
    case "game_session_finished": {
      if (!hasGameSession(input) || !isExactObject(properties, ["gameId", "result", "reason"]) || !isAllowedGameId(properties.gameId) || !finishReasons.has(String(properties.reason))) return undefined;
      if (properties.result !== undefined && !results.has(String(properties.result))) return undefined;
      return event(input.eventName, compact({ game_id: properties.gameId, result: properties.result, reason: properties.reason }), input.gameSessionId);
    }
    case "game_session_interrupted": {
      if (!hasGameSession(input) || !isExactObject(properties, ["gameId", "reason"]) || !isAllowedGameId(properties.gameId) || !interruptionReasons.has(String(properties.reason))) return undefined;
      return event(input.eventName, { game_id: properties.gameId, reason: properties.reason }, input.gameSessionId);
    }
    case "level_entered":
    case "level_cancelled":
    case "level_clicked": {
      if (!hasGameSession(input) || !isExactObject(properties, ["gameId", "levelIndex"]) || !isAllowedGameId(properties.gameId) || !isInteger(properties.levelIndex, 0, 0xffffffff)) return undefined;
      return event(input.eventName, { game_id: properties.gameId, level_index: properties.levelIndex }, input.gameSessionId);
    }
    case "target_entered":
    case "target_cancelled":
    case "target_clicked": {
      if (!hasGameSession(input) || !isExactObject(properties, ["gameId", "levelIndex", "targetKind", "inputMethod", "elapsedMs", "reason"])) return undefined;
      if (!isAllowedGameId(properties.gameId) || !isInteger(properties.levelIndex, 0, 0xffffffff) || !oneOf(properties.targetKind, "interactive", "control") || !oneOf(properties.inputMethod, "mouse", "gaze")) return undefined;
      if (properties.elapsedMs !== undefined && !isInteger(properties.elapsedMs, 0, 60000)) return undefined;
      if (properties.reason !== undefined && !oneOf(properties.reason, "left", "invalid-gaze", "disabled")) return undefined;
      return event(input.eventName, compact({ game_id: properties.gameId, level_index: properties.levelIndex, target_kind: properties.targetKind, input_method: properties.inputMethod, elapsed_ms: properties.elapsedMs, reason: properties.reason }), input.gameSessionId);
    }
    case "success":
    case "mistake": {
      if (!hasGameSession(input) || !isExactObject(properties, ["gameId", "levelIndex", "targetKind", "inputMethod", "responseMs"])) return undefined;
      if (!isAllowedGameId(properties.gameId) || !isInteger(properties.levelIndex, 0, 0xffffffff) || !oneOf(properties.inputMethod, "mouse", "gaze")) return undefined;
      if (properties.targetKind !== undefined && !oneOf(properties.targetKind, "interactive", "control")) return undefined;
      if (properties.responseMs !== undefined && !isInteger(properties.responseMs, 0, 86400000)) return undefined;
      return event(input.eventName, compact({ game_id: properties.gameId, level_index: properties.levelIndex, target_kind: properties.targetKind, input_method: properties.inputMethod, response_ms: properties.responseMs }), input.gameSessionId);
    }
    case "hint_used": {
      if (!hasGameSession(input) || !isExactObject(properties, ["gameId", "levelIndex", "hintKind"]) || !isAllowedGameId(properties.gameId) || !isInteger(properties.levelIndex, 0, 0xffffffff) || properties.hintKind !== "generic") return undefined;
      return event(input.eventName, { game_id: properties.gameId, level_index: properties.levelIndex, hint_kind: properties.hintKind }, input.gameSessionId);
    }
    case "difficulty_changed": {
      if (!hasGameSession(input) || !isExactObject(properties, ["gameId", "difficulty"]) || !isAllowedGameId(properties.gameId) || !isInteger(properties.difficulty, 1, 10)) return undefined;
      return event(input.eventName, { game_id: properties.gameId, difficulty: properties.difficulty }, input.gameSessionId);
    }
    case "tobii_state_changed": {
      if (input.gameSessionId !== undefined || !isExactObject(properties, ["state"]) || !tobiiStates.has(String(properties.state))) return undefined;
      return event(input.eventName, { state: properties.state });
    }
    case "error": {
      if (input.gameSessionId !== undefined || !isExactObject(properties, ["fingerprint", "component"]) || !fingerprintPattern.test(String(properties.fingerprint)) || !isAllowed(properties.component, allowedRendererErrorComponentSet)) return undefined;
      return event(input.eventName, { fingerprint: properties.fingerprint, component: properties.component });
    }
    default:
      return undefined;
  }
}

export function sanitizeRendererSessionSummary(input: unknown): RendererSessionSummaryInput | undefined {
  const keys = ["gameSessionId", "gameId", "startedAt", "endedAt", "durationMs", "pausedMs", "menuMode", "gameCategory", "inputMethod", "finishReason", "stepsCompleted", "maxSteps", "successCount", "mistakeCount", "hintCount", "targetCancelCount", "gazeLostCount", "difficultyChanges", "gazeSampleCount", "mouseSampleCount", "validGazeRatio", "meanDwellMs", "configuredDwellMs", "result", "interruptionReason"];
  if (!isExactObject(input, keys) || !isUUID(input.gameSessionId) || !isAllowedGameId(input.gameId) || !isTime(input.startedAt) || !isTime(input.endedAt)) return undefined;
  if (Date.parse(input.endedAt) < Date.parse(input.startedAt) || !isInteger(input.durationMs, 0, 604800000)) return undefined;
  for (const key of ["pausedMs", "stepsCompleted", "maxSteps", "successCount", "mistakeCount", "hintCount", "targetCancelCount", "gazeLostCount", "difficultyChanges"] as const) {
    const value = input[key];
    if (value !== undefined && !isInteger(value, 0, 0xffffffff)) return undefined;
  }
  for (const key of ["gazeSampleCount", "mouseSampleCount"] as const) {
    const value = input[key];
    if (value !== undefined && !isInteger(value, 0, Number.MAX_SAFE_INTEGER)) return undefined;
  }
  if (!isInteger(input.successCount, 0, 0xffffffff) || !isInteger(input.mistakeCount, 0, 0xffffffff) || !isInteger(input.hintCount, 0, 0xffffffff)) return undefined;
  if (input.menuMode !== undefined && !oneOf(input.menuMode, "specialist", "self")) return undefined;
  if (input.gameCategory !== undefined && !gameCategories.has(String(input.gameCategory))) return undefined;
  if (input.inputMethod !== undefined && !oneOf(input.inputMethod, "mouse", "gaze", "mixed")) return undefined;
  if (input.finishReason !== undefined && !finishReasons.has(String(input.finishReason))) return undefined;
  if (input.interruptionReason !== undefined && !interruptionReasons.has(String(input.interruptionReason))) return undefined;
  if (input.result !== undefined && !results.has(String(input.result))) return undefined;
  if (input.validGazeRatio !== undefined && !isNumber(input.validGazeRatio, 0, 1)) return undefined;
  if (input.meanDwellMs !== undefined && !isNumber(input.meanDwellMs, 0, 60000)) return undefined;
  if (input.configuredDwellMs !== undefined && !isInteger(input.configuredDwellMs, 0, 60000)) return undefined;
  return input as RendererSessionSummaryInput;
}

export function toStoredGameSummary(input: RendererSessionSummaryInput, appSessionId: string, app: StoredSessionSummary["app"]): StoredSessionSummary {
  return compact({
    session_id: input.gameSessionId,
    session_type: "game" as const,
    app_session_id: appSessionId,
    game_session_id: input.gameSessionId,
    game_id: input.gameId,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    duration_ms: input.durationMs,
    paused_ms: input.pausedMs,
    menu_mode: input.menuMode,
    game_category: input.gameCategory,
    input_method: input.inputMethod,
    finish_reason: input.finishReason,
    steps_completed: input.stepsCompleted,
    max_steps: input.maxSteps,
    success_count: input.successCount,
    mistake_count: input.mistakeCount,
    hint_count: input.hintCount,
    target_cancel_count: input.targetCancelCount,
    gaze_lost_count: input.gazeLostCount,
    difficulty_changes: input.difficultyChanges,
    gaze_sample_count: input.gazeSampleCount,
    mouse_sample_count: input.mouseSampleCount,
    valid_gaze_ratio: input.validGazeRatio,
    mean_dwell_ms: input.meanDwellMs,
    configured_dwell_ms: input.configuredDwellMs,
    result: input.result,
    interruption_reason: input.interruptionReason,
    app
  });
}

function event(eventName: SanitizedRendererEvent["event_name"], properties: Record<string, unknown>, gameSessionId?: string): SanitizedRendererEvent {
  return compact({ event_name: eventName, game_session_id: gameSessionId, properties });
}

function hasGameSession(input: Record<string, unknown>): input is Record<string, unknown> & { gameSessionId: string } {
  return isUUID(input.gameSessionId);
}

function isExactObject(value: unknown, allowedKeys: string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isAllowedGameId(value: unknown): value is string {
  return isAllowed(value, allowedTelemetryGameIdSet);
}

function isAllowed(value: unknown, allowed: ReadonlySet<string>): value is string {
  return typeof value === "string" && allowed.has(value);
}

function isUUID(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && millisecondTimePattern.test(value) && Number.isFinite(Date.parse(value));
}

function isNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return isNumber(value, min, max) && Number.isInteger(value);
}

function oneOf<T extends string>(value: unknown, ...allowed: T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
