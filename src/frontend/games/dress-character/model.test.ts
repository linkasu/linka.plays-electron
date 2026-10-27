import { describe, expect, it } from "vitest";
import {
  clothingSlots,
  dressCharacterKitIndex,
  dressCharacterMaxSteps,
  dressCharacterWeatherKits,
  dressedChildArtId,
  getDressCharacterExpectedItem,
  getDressCharacterKit,
  getDressCharacterTask,
  isDressCharacterKitCompleteStep,
} from "./model";

describe("dress-character model", () => {
  it("picks the dressed drawing by kit and number of items put on", () => {
    expect(dressedChildArtId("cold", 0)).toBe("dress-character/worn/base");
    expect(dressedChildArtId("rain", 2)).toBe("dress-character/worn/rain-2");
    expect(dressedChildArtId("sun", 4)).toBe("dress-character/worn/sun-4");
    expect(dressedChildArtId("sun", 7)).toBe("dress-character/worn/sun-4");
  });

  it("keeps three weather kits with hat, jacket, pants and shoes tasks", () => {
    expect(dressCharacterWeatherKits.map((kit) => kit.id)).toEqual(["cold", "rain", "sun"]);
    expect(clothingSlots).toEqual(["hat", "jacket", "pants", "shoes"]);
    for (const kit of dressCharacterWeatherKits) {
      expect(kit.items.map((item) => item.slot)).toEqual(clothingSlots);
      expect(
        kit.items.every((item) => item.prompt && item.target && item.choices.length === 3),
      ).toBe(true);
      for (const task of kit.items) {
        expect(
          task.choices.every(
            (choice) =>
              choice.slot === task.slot && choice.label && choice.color && choice.darkColor,
          ),
        ).toBe(true);
        expect(task.choices.some((choice) => choice.id === task.target.id)).toBe(true);
      }
    }
  });

  it("maps session steps to weather kits and expected clothing", () => {
    expect(dressCharacterMaxSteps()).toBe(12);
    expect(dressCharacterKitIndex(0)).toBe(0);
    expect(dressCharacterKitIndex(4)).toBe(1);
    expect(dressCharacterKitIndex(8)).toBe(2);

    expect(getDressCharacterKit(0).id).toBe("cold");
    expect(getDressCharacterKit(4).id).toBe("rain");
    expect(getDressCharacterKit(8).id).toBe("sun");
    expect(getDressCharacterExpectedItem(0).slot).toBe("hat");
    expect(getDressCharacterExpectedItem(1).slot).toBe("jacket");
    expect(getDressCharacterExpectedItem(2).slot).toBe("pants");
    expect(getDressCharacterExpectedItem(2).label).toBe("Тёплые штаны");
    expect(getDressCharacterExpectedItem(6).label).toBe("Непромокаемые штаны");
    expect(getDressCharacterExpectedItem(10).label).toBe("Шорты");
    expect(getDressCharacterExpectedItem(3).slot).toBe("shoes");
    const correctIndexes = Array.from({ length: dressCharacterMaxSteps() }, (_, step) => {
      const task = getDressCharacterTask(step);
      return task.choices.findIndex((choice) => choice.id === task.target.id);
    });
    expect(new Set(correctIndexes).size).toBeGreaterThan(1);
  });

  it("marks only the shoe step as a completed kit", () => {
    expect([0, 1, 2, 4, 5, 6, 8, 9, 10].map(isDressCharacterKitCompleteStep)).toEqual(
      Array(9).fill(false),
    );
    expect([3, 7, 11].map(isDressCharacterKitCompleteStep)).toEqual([true, true, true]);
  });
});
