import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateOppositesRound, oppositePairs } from "./model";

describe("opposites model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateOppositesRound(settingsFromPreset("gentle"), 1, () => 0);

    expect(round.choices).toHaveLength(3);
  });

  it("uses four unique choices in standard mode", () => {
    const round = generateOppositesRound(settingsFromPreset("standard"), 1, () => 0.75);
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the opposite concept", () => {
    const round = generateOppositesRound(settingsFromPreset("challenge"), 7, () => 0.25);
    const pair = oppositePairs.find((item) => item.id === round.pairId);

    expect(round.roundId).toBe("opposites:round:7");
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(pair?.concepts).toContain(round.source);
    expect(pair?.concepts).toContain(round.target);
    expect(round.source.id).not.toBe(round.target.id);
  });

  it("includes the source word without storing an answer-revealing hint", () => {
    const round = generateOppositesRound(settingsFromPreset("standard"), 1, () => 0.5);

    expect(round.prompt).toBe(`Найди противоположность слову «${round.source.label}»`);
    expect("mistakeHint" in round).toBe(false);
  });

  it("uses complete labels and two states of one visual referent in every pair", () => {
    for (const pair of oppositePairs) {
      expect(pair.concepts.every((item) => item.label.trim().length > 0)).toBe(true);
      expect(new Set(pair.concepts.map((item) => item.referenceId)).size).toBe(1);
      expect(new Set(pair.concepts.map((item) => item.visualState)).size).toBe(2);
      expect(new Set(pair.concepts.map((item) => item.assetId)).size).toBe(1);
    }

    expect(oppositePairs.find((pair) => pair.id === "speed")?.concepts[1].label).toBe("медленный");
  });

  it("uses the random source for pair and source side", () => {
    const lowRandomRound = generateOppositesRound(settingsFromPreset("standard"), 1, () => 0);
    const highRandomRound = generateOppositesRound(settingsFromPreset("standard"), 1, () => 0.99);

    expect(lowRandomRound.pairId).not.toBe(highRandomRound.pairId);
    expect(lowRandomRound.source.id).not.toBe(lowRandomRound.target.id);
    expect(highRandomRound.source.id).not.toBe(highRandomRound.target.id);
  });
});
