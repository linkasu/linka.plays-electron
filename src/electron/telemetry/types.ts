export type AppMetadata = {
  version: string;
  build: string;
  platform: "windows" | "macos" | "linux";
  os_version: string;
  locale: string;
};

export type MetricsGameCategory = "gaze-basics" | "visual-search" | "sequencing" | "language-aac" | "numeracy" | "strategy" | "continuous-control";
export type MetricsFinishReason = "max-steps" | "timeout" | "too-many-mistakes" | "manual" | "game-complete" | "game-lost" | "game-draw";
export type MetricsInterruptionReason = "route-leave" | "window-close" | "app-quit" | "update-restart" | "renderer-crash";
export type MetricsResult = "completed" | "incomplete" | "lost" | "draw" | "interrupted";
export type MetricsTobiiState = "unsupported" | "service_starting" | "service_unavailable" | "connecting" | "waiting_device" | "connected" | "tracking" | "reconnecting" | "error";

export type TelemetryEventName =
  | "installation_created"
  | "app_started"
  | "app_backgrounded"
  | "app_foregrounded"
  | "app_closed"
  | "page_viewed"
  | "mode_changed"
  | "settings_changed"
  | "game_session_started"
  | "game_session_paused"
  | "game_session_resumed"
  | "game_session_finished"
  | "game_session_interrupted"
  | "level_entered"
  | "level_cancelled"
  | "level_clicked"
  | "target_entered"
  | "target_cancelled"
  | "target_clicked"
  | "success"
  | "mistake"
  | "hint_used"
  | "difficulty_changed"
  | "tobii_state_changed"
  | "updater_state_changed"
  | "error"
  | "queue_dropped";

export type StoredTelemetryEvent = {
  event_id: string;
  event_name: TelemetryEventName;
  occurred_at: string;
  app_session_id: string;
  game_session_id?: string;
  app: AppMetadata;
  properties: Record<string, unknown>;
};

export type StoredSessionSummary = {
  session_id: string;
  session_type: "app" | "game";
  app_session_id: string;
  game_session_id?: string;
  game_id?: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  paused_ms?: number;
  menu_mode?: string;
  game_category?: string;
  input_method?: string;
  finish_reason?: string;
  steps_completed?: number;
  max_steps?: number;
  success_count: number;
  mistake_count: number;
  hint_count: number;
  target_cancel_count?: number;
  gaze_lost_count?: number;
  difficulty_changes?: number;
  gaze_sample_count?: number;
  mouse_sample_count?: number;
  valid_gaze_ratio?: number;
  mean_dwell_ms?: number;
  configured_dwell_ms?: number;
  result?: string;
  interruption_reason?: string;
  app: AppMetadata;
};

export type SpoolRecord = {
  id: string;
  createdAt: number;
  kind: "event" | "summary";
  priority: "low" | "normal" | "summary";
  payload: StoredTelemetryEvent | StoredSessionSummary;
};

export type RendererTelemetryEventInput =
  | { eventName: "page_viewed"; properties: { page: string } }
  | { eventName: "mode_changed"; properties: { mode: "specialist" | "self" } }
  | { eventName: "settings_changed"; properties: { settingKey: "dwell_ms"; number: number } }
  | { eventName: "game_session_started" | "game_session_paused" | "game_session_resumed"; gameSessionId: string; properties: { gameId: string; mode?: "specialist" | "self"; gameCategory?: MetricsGameCategory } }
  | { eventName: "game_session_finished"; gameSessionId: string; properties: { gameId: string; result?: MetricsResult; reason: MetricsFinishReason } }
  | { eventName: "game_session_interrupted"; gameSessionId: string; properties: { gameId: string; reason: MetricsInterruptionReason } }
  | { eventName: "level_entered" | "level_cancelled" | "level_clicked"; gameSessionId: string; properties: { gameId: string; levelIndex: number } }
  | { eventName: "target_entered" | "target_cancelled" | "target_clicked"; gameSessionId: string; properties: { gameId: string; levelIndex: number; targetKind: "interactive" | "control"; inputMethod: "mouse" | "gaze"; elapsedMs?: number; reason?: "left" | "invalid-gaze" | "disabled" } }
  | { eventName: "success" | "mistake"; gameSessionId: string; properties: { gameId: string; levelIndex: number; targetKind?: "interactive" | "control"; inputMethod: "mouse" | "gaze"; responseMs?: number } }
  | { eventName: "hint_used"; gameSessionId: string; properties: { gameId: string; levelIndex: number; hintKind: "generic" } }
  | { eventName: "difficulty_changed"; gameSessionId: string; properties: { gameId: string; difficulty: number } }
  | { eventName: "tobii_state_changed"; properties: { state: MetricsTobiiState } }
  | { eventName: "error"; properties: { fingerprint: string; component: string } };

export type RendererSessionSummaryInput = {
  gameSessionId: string;
  gameId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  pausedMs?: number;
  menuMode?: "specialist" | "self";
  gameCategory?: MetricsGameCategory;
  inputMethod?: "mouse" | "gaze" | "mixed";
  finishReason?: MetricsFinishReason;
  stepsCompleted?: number;
  maxSteps?: number;
  successCount: number;
  mistakeCount: number;
  hintCount: number;
  targetCancelCount?: number;
  gazeLostCount?: number;
  difficultyChanges?: number;
  gazeSampleCount?: number;
  mouseSampleCount?: number;
  validGazeRatio?: number;
  meanDwellMs?: number;
  configuredDwellMs?: number;
  result?: MetricsResult;
  interruptionReason?: MetricsInterruptionReason;
};

export type SanitizedRendererEvent = {
  event_name: TelemetryEventName;
  game_session_id?: string;
  properties: Record<string, unknown>;
};
