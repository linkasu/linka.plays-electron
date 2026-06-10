import { describe, expect, it } from "vitest";
import { generateWordCategoriesRound, getWordCategory, wordCategories } from "./model";

describe("generateWordCategoriesRound", () => {
  it("alternates between choosing a category and choosing an item", () => {
    expect(generateWordCategoriesRound(1).mode).toBe("item-to-category");
    expect(generateWordCategoriesRound(2).mode).toBe("category-to-item");
    expect(generateWordCategoriesRound(3).mode).toBe("item-to-category");
  });

  it("builds item-to-category rounds with one correct category", () => {
    const round = generateWordCategoriesRound(1);
    const category = getWordCategory(round.targetItem.category);

    expect(round.mode).toBe("item-to-category");
    expect(category).toBeDefined();
    expect(round.correctChoiceId).toBe(category?.id);
    expect(round.choices).toHaveLength(wordCategories.length);
    expect(round.choices[round.correctIndex].id).toBe(round.correctChoiceId);
  });

  it("builds category-to-item rounds with distractors from other categories", () => {
    const round = generateWordCategoriesRound(2);

    expect(round.mode).toBe("category-to-item");
    expect(round.correctChoiceId).toBe(round.targetItem.id);
    expect(round.targetItem.category).toBe(round.targetCategory.id);
    expect(round.choices).toHaveLength(4);
    expect(round.choices[round.correctIndex].id).toBe(round.correctChoiceId);
    expect(round.choices.filter((choice) => "category" in choice && choice.category === round.targetCategory.id)).toHaveLength(1);
  });

  it("keeps round ids stable for telemetry", () => {
    expect(generateWordCategoriesRound(8).roundId).toBe("word-categories:round:8");
  });
});
