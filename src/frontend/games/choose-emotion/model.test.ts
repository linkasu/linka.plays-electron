import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { chooseEmotionScenarios, generateChooseEmotionRound } from "./model";

describe("choose-emotion model", () => {
  it("uses two choices in gentle mode", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(2);
  });

  it("uses three choices in standard mode", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("standard"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in challenge mode", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("challenge"));

    expect(round.choices).toHaveLength(4);
  });

  it("points correctIndex to the target emotion", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("standard"), 4);

    expect(round.roundId).toBe("choose-emotion:round:4");
    expect(round.choices).toContain(round.target);
    expect(round.choices[round.correctIndex]).toBe(round.target);
  });

  it("does not duplicate emotions in one round", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("challenge"));
    const uniqueChoiceIds = new Set(round.choices.map((choice) => choice.id));

    expect(uniqueChoiceIds.size).toBe(round.choices.length);
  });

  it("cycles through situation and face prompts", () => {
    const firstRound = generateChooseEmotionRound(settingsFromPreset("standard"), 1);
    const faceRound = generateChooseEmotionRound(settingsFromPreset("standard"), 9);

    expect(firstRound.prompt).toBe(chooseEmotionScenarios[0].prompt);
    expect(faceRound.detail).toContain("эмоцию");
  });

  it("uses injected randomness for deterministic choices", () => {
    const settings = settingsFromPreset("standard");
    const first = generateChooseEmotionRound(settings, 1, () => 0).choices.map((choice) => choice.id);

    expect(generateChooseEmotionRound(settings, 1, () => 0).choices.map((choice) => choice.id)).toEqual(first);
    expect(generateChooseEmotionRound(settings, 1, () => 0.99).choices.map((choice) => choice.id)).not.toEqual(first);
  });
});
