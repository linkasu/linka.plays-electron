import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { createMosaicStep, getMosaicPattern } from "./model";

describe("mosaic model", () => {
  it("builds an eight-slot therapy pattern for the game settings", () => {
    const pattern = getMosaicPattern({ ...settingsFromPreset("standard"), maxSteps: 8 });

    expect(pattern).toHaveLength(8);
    expect(pattern.map((tile) => tile.id)).toEqual([
      "red-circle",
      "blue-square",
      "yellow-triangle",
      "green-circle",
      "red-diamond",
      "blue-hexagon",
      "purple-star",
      "orange-square"
    ]);
  });

  it("creates unique choices and includes the target tile", () => {
    const settings = { ...settingsFromPreset("standard"), maxSteps: 8 };

    for (let stepIndex = 0; stepIndex < 8; stepIndex += 1) {
      const step = createMosaicStep(settings, stepIndex);
      const choiceIds = step.choices.map((choice) => choice.id);

      expect(step.roundId).toBe(`mosaic:round:${stepIndex + 1}`);
      expect(step.slotIndex).toBe(stepIndex);
      expect(step.choices).toHaveLength(4);
      expect(new Set(choiceIds).size).toBe(4);
      expect(choiceIds).toContain(step.target.id);
      expect(step.choices[step.correctIndex]).toBe(step.target);
      expect(step.prompt).toContain(step.target.label);
    }
  });

  it("uses three choices in gentle preset", () => {
    const step = createMosaicStep({ ...settingsFromPreset("gentle"), maxSteps: 8 }, 2);

    expect(step.choices).toHaveLength(3);
    expect(step.choices.map((choice) => choice.id)).toContain(step.target.id);
  });
});
