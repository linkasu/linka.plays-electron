import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateWordCategoriesRound, getWordCategory, wordCategories } from "./model";

describe("generateWordCategoriesRound", () => {
  it("keeps the selected rule for the whole session", () => {
    const settings = settingsFromPreset("standard");

    expect([1, 2, 3].map((roundIndex) => generateWordCategoriesRound(settings, "item-to-category", roundIndex).mode)).toEqual(["item-to-category", "item-to-category", "item-to-category"]);
    expect([1, 2, 3].map((roundIndex) => generateWordCategoriesRound(settings, "category-to-item", roundIndex).mode)).toEqual(["category-to-item", "category-to-item", "category-to-item"]);
  });

  it("builds item-to-category rounds with one correct category", () => {
    const round = generateWordCategoriesRound(settingsFromPreset("challenge"), "item-to-category", 1);
    const category = getWordCategory(round.targetItem.category);

    expect(round.mode).toBe("item-to-category");
    expect(category).toBeDefined();
    expect(round.correctChoiceId).toBe(category?.id);
    expect(round.choices).toHaveLength(wordCategories.length);
    expect(round.choices[round.correctIndex].id).toBe(round.correctChoiceId);
  });

  it("builds category-to-item rounds with distractors from other categories", () => {
    const round = generateWordCategoriesRound(settingsFromPreset("challenge"), "category-to-item", 2);

    expect(round.mode).toBe("category-to-item");
    expect(round.correctChoiceId).toBe(round.targetItem.id);
    expect(round.targetItem.category).toBe(round.targetCategory.id);
    expect(round.choices).toHaveLength(4);
    expect(round.choices[round.correctIndex].id).toBe(round.correctChoiceId);
    expect(round.choices.filter((choice) => "category" in choice && choice.category === round.targetCategory.id)).toHaveLength(1);
  });

  it("keeps round ids stable for telemetry", () => {
    expect(generateWordCategoriesRound(settingsFromPreset("standard"), "item-to-category", 8).roundId).toBe("word-categories:round:8");
  });

  it("uses complete and distinct prompts for both rules", () => {
    const settings = settingsFromPreset("standard");
    const itemRound = generateWordCategoriesRound(settings, "item-to-category", 1);
    const categoryRound = generateWordCategoriesRound(settings, "category-to-item", 1);

    expect(itemRound.prompt).toBe(`К какой категории относится «${itemRound.targetItem.word}»?`);
    expect(categoryRound.prompt).toBe(`Какой предмет относится к категории «${categoryRound.targetCategory.title}»?`);
    expect(itemRound.instruction).toBe("Предмет → категория");
    expect(categoryRound.instruction).toBe("Категория → предмет");
  });

  it.each([
    ["gentle", 2],
    ["standard", 3],
    ["challenge", 4]
  ] as const)("uses %s choice count", (preset, expectedCount) => {
    const settings = settingsFromPreset(preset);

    expect(generateWordCategoriesRound(settings, "item-to-category").choices).toHaveLength(expectedCount);
    expect(generateWordCategoriesRound(settings, "category-to-item").choices).toHaveLength(expectedCount);
  });

  it("uses injected randomness for deterministic choice order", () => {
    const settings = settingsFromPreset("standard");
    const firstOrder = generateWordCategoriesRound(settings, "item-to-category", 1, () => 0).choices.map((choice) => choice.id);

    expect(generateWordCategoriesRound(settings, "item-to-category", 1, () => 0).choices.map((choice) => choice.id)).toEqual(firstOrder);
    expect(generateWordCategoriesRound(settings, "item-to-category", 1, () => 0.99).choices.map((choice) => choice.id)).not.toEqual(firstOrder);
  });
});
