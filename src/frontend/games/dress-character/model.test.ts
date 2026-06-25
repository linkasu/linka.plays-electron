import { describe, expect, it } from "vitest";
import { clothingSlots, dressCharacterKitIndex, dressCharacterMaxSteps, dressCharacterWeatherKits, getDressCharacterExpectedItem, getDressCharacterKit, getDressCharacterTask, isDressCharacterKitCompleteStep } from "./model";

describe("dress-character model", () => {
  it("keeps three weather kits with hat, jacket and shoes tasks", () => {
    expect(dressCharacterWeatherKits.map((kit) => kit.id)).toEqual(["cold", "rain", "sun"]);
    expect(clothingSlots).toEqual(["hat", "jacket", "shoes"]);
    for (const kit of dressCharacterWeatherKits) {
      expect(kit.items.map((item) => item.slot)).toEqual(clothingSlots);
      expect(kit.items.every((item) => item.prompt && item.target && item.choices.length === 3)).toBe(true);
      for (const task of kit.items) {
        expect(task.choices.every((choice) => choice.slot === task.slot && choice.label && choice.color && choice.darkColor)).toBe(true);
        expect(task.choices.some((choice) => choice.id === task.target.id)).toBe(true);
      }
    }
  });

  it("maps session steps to weather kits and expected clothing", () => {
    expect(dressCharacterMaxSteps()).toBe(9);
    expect(dressCharacterKitIndex(0)).toBe(0);
    expect(dressCharacterKitIndex(3)).toBe(1);
    expect(dressCharacterKitIndex(6)).toBe(2);

    expect(getDressCharacterKit(0).id).toBe("cold");
    expect(getDressCharacterKit(3).id).toBe("rain");
    expect(getDressCharacterKit(6).id).toBe("sun");
    expect(getDressCharacterExpectedItem(0).slot).toBe("hat");
    expect(getDressCharacterExpectedItem(1).slot).toBe("jacket");
    expect(getDressCharacterExpectedItem(2).slot).toBe("shoes");
    expect(getDressCharacterTask(0).choices.map((choice) => choice.label)).toEqual(["Шапка", "Кепка", "Шляпа"]);
  });

  it("marks only the shoe step as a completed kit", () => {
    expect([0, 1, 3, 4, 6, 7].map(isDressCharacterKitCompleteStep)).toEqual([false, false, false, false, false, false]);
    expect([2, 5, 8].map(isDressCharacterKitCompleteStep)).toEqual([true, true, true]);
  });
});
