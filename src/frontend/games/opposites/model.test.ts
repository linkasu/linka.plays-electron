import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateOppositesRound, oppositePairs } from "./model";

describe("opposites model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateOppositesRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four unique choices in standard mode", () => {
    const round = generateOppositesRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the opposite concept", () => {
    const round = generateOppositesRound(settingsFromPreset("challenge"), 7);
    const pair = oppositePairs.find((item) => item.id === round.pairId);

    expect(round.roundId).toBe("opposites:round:7");
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(pair?.concepts).toContain(round.source);
    expect(pair?.concepts).toContain(round.target);
    expect(round.source.id).not.toBe(round.target.id);
  });

  it("includes the source word and target hint in texts", () => {
    const round = generateOppositesRound(settingsFromPreset("standard"));

    expect(round.prompt).toContain(round.source.label);
    expect(round.mistakeHint).toContain(round.source.label);
    expect(round.mistakeHint).toContain(round.target.label);
  });
});
