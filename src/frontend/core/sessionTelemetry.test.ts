import { describe, expect, it } from "vitest";
import { allowedTelemetryGameIds } from "../../electron/telemetry/allowlists";
import { games } from "../data/games";
import { createGameSessionSummary, finishResult, projectSessionEvent } from "./sessionTelemetry";
import type { SessionEvent } from "./session";

describe("session telemetry projection", () => {
  it.each([
    [undefined, "incomplete"],
    ["max-steps", "completed"],
    ["game-complete", "completed"],
    ["game-lost", "lost"],
    ["game-draw", "draw"],
    ["timeout", "incomplete"],
    ["too-many-mistakes", "incomplete"],
    ["manual", "incomplete"],
  ] as const)("projects finish reason %s as %s", (reason, result) => {
    expect(finishResult(reason)).toBe(result);
  });

  it("keeps the Electron privacy allowlist synchronized with the game registry", () => {
    expect([...allowedTelemetryGameIds].sort()).toEqual(games.map((game) => game.id).sort());
  });

  it("does not project private game payload fields", () => {
    const event: SessionEvent = {
      id: "local-event",
      sessionId: "3f6358e2-4ea3-4af9-90e5-af410a66ed60",
      gameId: "chess-mini",
      type: "mistake",
      at: 1,
      payload: { targetId: "e2", expected: "secret", actual: "secret", board: "private", step: 3 },
    };

    expect(
      projectSessionEvent(event, { targetKind: "interactive", category: "strategy" }, "mouse"),
    ).toEqual({
      eventName: "mistake",
      gameSessionId: event.sessionId,
      properties: {
        gameId: "chess-mini",
        levelIndex: 3,
        targetKind: "interactive",
        inputMethod: "mouse",
        responseMs: undefined,
      },
    });
  });

  it.each([undefined, "route-leave", "renderer-crash"] as const)(
    "omits gaze quality and preserves interruption %s for a mouse-only session",
    (interruptionReason) => {
      const summary = createGameSessionSummary({
        sessionId: "3f6358e2-4ea3-4af9-90e5-af410a66ed60",
        gameId: "aquarium",
        startedAt: 1000,
        endedAt: 6000,
        durationMs: 4000,
        pausedMs: 1000,
        stepsCompleted: 2,
        maxSteps: 5,
        successCount: 2,
        mistakeCount: 0,
        hintCount: 0,
        targetCancelCount: 1,
        gazeLostCount: 0,
        difficultyChanges: 0,
        gazeSampleCount: 0,
        mouseSampleCount: 20,
        validGazeRatio: 1,
        configuredDwellMs: 750,
        interruptionReason,
      });

      expect(summary.inputMethod).toBe("mouse");
      expect(summary.validGazeRatio).toBeUndefined();
      expect(summary.durationMs).toBe(4000);
      expect(summary.pausedMs).toBe(1000);
      expect(summary.result).toBe(interruptionReason ? "interrupted" : "incomplete");
      expect(summary.interruptionReason).toBe(interruptionReason);
    },
  );
});
