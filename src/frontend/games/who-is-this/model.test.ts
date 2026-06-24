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

  it("points correctIndex to the target and uses the random source", () => {
    const lowRandomRound = generateWhoIsThisRound(settingsFromPreset("challenge"), 1, () => 0);
    const highRandomRound = generateWhoIsThisRound(settingsFromPreset("challenge"), 1, () => 0.99);

    expect(lowRandomRound.roundId).toBe("who-is-this:round:1");
    expect(lowRandomRound.choices[lowRandomRound.correctIndex]).toBe(lowRandomRound.target);
    expect(highRandomRound.choices[highRandomRound.correctIndex]).toBe(highRandomRound.target);
    expect(lowRandomRound.target.id).not.toBe(highRandomRound.target.id);
    expect(lowRandomRound.prompt).toContain("Кто это");
    expect(whoIsThisVocabulary.some((choice) => choice.id === lowRandomRound.target.id)).toBe(true);
  });
});
