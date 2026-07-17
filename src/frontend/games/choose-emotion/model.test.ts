import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { chooseEmotionFacePrompt, chooseEmotionFaceScenarios, chooseEmotionFaces, chooseEmotionSituationScenarios, createChooseEmotionRoundGenerator, generateChooseEmotionRound, type ChooseEmotionMode } from "./model";

describe("choose-emotion model", () => {
  it("uses two choices in gentle mode", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("gentle"), "face");

    expect(round.choices).toHaveLength(2);
  });

  it("uses three choices in standard mode", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("standard"), "face");

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in challenge mode", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("challenge"), "face");

    expect(round.choices).toHaveLength(4);
  });

  it("points correctIndex to the target emotion", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("standard"), "situation", 4);

    expect(round.roundId).toBe("choose-emotion:round:4");
    expect(round.choices).toContain(round.target);
    expect(round.choices[round.correctIndex]).toBe(round.target);
  });

  it("does not duplicate emotions in one round", () => {
    const round = generateChooseEmotionRound(settingsFromPreset("challenge"), "situation");
    const uniqueChoiceIds = new Set(round.choices.map((choice) => choice.id));

    expect(uniqueChoiceIds.size).toBe(round.choices.length);
  });

  it("keeps face and situation modes separate", () => {
    const faceRounds = chooseEmotionFaceScenarios.map((_, index) => generateChooseEmotionRound(settingsFromPreset("standard"), "face", index + 1));
    const situationRounds = chooseEmotionSituationScenarios.map((_, index) => generateChooseEmotionRound(settingsFromPreset("standard"), "situation", index + 1));

    expect(faceRounds.every((round) => round.mode === "face")).toBe(true);
    expect(situationRounds.every((round) => round.mode === "situation")).toBe(true);
    expect(new Set(faceRounds.map((round) => round.scenarioId))).toEqual(new Set(chooseEmotionFaceScenarios.map((scenario) => scenario.id)));
    expect(new Set(situationRounds.map((round) => round.scenarioId))).toEqual(new Set(chooseEmotionSituationScenarios.map((scenario) => scenario.id)));
  });

  it("uses the exact child-facing prompt and the shared face visuals", () => {
    expect(chooseEmotionFacePrompt).toBe("Что чувствует лицо?");
    expect(chooseEmotionFaceScenarios).toHaveLength(chooseEmotionFaces.length);

    for (const scenario of chooseEmotionFaceScenarios) {
      const face = chooseEmotionFaces.find((candidate) => candidate.id === scenario.targetId);
      expect(scenario.prompt).toBe(chooseEmotionFacePrompt);
      expect(scenario.cueEmoji).toBe(face?.emoji);
    }
  });

  it.each<ChooseEmotionMode>(["face", "situation"])("deals the complete %s deck without repeats", (mode) => {
    const generateRound = createChooseEmotionRoundGenerator(mode, () => 0.37);
    const rounds = Array.from({ length: chooseEmotionFaces.length }, (_, index) => generateRound(settingsFromPreset("standard"), index + 1));

    expect(new Set(rounds.map((round) => round.scenarioId))).toHaveLength(rounds.length);
  });

  it("balances the correct answer across left, center, and right", () => {
    const generateRound = createChooseEmotionRoundGenerator("face", () => 0.37);
    const positions = Array.from({ length: 6 }, (_, index) => generateRound(settingsFromPreset("standard"), index + 1).correctIndex);

    expect(new Set(positions.slice(0, 3))).toEqual(new Set([0, 1, 2]));
    expect(new Set(positions.slice(3, 6))).toEqual(new Set([0, 1, 2]));
  });

  it("balances challenge positions by visual zone and alternates both center slots", () => {
    const generateRound = createChooseEmotionRoundGenerator("face", () => 0.37);
    const positions = Array.from({ length: 6 }, (_, index) => generateRound(settingsFromPreset("challenge"), index + 1).correctIndex);
    const zones = positions.map((position) => position === 0 ? "left" : position === 3 ? "right" : "center");

    expect(new Set(zones.slice(0, 3))).toEqual(new Set(["left", "center", "right"]));
    expect(new Set(zones.slice(3, 6))).toEqual(new Set(["left", "center", "right"]));
    expect(positions.filter((position) => position === 1 || position === 2)).toEqual(expect.arrayContaining([1, 2]));
  });

  it("uses injected randomness for deterministic choices", () => {
    const settings = settingsFromPreset("standard");
    const first = generateChooseEmotionRound(settings, "situation", 1, () => 0).choices.map((choice) => choice.id);

    expect(generateChooseEmotionRound(settings, "situation", 1, () => 0).choices.map((choice) => choice.id)).toEqual(first);
    expect(generateChooseEmotionRound(settings, "situation", 1, () => 0.99).choices.map((choice) => choice.id)).not.toEqual(first);
  });
});
