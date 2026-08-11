import { describe, expect, it } from "vitest";
import { ambientStepTargetMs } from "./ambientProgress";

describe("ambient progress", () => {
  it("makes every stage reachable before the session timeout", () => {
    const stepMs = ambientStepTargetMs(90, 8);
    expect(stepMs * 8).toBe(81_000);
    expect(stepMs * 8).toBeLessThan(90_000);
  });

  it("keeps invalid inputs finite", () => {
    expect(ambientStepTargetMs(0, 0)).toBeGreaterThan(0);
  });
});
