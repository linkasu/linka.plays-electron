import { describe, expect, it } from "vitest";
import { arkanoidAssistChoiceOutcome, arkanoidAssistMaxMisses } from "./model";

describe("arkanoid assist model", () => {
  it("turns repeated wrong sectors into a lost ball", () => {
    expect(arkanoidAssistChoiceOutcome(true, arkanoidAssistMaxMisses)).toBe("hit");
    expect(arkanoidAssistChoiceOutcome(false, arkanoidAssistMaxMisses - 1)).toBe("miss");
    expect(arkanoidAssistChoiceOutcome(false, arkanoidAssistMaxMisses)).toBe("loss");
  });
});
