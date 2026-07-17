import { describe, expect, it } from "vitest";
import { createDwellMachineState } from "./dwellStateMachine";
import { advanceMovingTargetDwell, advanceMovingTargetX, alternatingMovingTargetDirection, closestMovingTarget, movingTargetSpawnX } from "./movingTarget";

describe("moving targets", () => {
  it("places initial targets fully inside the horizontal safe area", () => {
    const x = movingTargetSpawnX({
      direction: 1,
      edgeOffset: 180,
      fromEdge: false,
      index: 0,
      targetCount: 1,
      targetRadius: 120,
      viewportWidth: 1000
    });

    expect(x).toBe(500);
    expect(x - 120).toBeGreaterThanOrEqual(0);
    expect(x + 120).toBeLessThanOrEqual(1000);
  });

  it("spawns and moves targets symmetrically from either side", () => {
    const viewportWidth = 1000;
    const offset = 180;
    const distance = 75 * 1.6;
    const fromLeft = movingTargetSpawnX({ direction: 1, edgeOffset: offset, fromEdge: true, index: 0, targetCount: 1, targetRadius: 100, viewportWidth });
    const fromRight = movingTargetSpawnX({ direction: -1, edgeOffset: offset, fromEdge: true, index: 0, targetCount: 1, targetRadius: 100, viewportWidth });

    expect(-fromLeft).toBe(fromRight - viewportWidth);
    expect(advanceMovingTargetX(fromLeft, 1, 75, 1.6) + advanceMovingTargetX(fromRight, -1, 75, 1.6)).toBe(viewportWidth);
  });

  it("alternates edge directions evenly", () => {
    expect([0, 1, 2, 3].map(alternatingMovingTargetDirection)).toEqual([1, -1, 1, -1]);
  });

  it("chooses the nearest target when hit areas overlap", () => {
    const targets = [
      { id: "far", x: 120, y: 100, radius: 80 },
      { id: "near", x: 170, y: 100, radius: 80 }
    ];

    const target = closestMovingTarget({
      targets,
      pointer: { x: 160, y: 100, valid: true },
      point: (candidate) => candidate,
      hitRadius: (candidate) => candidate.radius
    });

    expect(target?.id).toBe("near");
  });

  it("uses nearest-target resolution before advancing dwell", () => {
    const targets = [
      { id: "far", x: 120, y: 100, radius: 80 },
      { id: "near", x: 170, y: 100, radius: 80 }
    ];
    const result = advanceMovingTargetDwell(createDwellMachineState(), {
      now: 0,
      pointer: { x: 160, y: 100, valid: true },
      targets,
      point: (target) => target,
      hitRadius: (target) => target.radius,
      dwellMs: 1000
    });

    expect(result.events).toEqual([{ type: "enter", targetId: "near" }]);
  });
});
