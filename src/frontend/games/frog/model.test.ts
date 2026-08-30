import { describe, expect, it } from "vitest";
import { frogProgression } from "./model";

describe("frog progression", () => {
  it("depends only on successful catches", () => {
    expect(frogProgression(0)).toEqual({
      activeBugLimit: 1,
      spawnDelaySeconds: 2,
      speedMultiplier: 1,
    });
    expect(frogProgression(4).activeBugLimit).toBe(2);
    expect(frogProgression(10).speedMultiplier).toBeGreaterThan(1);
  });

  it("clamps invalid success counts", () => {
    expect(frogProgression(-10)).toEqual(frogProgression(0));
  });
});
