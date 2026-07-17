import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { mosaicImages } from "./images";
import { createMosaicStep, createMosaicTiles, getMosaicImage, isMosaicChoiceCorrect, mosaicTileCount, selectMosaicImageIndex } from "./model";

describe("mosaic model", () => {
  it("creates a stable 3x3 tile map for an image", () => {
    const image = getMosaicImage(0);
    const tiles = createMosaicTiles(image);

    expect(tiles).toHaveLength(9);
    expect(tiles.map((tile) => tile.slotIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(tiles.map((tile) => [tile.row, tile.col])).toEqual([
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2]
    ]);
  });

  it("cycles configured mosaic images", () => {
    expect(getMosaicImage(0)).toBe(mosaicImages[0]);
    expect(getMosaicImage(mosaicImages.length)).toBe(mosaicImages[0]);
    expect(getMosaicImage(-1)).toBe(mosaicImages[mosaicImages.length - 1]);
  });

  it("selects an image index with injected random", () => {
    expect(selectMosaicImageIndex(() => 0)).toBe(0);
    expect(selectMosaicImageIndex(() => 0.999)).toBe(mosaicImages.length - 1);
  });

  it("creates unique choices and includes target piece", () => {
    const settings = { ...settingsFromPreset("standard"), maxSteps: mosaicTileCount };

    for (let stepIndex = 0; stepIndex < mosaicTileCount; stepIndex += 1) {
      const step = createMosaicStep(settings, stepIndex, 0);
      const choiceIds = step.choices.map((choice) => choice.id);

      expect(step.slotIndex).toBe(stepIndex);
      expect(step.target.slotIndex).toBe(stepIndex);
      expect(step.choices).toHaveLength(4);
      expect(new Set(choiceIds).size).toBe(4);
      expect(choiceIds).toContain(step.target.id);
      expect(step.choices[step.correctIndex]).toBe(step.target);
      expect(step.prompt).not.toMatch(/[1-9]/);
      expect(step.hint).not.toMatch(/[1-9]/);
      step.choices.forEach((choice) => expect(choice).not.toHaveProperty("label"));
    }
  });

  it("uses three choices in gentle preset", () => {
    const step = createMosaicStep({ ...settingsFromPreset("gentle"), maxSteps: mosaicTileCount }, 2, 1);

    expect(step.choices).toHaveLength(3);
    expect(step.choices.map((choice) => choice.id)).toContain(step.target.id);
  });

  it("checks correct tile identity", () => {
    const step = createMosaicStep({ ...settingsFromPreset("standard"), maxSteps: mosaicTileCount }, 0, 0);

    expect(isMosaicChoiceCorrect(step.target, step.target)).toBe(true);
    expect(isMosaicChoiceCorrect(step.choices.find((choice) => choice.id !== step.target.id)!, step.target)).toBe(false);
  });
});
