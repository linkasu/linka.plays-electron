import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import type { AppMetadata, SpoolRecord } from "./types";
import { projectV2Record } from "./v2";

const app: AppMetadata = {
  version: "1.0.0",
  build: "1.0.0",
  platform: "linux",
  os_version: "1.0",
  locale: "de-DE",
};

describe("V2 telemetry projection", () => {
  it("normalizes app navigation and locale without free-form values", () => {
    const projected = projectV2Record(event("page_viewed", { page: "start" }));
    expect(projected).toMatchObject({
      stream: "common",
      value: { kind: "page_viewed", page: "home", app: { locale: "other" } },
    });
  });

  it.each([
    { result: undefined, interruptionReason: undefined, outcome: "incomplete" },
    { result: undefined, interruptionReason: "renderer-crash", outcome: "interrupted" },
    { result: "completed", interruptionReason: "route-leave", outcome: "interrupted" },
    ...["completed", "incomplete", "lost", "draw", "interrupted", "cancelled", "error"].map(
      (result) => ({ result, interruptionReason: undefined, outcome: result }),
    ),
  ])(
    "projects result $result / interruption $interruptionReason as $outcome",
    ({ result, interruptionReason, outcome }) => {
      const sessionId = randomUUID();
      const record: SpoolRecord = {
        id: sessionId,
        createdAt: Date.now(),
        kind: "summary",
        priority: "summary",
        payload: {
          session_id: sessionId,
          session_type: "game",
          app_session_id: randomUUID(),
          game_session_id: sessionId,
          game_id: "aquarium",
          game_category: "gaze-basics",
          input_method: "mixed",
          started_at: new Date(Date.now() - 1000).toISOString(),
          ended_at: new Date().toISOString(),
          duration_ms: 1000,
          success_count: 1,
          mistake_count: 2,
          hint_count: 3,
          result,
          interruption_reason: interruptionReason,
          app,
        },
      };

      expect(projectV2Record(record)).toMatchObject({
        stream: "plays",
        value: {
          kind: "session_finished",
          input_method: "mixed",
          outcome,
          success_count: 1,
          mistake_count: 2,
          hint_count: 3,
        },
      });
    },
  );

  it("uses an explicit unknown category instead of dropping a direct-route session", () => {
    const sessionId = randomUUID();
    const record: SpoolRecord = {
      id: sessionId,
      createdAt: Date.now(),
      kind: "summary",
      priority: "summary",
      payload: {
        session_id: sessionId,
        session_type: "game",
        app_session_id: randomUUID(),
        game_session_id: sessionId,
        game_id: "aquarium",
        started_at: new Date(Date.now() - 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_ms: 1000,
        success_count: 0,
        mistake_count: 0,
        hint_count: 0,
        app,
      },
    };

    expect(projectV2Record(record)).toMatchObject({
      stream: "plays",
      value: { game_category: "unknown", input_method: "unknown" },
    });
  });

  it("canonicalizes renderer UUIDs before strict backend validation", () => {
    const sessionId = randomUUID().toUpperCase();
    const record: SpoolRecord = {
      id: sessionId,
      createdAt: Date.now(),
      kind: "summary",
      priority: "summary",
      payload: {
        session_id: sessionId,
        session_type: "game",
        app_session_id: randomUUID().toUpperCase(),
        game_session_id: sessionId,
        game_id: "aquarium",
        game_category: "gaze-basics",
        started_at: new Date(Date.now() - 1000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_ms: 1000,
        success_count: 0,
        mistake_count: 0,
        hint_count: 0,
        app,
      },
    };

    const projected = projectV2Record(record)?.value;
    expect(projected?.record_id).toBe(sessionId.toLowerCase());
    expect(projected?.game_session_id).toBe(sessionId.toLowerCase());
    expect(projected?.app_session_id).toBe(String(projected?.app_session_id).toLowerCase());
  });
});

function event(eventName: "page_viewed", properties: Record<string, unknown>): SpoolRecord {
  const id = randomUUID();
  return {
    id,
    createdAt: Date.now(),
    kind: "event",
    priority: "normal",
    payload: {
      event_id: id,
      event_name: eventName,
      occurred_at: new Date().toISOString(),
      app_session_id: randomUUID(),
      app,
      properties,
    },
  };
}
