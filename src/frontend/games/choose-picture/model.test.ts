import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { choosePictureInstruction, generateChoosePictureRound } from "./model";

describe("choose-picture model", () => {
  it("uses two choices in gentle mode", () => {
    const round = generateChoosePictureRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(2);
  });

  it("uses three unique choices in standard mode", () => {
    const round = generateChoosePictureRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(3);
    expect(ids.size).toBe(3);
  });

  it("uses four choices in challenge mode", () => {
    expect(generateChoosePictureRound(settingsFromPreset("challenge")).choices).toHaveLength(4);
  });

  it("points correctIndex to the target and includes the target word in prompt", () => {
    const round = generateChoosePictureRound(settingsFromPreset("challenge"), 3);

    expect(round.roundId).toBe("choose-picture:round:3");
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(round.prompt).toContain(round.target.word);
  });

  it("uses the reading-mode instruction verbatim", () => {
    expect(choosePictureInstruction).toBe("Прочитай фразу и найди нужную картинку");
  });

  it("uses injected randomness for deterministic target and choices", () => {
    const settings = settingsFromPreset("standard");
    const first = generateChoosePictureRound(settings, 1, () => 0);

    expect(generateChoosePictureRound(settings, 1, () => 0).choices.map((choice) => choice.id)).toEqual(first.choices.map((choice) => choice.id));
    expect(generateChoosePictureRound(settings, 1, () => 0.99).target.id).not.toBe(first.target.id);
  });
});
