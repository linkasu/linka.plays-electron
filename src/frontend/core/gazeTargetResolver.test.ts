import { describe, expect, it } from "vitest";
import { resolveGazeTarget, type GazeTargetCandidate } from "./gazeTargetResolver";

const targets: GazeTargetCandidate[] = [
  {
    id: "left",
    rect: { left: 0, top: 0, right: 100, bottom: 100 },
    enabled: true,
    visible: true,
    hitPadding: 36
  },
  {
    id: "right",
    rect: { left: 112, top: 0, right: 212, bottom: 100 },
    enabled: true,
    visible: true,
    hitPadding: 36
  }
];

describe("resolveGazeTarget", () => {
  it("prefers a direct visual hit over a neighbor's padded area", () => {
    expect(resolveGazeTarget(targets, { x: 114, y: 50 })?.id).toBe("right");
  });

  it("selects the nearest card inside an overlapping gap", () => {
    expect(resolveGazeTarget(targets, { x: 103, y: 50 })?.id).toBe("left");
    expect(resolveGazeTarget(targets, { x: 109, y: 50 })?.id).toBe("right");
  });

  it("uses priority before distance", () => {
    const prioritized = targets.map((target) => target.id === "right" ? { ...target, priority: 2 } : target);

    expect(resolveGazeTarget(prioritized, { x: 103, y: 50 })?.id).toBe("right");
  });

  it("ignores disabled and invisible targets", () => {
    expect(resolveGazeTarget(targets.map((target) => ({ ...target, enabled: false })), { x: 50, y: 50 })).toBeUndefined();
    expect(resolveGazeTarget(targets.map((target) => ({ ...target, visible: false })), { x: 50, y: 50 })).toBeUndefined();
  });

  it("returns no target outside every padded area", () => {
    expect(resolveGazeTarget(targets, { x: 300, y: 50 })).toBeUndefined();
  });
});
