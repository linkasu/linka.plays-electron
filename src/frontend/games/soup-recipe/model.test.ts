import { describe, expect, it } from "vitest";
import { createSoupIngredientSlots, createSoupRecipeRound, soupRecipeIngredients, type SoupRect } from "./model";

function overlaps(first: SoupRect, second: SoupRect) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

describe("createSoupRecipeRound", () => {
  it("returns eight unique ingredients in recipe order", () => {
    const round = createSoupRecipeRound();
    const ids = round.ingredients.map((ingredient) => ingredient.id);

    expect(round.roundId).toBe("soup-recipe:recipe:1");
    expect(round.ingredients).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(ids).toEqual(soupRecipeIngredients.map((ingredient) => ingredient.id));
  });

  it("limits the recipe by maxSteps", () => {
    const round = createSoupRecipeRound(5);

    expect(round.ingredients).toHaveLength(5);
    expect(round.ingredients.map((ingredient) => ingredient.id)).toEqual(["water", "potatoes", "carrot", "onion", "peas"]);
  });

  it("clamps maxSteps to the available recipe range", () => {
    expect(createSoupRecipeRound(0).ingredients).toHaveLength(1);
    expect(createSoupRecipeRound(99).ingredients).toHaveLength(soupRecipeIngredients.length);
  });

  it("returns ingredient copies so callers cannot mutate the source recipe", () => {
    const round = createSoupRecipeRound();

    round.ingredients[0].label = "изменено";

    expect(createSoupRecipeRound().ingredients[0].label).toBe("вода");
    expect(soupRecipeIngredients[0].label).toBe("вода");
  });

  it("uses recognizable ingredient visuals without revealing order numbers", () => {
    expect(soupRecipeIngredients.map((ingredient) => ingredient.imageId ?? ingredient.icon ?? ingredient.emoji)).toEqual([
      "mdi-water-outline",
      "potato",
      "carrot",
      "onion",
      "🫛",
      "pasta",
      "mdi-shaker-outline",
      "leaf"
    ]);
    expect(soupRecipeIngredients.every((ingredient) => !("orderIndex" in ingredient))).toBe(true);
  });

  it("keeps all gaze targets disjoint at the compact desktop viewport", () => {
    const slots = createSoupIngredientSlots(soupRecipeIngredients, 900, 600);

    expect(slots).toHaveLength(8);
    expect(slots.every((slot, index) => slots.slice(index + 1).every((other) => !overlaps(slot.rect, other.rect)))).toBe(true);
    expect(slots.every((slot) => slot.rect.x >= 0 && slot.rect.y >= 0 && slot.rect.x + slot.rect.width <= 900 && slot.rect.y + slot.rect.height <= 600)).toBe(true);
  });
});
