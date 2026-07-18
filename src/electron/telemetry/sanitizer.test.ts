import { describe, expect, it } from "vitest";
import { sanitizeRendererSessionSummary, sanitizeRendererTelemetryEvent } from "./sanitizer";

const sessionId = "3f6358e2-4ea3-4af9-90e5-af410a66ed60";

describe("telemetry sanitizer", () => {
  it("projects an allowed target event without identifiers or coordinates", () => {
    expect(sanitizeRendererTelemetryEvent({
      eventName: "target_clicked",
      gameSessionId: sessionId,
      properties: { gameId: "aquarium", levelIndex: 2, targetKind: "interactive", inputMethod: "gaze", elapsedMs: 750 }
    })).toEqual({
      event_name: "target_clicked",
      game_session_id: sessionId,
      properties: { game_id: "aquarium", level_index: 2, target_kind: "interactive", input_method: "gaze", elapsed_ms: 750 }
    });
  });

  it.each(["x", "y", "timestamp", "targetId", "text", "expected", "actual", "board", "fen", "stack", "message", "path"])("rejects forbidden property %s", (key) => {
    expect(sanitizeRendererTelemetryEvent({
      eventName: "target_clicked",
      gameSessionId: sessionId,
      properties: { gameId: "aquarium", levelIndex: 0, targetKind: "interactive", inputMethod: "gaze", [key]: "private" }
    })).toBeUndefined();
  });

  it("rejects unknown event payloads and raw error details", () => {
    expect(sanitizeRendererTelemetryEvent({ eventName: "custom", properties: { anything: true } })).toBeUndefined();
    expect(sanitizeRendererTelemetryEvent({ eventName: "error", properties: { fingerprint: `sha256:${"a".repeat(64)}`, component: "renderer.window", message: "secret" } })).toBeUndefined();
  });

  it("rejects unknown identifiers even when they use the safe alphabet", () => {
    expect(sanitizeRendererTelemetryEvent({ eventName: "page_viewed", properties: { page: "encoded-private-value" } })).toBeUndefined();
    expect(sanitizeRendererTelemetryEvent({ eventName: "game_session_started", gameSessionId: sessionId, properties: { gameId: "encoded-private-value" } })).toBeUndefined();
    expect(sanitizeRendererTelemetryEvent({ eventName: "error", properties: { fingerprint: `sha256:${"a".repeat(64)}`, component: "renderer.private" } })).toBeUndefined();
  });

  it("accepts only aggregate game summaries", () => {
    const base = {
      gameSessionId: sessionId,
      gameId: "aquarium",
      startedAt: "2026-07-18T10:00:00.000Z",
      endedAt: "2026-07-18T10:00:10.000Z",
      durationMs: 9000,
      successCount: 2,
      mistakeCount: 1,
      hintCount: 0
    };
    expect(sanitizeRendererSessionSummary(base)).toEqual(base);
    expect(sanitizeRendererSessionSummary({ ...base, phrase: "private" })).toBeUndefined();
  });
});
