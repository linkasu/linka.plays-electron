import type { SpoolRecord, StoredSessionSummary, StoredTelemetryEvent } from "./types";

export type MetricsStream = "common" | "technical" | "plays";
export type ProjectedRecord = { stream: MetricsStream; value: Record<string, unknown> };

const commonKinds = new Set(["app_started", "app_backgrounded", "app_foregrounded", "app_closed"]);

export function projectV2Record(record: SpoolRecord): ProjectedRecord | undefined {
  if (record.kind === "summary") return projectSummary(record.payload as StoredSessionSummary);
  const event = record.payload as StoredTelemetryEvent;
  const base = { record_id: event.event_id.toLowerCase(), occurred_at: event.occurred_at, kind: event.event_name, app_session_id: event.app_session_id.toLowerCase(), app: normalizedApp(event.app) };
  if (commonKinds.has(event.event_name)) return { stream: "common", value: base };
  if (event.event_name === "page_viewed") {
    const page = pageName(event.properties.page);
    return page ? { stream: "common", value: { ...base, page } } : undefined;
  }
  if (event.event_name === "mode_changed") {
    const mode = event.properties.mode === "specialist" ? "assisted" : event.properties.mode;
    return mode === "self" || mode === "assisted" ? { stream: "common", value: { ...base, mode } } : undefined;
  }
  if (event.event_name === "tobii_state_changed" || event.event_name === "updater_state_changed") {
    const state = technicalState(event.properties.state);
    if (!state) return undefined;
    return { stream: "technical", value: { ...base, kind: "state_changed", component: event.event_name === "tobii_state_changed" ? "tobii" : "updater", state } };
  }
  if (event.event_name === "error") {
    const fingerprint = event.properties.fingerprint;
    if (typeof fingerprint !== "string") return undefined;
    return { stream: "technical", value: { ...base, kind: "error", component: technicalComponent(event.properties.component), error_fingerprint: fingerprint.toLowerCase() } };
  }
  if (event.event_name === "queue_dropped") {
    return { stream: "technical", value: { ...base, component: "telemetry", dropped_count: event.properties.dropped_count, drop_reason: event.properties.reason } };
  }
  return projectGameEvent(event, base);
}

export function shouldQueueV2Event(eventName: StoredTelemetryEvent["event_name"]) {
  return commonKinds.has(eventName) || eventName === "page_viewed" || eventName === "mode_changed" || eventName === "tobii_state_changed" || eventName === "updater_state_changed" || eventName === "error" || eventName === "queue_dropped" || eventName === "game_session_started" || eventName === "target_cancelled" || eventName === "success" || eventName === "mistake" || eventName === "hint_used";
}

function projectSummary(summary: StoredSessionSummary): ProjectedRecord | undefined {
  if (summary.session_type !== "game" || !summary.game_session_id || !summary.game_id) return undefined;
  const outcome = summary.result ?? (summary.interruption_reason ? "interrupted" : "completed");
  if (!oneOf(outcome, "completed", "incomplete", "lost", "draw", "interrupted", "cancelled", "error")) return undefined;
  return {
    stream: "plays",
    value: compact({
      record_id: summary.session_id.toLowerCase(),
      occurred_at: summary.ended_at,
      kind: "session_finished",
      app_session_id: summary.app_session_id.toLowerCase(),
      game_session_id: summary.game_session_id.toLowerCase(),
      app: normalizedApp(summary.app),
      game_id: summary.game_id,
      game_category: summary.game_category ?? "unknown",
      input_method: summary.input_method ?? "unknown",
      outcome,
      duration_ms: summary.duration_ms,
      success_count: summary.success_count,
      mistake_count: summary.mistake_count,
      hint_count: summary.hint_count,
      valid_gaze_ratio: summary.valid_gaze_ratio
    })
  };
}

function projectGameEvent(event: StoredTelemetryEvent, base: Record<string, unknown>): ProjectedRecord | undefined {
  if (!event.game_session_id || typeof event.properties.game_id !== "string") return undefined;
  const shared = {
    ...base,
    game_session_id: event.game_session_id.toLowerCase(),
    game_id: event.properties.game_id,
    game_category: typeof event.properties.game_category === "string" ? event.properties.game_category : "unknown",
    input_method: event.properties.input_method ?? "unknown"
  };
  if (event.event_name === "game_session_started") return { stream: "plays", value: { ...shared, kind: "session_started" } };
  const outcomes = { success: "success", mistake: "mistake", hint_used: "hint", target_cancelled: "cancelled" } as const;
  const outcome = outcomes[event.event_name as keyof typeof outcomes];
  if (!outcome || typeof event.properties.level_index !== "number") return undefined;
  return { stream: "plays", value: { ...shared, kind: "interaction", level_index: event.properties.level_index, outcome } };
}

function normalizedApp(app: StoredTelemetryEvent["app"]) {
  return { ...app, locale: oneOf(app.locale, "ru", "ru-RU", "en", "en-US") ? app.locale : "other" };
}

function pageName(value: unknown) {
  if (value === "start") return "home";
  if (value === "menu-specialist" || value === "menu-self") return "games";
  if (value === "gaze-debug" || value === "tobii-calibration") return "settings";
  if (value === "planned-game" || typeof value === "string") return "game";
  return undefined;
}

function technicalState(value: unknown) {
  const mapped: Record<string, string> = {
    unsupported: "unavailable", service_starting: "starting", service_unavailable: "unavailable", connecting: "connecting",
    waiting_device: "connecting", connected: "connected", tracking: "tracking", reconnecting: "connecting", error: "error",
    idle: "idle", checking: "checking", available: "ready", downloading: "downloading", downloaded: "ready", installing: "installing"
  };
  return typeof value === "string" ? mapped[value] : undefined;
}

function technicalComponent(value: unknown) {
  if (typeof value !== "string") return "main";
  if (value.startsWith("renderer")) return "renderer";
  if (value.startsWith("tobii")) return "tobii";
  if (value.startsWith("updater")) return "updater";
  if (value.startsWith("telemetry")) return "telemetry";
  return "main";
}

function compact(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function oneOf<T extends string>(value: unknown, ...allowed: T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}
