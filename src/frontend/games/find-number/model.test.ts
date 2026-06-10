import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateFindNumberRound } from "./model";

describe("find-number model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateFindNumberRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in standard mode", () => {
    const round = generateFindNumberRound(settingsFromPreset("standard"));

    expect(round.choices).toHaveLength(4);
  });

  it("uses six choices in challenge mode", () => {
    const round = generateFindNumberRound(settingsFromPreset("challenge"));

    expect(round.choices).toHaveLength(6);
  });

  it("includes the correct digit and points correctIndex to it", () => {
    const round = generateFindNumberRound(settingsFromPreset("standard"), 5);

    expect(round.roundId).toBe("find-number:round:5");
    expect(round.choices).toContain(round.target);
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(round.prompt).toBe(`Найди цифру ${round.target.label}`);
  });

  it("keeps every shown digit unique", () => {
    const round = generateFindNumberRound(settingsFromPreset("challenge"));
    const targetMatches = round.choices.filter((choice) => choice.id === round.target.id);
    const uniqueChoiceIds = new Set(round.choices.map((choice) => choice.id));

    expect(targetMatches).toHaveLength(1);
    expect(uniqueChoiceIds.size).toBe(round.choices.length);
    expect(round.choices.every((choice) => choice.digit >= 0 && choice.digit <= 9)).toBe(true);
  });
});
