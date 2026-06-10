import { describe, expect, it } from "vitest";
import { tanksNoShootingChoiceOutcome, tanksNoShootingMaxWrongTurns } from "./model";

describe("tanks no shooting model", () => {
  it("turns repeated wrong turns into a route loss", () => {
    expect(tanksNoShootingChoiceOutcome("right", "right", tanksNoShootingMaxWrongTurns)).toBe("advance");
    expect(tanksNoShootingChoiceOutcome("left", "right", tanksNoShootingMaxWrongTurns - 1)).toBe("wrong-turn");
    expect(tanksNoShootingChoiceOutcome("left", "right", tanksNoShootingMaxWrongTurns)).toBe("loss");
  });
});
