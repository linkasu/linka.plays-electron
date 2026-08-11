import { describe, expect, it } from "vitest";
import { mouseOwnsPointer, smoothingAlpha } from "./useGazePointer";

describe("gaze pointer arbitration", () => {
  it("keeps fresh mouse input ahead of gaze packets", () => {
    expect(mouseOwnsPointer(1_000, 1_500)).toBe(true);
    expect(mouseOwnsPointer(1_000, 2_200)).toBe(false);
  });

  it("uses a time-based smoothing constant", () => {
    expect(smoothingAlpha(0)).toBe(0);
    expect(smoothingAlpha(45)).toBeCloseTo(1 - Math.exp(-1));
    expect(smoothingAlpha(90)).toBeGreaterThan(smoothingAlpha(45));
  });
});
