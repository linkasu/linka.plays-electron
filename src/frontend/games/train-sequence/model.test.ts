import { describe, expect, it } from "vitest";
import { createTrainWagons, getNextTrainWagon, getOrderedTrainWagons, getPlacedTrainWagons, selectTrainWagon } from "./model";

describe("train-sequence model", () => {
  const fixedRandom = () => 0;

  it("creates a randomized wagon layout while preserving the numeric rule", () => {
    const wagons = createTrainWagons(fixedRandom);

    expect(wagons.map((wagon) => wagon.number)).toEqual([2, 3, 4, 5, 1]);
    expect(getOrderedTrainWagons(wagons).map((wagon) => wagon.number)).toEqual([1, 2, 3, 4, 5]);
    expect(getNextTrainWagon(wagons)?.id).toBe("red");
  });

  it("keeps correct numeric order independent of input order", () => {
    const wagons = createTrainWagons(fixedRandom).reverse();

    expect(getOrderedTrainWagons(wagons).map((wagon) => wagon.id)).toEqual(["red", "yellow", "green", "blue", "violet"]);
  });

  it("places a correct wagon and advances the expected wagon", () => {
    const outcome = selectTrainWagon(createTrainWagons(fixedRandom), "red");

    expect(outcome.kind).toBe("placed");
    if (outcome.kind !== "placed") return;
    expect(outcome.isCorrect).toBe(true);
    expect(outcome.selectedWagon.placedIndex).toBe(1);
    expect(getNextTrainWagon(outcome.wagons)?.id).toBe("yellow");
  });

  it("still places a wrong wagon and reports the expected wagon", () => {
    const outcome = selectTrainWagon(createTrainWagons(fixedRandom), "violet");

    expect(outcome.kind).toBe("placed");
    if (outcome.kind !== "placed") return;
    expect(outcome.isCorrect).toBe(false);
    expect(outcome.expectedWagon?.id).toBe("red");
    expect(outcome.selectedWagon.placedIndex).toBe(1);
  });

  it("ignores already placed wagons", () => {
    const first = selectTrainWagon(createTrainWagons(fixedRandom), "red");
    if (first.kind !== "placed") throw new Error("Expected first wagon placement.");

    expect(selectTrainWagon(first.wagons, "red")).toEqual({ kind: "ignored" });
  });

  it("completes after all wagons are placed in any order", () => {
    let wagons = createTrainWagons(fixedRandom);
    for (const wagonId of ["violet", "red", "green", "yellow", "blue"] as const) {
      const outcome = selectTrainWagon(wagons, wagonId);
      if (outcome.kind !== "placed") throw new Error(`Expected ${wagonId} placement.`);
      wagons = outcome.wagons;
    }

    expect(getPlacedTrainWagons(wagons).map((wagon) => wagon.id)).toEqual(["violet", "red", "green", "yellow", "blue"]);
    expect(wagons.every((wagon) => wagon.placed)).toBe(true);
  });
});
