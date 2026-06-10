import { describe, expect, it } from "vitest";
import { createSoupRecipeRound, soupRecipeIngredients } from "./model";

describe("createSoupRecipeRound", () => {
  it("returns eight unique ingredients in recipe order", () => {
    const round = createSoupRecipeRound();
    const ids = round.ingredients.map((ingredient) => ingredient.id);
    const orderIndexes = round.ingredients.map((ingredient) => ingredient.orderIndex);

    expect(round.roundId).toBe("soup-recipe:recipe:1");
    expect(round.ingredients).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(orderIndexes).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ids).toEqual(soupRecipeIngredients.map((ingredient) => ingredient.id));
  });

  it("limits the recipe by maxSteps", () => {
    const round = createSoupRecipeRound(5);

    expect(round.ingredients).toHaveLength(5);
    expect(round.ingredients.map((ingredient) => ingredient.orderIndex)).toEqual([1, 2, 3, 4, 5]);
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
});
