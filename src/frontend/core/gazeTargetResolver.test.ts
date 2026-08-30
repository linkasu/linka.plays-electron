import { describe, expect, it } from "vitest";
import { resolveGazeTarget, unionRect, type GazeTargetCandidate } from "./gazeTargetResolver";

const targets: GazeTargetCandidate[] = [
  {
    id: "left",
    rect: { left: 0, top: 0, right: 100, bottom: 100 },
    enabled: true,
    visible: true,
    hitPadding: 36,
  },
  {
    id: "right",
    rect: { left: 112, top: 0, right: 212, bottom: 100 },
    enabled: true,
    visible: true,
    hitPadding: 36,
  },
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
    const prioritized = targets.map((target) =>
      target.id === "right" ? { ...target, priority: 2 } : target,
    );

    expect(resolveGazeTarget(prioritized, { x: 103, y: 50 })?.id).toBe("right");
  });

  it("ignores disabled and invisible targets", () => {
    expect(
      resolveGazeTarget(
        targets.map((target) => ({ ...target, enabled: false })),
        { x: 50, y: 50 },
      ),
    ).toBeUndefined();
    expect(
      resolveGazeTarget(
        targets.map((target) => ({ ...target, visible: false })),
        { x: 50, y: 50 },
      ),
    ).toBeUndefined();
  });

  it("returns no target outside every padded area", () => {
    expect(resolveGazeTarget(targets, { x: 300, y: 50 })).toBeUndefined();
  });
});

describe("unionRect", () => {
  it("covers parts drawn outside the container box", () => {
    // Так устроен куст в who-hiding: контейнер 100..200, а крона и зверёк
    // подняты выше него. Зона взгляда должна накрывать нарисованное целиком.
    const container = { left: 0, top: 100, right: 100, bottom: 200 };
    const crown = { left: 5, top: 40, right: 95, bottom: 150 };

    expect(unionRect([container, crown])).toEqual({ left: 0, top: 40, right: 100, bottom: 200 });
  });

  it("ignores parts with no area so hidden decorations do not stretch the zone", () => {
    const shape = { left: 10, top: 10, right: 60, bottom: 60 };
    const collapsed = { left: 0, top: 0, right: 0, bottom: 0 };

    expect(unionRect([shape, collapsed])).toEqual(shape);
  });

  it("returns nothing when there is nothing drawn", () => {
    expect(unionRect([])).toBeUndefined();
    expect(unionRect([{ left: 5, top: 5, right: 5, bottom: 5 }])).toBeUndefined();
  });
});
