import { describe, expect, it } from "vitest";
import { stepPongChoiceOutcome, stepPongMaxMisses } from "./model";

describe("step pong model", () => {
  it("turns repeated wrong lanes into a missed ball", () => {
    expect(stepPongChoiceOutcome(true, stepPongMaxMisses)).toBe("return");
    expect(stepPongChoiceOutcome(false, stepPongMaxMisses - 1)).toBe("miss");
    expect(stepPongChoiceOutcome(false, stepPongMaxMisses)).toBe("loss");
  });
});
