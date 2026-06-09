import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateFindColorRound } from "./model";

describe("find-color model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateFindColorRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in standard mode", () => {
    const round = generateFindColorRound(settingsFromPreset("standard"));

    expect(round.choices).toHaveLength(4);
  });

  it("includes the correct option and points correctIndex to it", () => {
    const round = generateFindColorRound(settingsFromPreset("challenge"), 5);

    expect(round.roundId).toBe("find-color:round:5");
    expect(round.choices).toContain(round.target);
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(round.prompt).toBe(`Найди ${round.target.label}`);
  });

  it("does not repeat the target among distractors", () => {
    const round = generateFindColorRound(settingsFromPreset("standard"));
    const targetMatches = round.choices.filter((choice) => choice.id === round.target.id);
    const uniqueChoiceIds = new Set(round.choices.map((choice) => choice.id));

    expect(targetMatches).toHaveLength(1);
    expect(uniqueChoiceIds.size).toBe(round.choices.length);
  });
});
