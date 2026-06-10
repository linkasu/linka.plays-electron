import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateWhoIsThisRound, whoIsThisVocabulary } from "./model";

describe("who-is-this model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateWhoIsThisRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four unique choices in standard mode", () => {
    const round = generateWhoIsThisRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the target and cycles vocabulary by round", () => {
    const round = generateWhoIsThisRound(settingsFromPreset("challenge"), 3);

    expect(round.roundId).toBe("who-is-this:round:3");
    expect(round.target).toBe(whoIsThisVocabulary[2]);
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(round.prompt).toContain("Кто это");
  });
});
