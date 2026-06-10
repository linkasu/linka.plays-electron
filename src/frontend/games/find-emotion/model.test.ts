import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateFindEmotionRound } from "./model";

describe("find-emotion model", () => {
  it("uses two choices in gentle mode", () => {
    const round = generateFindEmotionRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(2);
  });

  it("uses three choices in standard mode", () => {
    const round = generateFindEmotionRound(settingsFromPreset("standard"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in challenge mode", () => {
    const round = generateFindEmotionRound(settingsFromPreset("challenge"));

    expect(round.choices).toHaveLength(4);
  });

  it("includes the target and points correctIndex to it", () => {
    const round = generateFindEmotionRound(settingsFromPreset("standard"), 6);

    expect(round.roundId).toBe("find-emotion:round:6");
    expect(round.choices).toContain(round.target);
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(round.prompt).toBe(`Найди эмоцию: ${round.target.label}`);
  });

  it("does not duplicate emotions in one round", () => {
    const round = generateFindEmotionRound(settingsFromPreset("challenge"));
    const uniqueChoiceIds = new Set(round.choices.map((choice) => choice.id));

    expect(uniqueChoiceIds.size).toBe(round.choices.length);
  });
});
