import { describe, expect, it } from "vitest";
import { containsPoint, createGazeMetricsTracker } from "./gaze";

describe("gaze helpers", () => {
  it("checks whether a point is inside a target", () => {
    expect(containsPoint({ id: "a", x: 10, y: 20, width: 50, height: 40 }, { x: 30, y: 30 })).toBe(true);
    expect(containsPoint({ id: "a", x: 10, y: 20, width: 50, height: 40 }, { x: 80, y: 30 })).toBe(false);
  });

  it("tracks valid gaze ratio and lost/restored transitions", () => {
    const tracker = createGazeMetricsTracker();

    expect(tracker.record({ x: 0, y: 0, valid: true, source: "tobii", timestamp: 1000 })).toBeUndefined();
    expect(tracker.record({ x: 3, y: 4, valid: true, source: "tobii", timestamp: 1020 })).toBeUndefined();
    expect(tracker.record({ x: 3, y: 4, valid: false, source: "tobii", timestamp: 1040 })).toBe("lost");
    expect(tracker.record({ x: 6, y: 8, valid: true, source: "tobii", timestamp: 1060 })).toBe("restored");

    expect(tracker.snapshot()).toMatchObject({
      totalGazeSamples: 4,
      validGazeSamples: 3,
      invalidGazeSamples: 1,
      validGazeRatio: 0.75,
      lostGazeEvents: 1,
      restoredGazeEvents: 1,
      rawPathLength: 10,
      meanSampleIntervalMs: 20
    });
  });

  it("keeps mouse samples out of gaze quality", () => {
    const tracker = createGazeMetricsTracker();

    tracker.record({ x: 10, y: 10, valid: true, source: "mouse", timestamp: 1000 });
    tracker.record({ x: 20, y: 20, valid: true, source: "mouse", timestamp: 1020 });
    tracker.record({ x: 30, y: 30, valid: false, source: "tobii", timestamp: 1040 });

    expect(tracker.snapshot()).toMatchObject({
      totalGazeSamples: 1,
      mouseSampleCount: 2,
      validGazeSamples: 0,
      invalidGazeSamples: 1,
      validGazeRatio: 0
    });
  });
});
