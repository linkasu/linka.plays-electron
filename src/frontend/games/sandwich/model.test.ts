import { describe, expect, it } from "vitest";
import { buildSandwichSteps } from "./model";

describe("sandwich model", () => {
  it("builds the default six-step therapy sequence", () => {
    const steps = buildSandwichSteps();

    expect(steps).toHaveLength(6);
    expect(steps.map((step) => step.kind)).toEqual(["bread", "filling", "top-bread", "bread", "filling", "top-bread"]);
  });

  it("keeps generated sessions in the supported six to eight step range", () => {
    expect(buildSandwichSteps(4)).toHaveLength(6);
    expect(buildSandwichSteps(7)).toHaveLength(7);
    expect(buildSandwichSteps(12)).toHaveLength(8);
  });

  it("uses stable telemetry ids and round ids", () => {
    const steps = buildSandwichSteps(8);

    expect(steps.map((step) => step.id)).toEqual([
      "sandwich-step-1",
      "sandwich-step-2",
      "sandwich-step-3",
      "sandwich-step-4",
      "sandwich-step-5",
      "sandwich-step-6",
      "sandwich-step-7",
      "sandwich-step-8"
    ]);
    expect(steps[4].roundId).toBe("sandwich:round:5");
  });

  it("starts every sandwich with bread before filling and top bread", () => {
    const steps = buildSandwichSteps(8);

    for (let index = 0; index < steps.length; index += 1) {
      const expectedKind = ["bread", "filling", "top-bread"][index % 3];

      expect(steps[index].kind).toBe(expectedKind);
      expect(steps[index].sandwichIndex).toBe(Math.floor(index / 3));
    }
  });
});
