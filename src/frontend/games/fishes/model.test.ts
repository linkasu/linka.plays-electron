import { describe, expect, it } from "vitest";
import { fishTravelSpeed } from "./model";

describe("fishes model", () => {
  it("applies configured motion and progression without an extra speed multiplier", () => {
    expect(fishTravelSpeed(30, 0.62, 1.2, 1)).toBeCloseTo(30 * 0.62 * 1.2 * 1.12);
  });
});
