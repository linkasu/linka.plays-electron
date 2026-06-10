import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateColorShapeRound, getColorShapeMismatch } from "./model";

describe("color-shape model", () => {
  it("scales choice count by preset", () => {
    expect(generateColorShapeRound(settingsFromPreset("gentle")).choices).toHaveLength(3);
    expect(generateColorShapeRound(settingsFromPreset("standard")).choices).toHaveLength(4);
    expect(generateColorShapeRound(settingsFromPreset("challenge")).choices).toHaveLength(5);
  });

  it("includes one target and points correctIndex to it", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 8; index += 1) {
      const round = generateColorShapeRound(settings, index);
      const targetMatches = round.choices.filter((choice) => choice.id === round.target.id);

      expect(round.roundId).toBe(`color-shape:round:${index}`);
      expect(round.prompt).toBe(`Найди ${round.target.label}`);
      expect(targetMatches).toHaveLength(1);
      expect(round.choices[round.correctIndex]).toBe(round.target);
    }
  });

  it("always offers single-trait distractors", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 12; index += 1) {
      const round = generateColorShapeRound(settings, index);
      const mismatches = round.choices.filter((choice) => choice.id !== round.target.id).map((choice) => getColorShapeMismatch(choice, round.target).join("+"));

      expect(mismatches).toContain("color");
      expect(mismatches).toContain("shape");
    }
  });

  it("describes which traits differ from the target", () => {
    const round = generateColorShapeRound(settingsFromPreset("challenge"), 1);
    const wrongColor = round.choices.find((choice) => choice.shape.id === round.target.shape.id && choice.color.id !== round.target.color.id);
    const wrongShape = round.choices.find((choice) => choice.color.id === round.target.color.id && choice.shape.id !== round.target.shape.id);
    const wrongBoth = round.choices.find((choice) => choice.color.id !== round.target.color.id && choice.shape.id !== round.target.shape.id);

    expect(wrongColor && getColorShapeMismatch(wrongColor, round.target)).toEqual(["color"]);
    expect(wrongShape && getColorShapeMismatch(wrongShape, round.target)).toEqual(["shape"]);
    expect(wrongBoth && getColorShapeMismatch(wrongBoth, round.target)).toEqual(["color", "shape"]);
  });
});
