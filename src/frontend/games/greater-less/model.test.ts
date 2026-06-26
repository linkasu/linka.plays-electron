import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateGreaterLessRound, type GreaterLessRound } from "./model";

function expectedSide(round: GreaterLessRound) {
  if (round.comparison === "more") return round.left.count > round.right.count ? "left" : "right";
  return round.left.count < round.right.count ? "left" : "right";
}

describe("generateGreaterLessRound", () => {
  it("keeps gentle groups small and clearly different", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateGreaterLessRound(settings, index + 1);

      expect(round.left.count).toBeGreaterThanOrEqual(1);
      expect(round.left.count).toBeLessThanOrEqual(5);
      expect(round.right.count).toBeGreaterThanOrEqual(1);
      expect(round.right.count).toBeLessThanOrEqual(5);
      expect(Math.abs(round.left.count - round.right.count)).toBeGreaterThanOrEqual(2);
      expect(round.left.items).toHaveLength(round.left.count);
      expect(round.right.items).toHaveLength(round.right.count);
    }
  });

  it("uses different groups and computes the correct side", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateGreaterLessRound(settings, index + 1);

      expect(round.left.count).not.toBe(round.right.count);
      expect(Math.abs(round.left.count - round.right.count)).toBeGreaterThanOrEqual(1);
      expect(round.correctSide).toBe(expectedSide(round));
    }
  });

  it("alternates prompts by round index", () => {
    const settings = settingsFromPreset("standard");
    const first = generateGreaterLessRound(settings, 1);
    const second = generateGreaterLessRound(settings, 2);
    const third = generateGreaterLessRound(settings, 3);

    expect(first.prompt).toBe("Где больше?");
    expect(second.prompt).toBe("Где меньше?");
    expect(third.prompt).toBe(first.prompt);
  });

  it("uses injected randomness for counts and emoji", () => {
    const settings = settingsFromPreset("standard");
    const first = generateGreaterLessRound(settings, 1, () => 0);
    const again = generateGreaterLessRound(settings, 1, () => 0);

    expect(again.left.count).toBe(first.left.count);
    expect(again.right.count).toBe(first.right.count);
    expect(again.left.emoji).toBe(first.left.emoji);
  });
});
