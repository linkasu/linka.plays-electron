import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { correctScalesAnswer, generateScalesRound } from "./model";

describe("generateScalesRound", () => {
  it("computes heavier, lighter and equal answers", () => {
    expect(correctScalesAnswer("heavier", 5, 2)).toBe("left");
    expect(correctScalesAnswer("heavier", 2, 5)).toBe("right");
    expect(correctScalesAnswer("lighter", 2, 5)).toBe("left");
    expect(correctScalesAnswer("lighter", 5, 2)).toBe("right");
    expect(correctScalesAnswer("heavier", 3, 3)).toBe("equal");
    expect(correctScalesAnswer("lighter", 3, 3)).toBe("equal");
  });

  it("keeps gentle weights small and clear", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateScalesRound(settings, index + 1);

      expect(round.left.weight).toBeGreaterThanOrEqual(1);
      expect(round.left.weight).toBeLessThanOrEqual(5);
      expect(round.right.weight).toBeGreaterThanOrEqual(1);
      expect(round.right.weight).toBeLessThanOrEqual(5);
      expect(round.left.items).toHaveLength(round.left.weight);
      expect(round.right.items).toHaveLength(round.right.weight);
      if (round.correctAnswer !== "equal") expect(Math.abs(round.left.weight - round.right.weight)).toBeGreaterThanOrEqual(2);
    }
  });

  it("alternates the prompt and includes equal rounds", () => {
    const settings = settingsFromPreset("standard");
    const first = generateScalesRound(settings, 1);
    const second = generateScalesRound(settings, 2);
    const fourth = generateScalesRound(settings, 4);

    expect(first.prompt).toBe("Какая сторона тяжелее?");
    expect(second.prompt).toBe("Какая сторона легче?");
    expect(fourth.left.weight).toBe(fourth.right.weight);
    expect(fourth.correctAnswer).toBe("equal");
    expect(fourth.tiltDeg).toBe(0);
  });

  it("keeps the tilt consistent with the heavier side", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateScalesRound(settings, index + 1);

      expect(round.correctAnswer).toBe(correctScalesAnswer(round.question, round.left.weight, round.right.weight));
      if (round.left.weight > round.right.weight) expect(round.tiltDeg).toBeLessThan(0);
      if (round.left.weight < round.right.weight) expect(round.tiltDeg).toBeGreaterThan(0);
      if (round.left.weight === round.right.weight) expect(round.tiltDeg).toBe(0);
    }
  });

  it("uses injected randomness for pan weights and emoji", () => {
    const settings = settingsFromPreset("standard");
    const first = generateScalesRound(settings, 1, () => 0);
    const again = generateScalesRound(settings, 1, () => 0);

    expect(again.left.weight).toBe(first.left.weight);
    expect(again.right.weight).toBe(first.right.weight);
    expect(again.left.emoji).toBe(first.left.emoji);
  });
});
