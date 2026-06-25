import { describe, expect, it } from "vitest";
import { createPyramidRings, getCorrectPyramidOrder, getNextPyramidRing, getPlacedPyramidRings, selectPyramidRing } from "./model";

describe("pyramid model", () => {
  it("starts with rings ordered from large to small", () => {
    const rings = createPyramidRings();

    expect(rings.map((ring) => ring.size)).toEqual([240, 200, 160, 120]);
    expect(getNextPyramidRing(rings)?.id).toBe("ring-1");
  });

  it("returns the correct review order from large to small", () => {
    const rings = createPyramidRings().reverse();

    expect(getCorrectPyramidOrder(rings).map((ring) => ring.id)).toEqual(["ring-1", "ring-2", "ring-3", "ring-4"]);
  });

  it("places a correct ring and advances the expected ring", () => {
    const outcome = selectPyramidRing(createPyramidRings(), "ring-1");

    expect(outcome.kind).toBe("placed");
    if (outcome.kind !== "placed") return;
    expect(outcome.isCorrect).toBe(true);
    expect(outcome.selectedRing.placedIndex).toBe(1);
    expect(getNextPyramidRing(outcome.rings)?.id).toBe("ring-2");
  });

  it("still places a wrong ring and reports the expected ring", () => {
    const outcome = selectPyramidRing(createPyramidRings(), "ring-4");

    expect(outcome.kind).toBe("placed");
    if (outcome.kind !== "placed") return;
    expect(outcome.isCorrect).toBe(false);
    expect(outcome.expectedRing?.id).toBe("ring-1");
    expect(outcome.selectedRing.placedIndex).toBe(1);
  });

  it("ignores already placed rings", () => {
    const first = selectPyramidRing(createPyramidRings(), "ring-1");
    if (first.kind !== "placed") throw new Error("Expected first ring placement.");

    expect(selectPyramidRing(first.rings, "ring-1")).toEqual({ kind: "ignored" });
  });

  it("completes after all rings are placed in any order", () => {
    let rings = createPyramidRings();
    for (const ringId of ["ring-4", "ring-1", "ring-3", "ring-2"] as const) {
      const outcome = selectPyramidRing(rings, ringId);
      if (outcome.kind !== "placed") throw new Error(`Expected ${ringId} placement.`);
      rings = outcome.rings;
    }

    expect(getPlacedPyramidRings(rings).map((ring) => ring.id)).toEqual(["ring-4", "ring-1", "ring-3", "ring-2"]);
    expect(rings.every((ring) => ring.placed)).toBe(true);
  });
});
