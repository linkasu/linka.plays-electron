import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateShadowMatchRound } from "./model";

describe("shadow-match model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateShadowMatchRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in standard mode", () => {
    const round = generateShadowMatchRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the correct shadow", () => {
    const round = generateShadowMatchRound(settingsFromPreset("challenge"), 6);

    expect(round.roundId).toBe("shadow-match:round:6");
    expect(round.choices[round.correctIndex].isCorrect).toBe(true);
    expect(round.choices[round.correctIndex].imageSrc).toBe(
      `./images/shadow-match/${round.target.id}-shadow.png`,
    );
  });

  it("uses separate artwork for the object and its shadows", () => {
    const round = generateShadowMatchRound(settingsFromPreset("standard"), 3);

    expect(round.target.imageSrc).toBe("./images/shadow-match/cat.png");
    expect(round.target.imageSrc).not.toBe(round.choices[round.correctIndex].imageSrc);
    // Wrong choices are the shadows of other objects, each one different.
    const wrong = round.choices.filter((choice) => !choice.isCorrect);
    expect(wrong.every((choice) => !choice.imageSrc.includes(`/${round.target.id}-shadow`))).toBe(
      true,
    );
    expect(new Set(round.choices.map((choice) => choice.imageSrc)).size).toBe(round.choices.length);
    expect(round.target.hint.length).toBeGreaterThan(0);
  });

  it("cycles through all supplied objects", () => {
    const targetIds = Array.from(
      { length: 16 },
      (_, index) => generateShadowMatchRound(settingsFromPreset("standard"), index + 1).target.id,
    );

    expect(new Set(targetIds).size).toBe(8);
    expect(targetIds.slice(0, 8)).toEqual(targetIds.slice(8));
  });
});
