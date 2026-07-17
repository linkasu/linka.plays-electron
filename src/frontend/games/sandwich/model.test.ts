import { describe, expect, it } from "vitest";
import { buildSandwichSteps, isSandwichRecipeCompleteStep, sandwichChoices, sandwichMaxSteps, sandwichRecipes, shuffleSandwichChoices } from "./model";

describe("sandwich model", () => {
  it("builds two complete recipe sequences", () => {
    const steps = buildSandwichSteps();

    expect(steps).toHaveLength(10);
    expect(sandwichMaxSteps()).toBe(10);
    expect(steps.map((step) => step.choice.id)).toEqual([
      "bottom-bread",
      "butter",
      "cheese",
      "lettuce",
      "top-bread",
      "bottom-bread",
      "butter",
      "tomato",
      "cheese",
      "top-bread"
    ]);
  });

  it("keeps recipe identity and stable telemetry ids", () => {
    const steps = buildSandwichSteps();

    expect(steps[0]).toMatchObject({ id: "sandwich-step-1", roundId: "sandwich:round:1", recipeId: "cheese-salad", recipeIndex: 0, stepIndex: 0 });
    expect(steps[5]).toMatchObject({ id: "sandwich-step-6", roundId: "sandwich:round:6", recipeId: "tomato-cheese", recipeIndex: 1, stepIndex: 0 });
  });

  it("marks only top bread as recipe completion", () => {
    const steps = buildSandwichSteps();

    expect(steps.map((step) => isSandwichRecipeCompleteStep(step))).toEqual([false, false, false, false, true, false, false, false, false, true]);
  });

  it("keeps all recipe ingredients available as choices", () => {
    const choiceIds = new Set(sandwichChoices.map((choice) => choice.id));

    for (const recipe of sandwichRecipes) {
      expect(recipe.steps.every((step) => choiceIds.has(step.id))).toBe(true);
      expect(recipe.title).toBeTruthy();
      expect(recipe.helper).toBeTruthy();
    }
  });

  it("provides recognizable visuals and only available ingredient speech", () => {
    const byId = Object.fromEntries(sandwichChoices.map((choice) => [choice.id, choice]));

    expect(byId["bottom-bread"]).toMatchObject({ imageId: "bread", roleIcon: "mdi-arrow-down-bold", ttsAssetId: "word-categories.item.bread" });
    expect(byId["top-bread"]).toMatchObject({ imageId: "bread", roleIcon: "mdi-arrow-up-bold", ttsAssetId: "word-categories.item.bread" });
    expect(byId.cheese).toMatchObject({ imageId: "cheese", ttsAssetId: "word-categories.item.cheese" });
    expect(byId.tomato).toMatchObject({ imageId: "tomato", ttsAssetId: "word-categories.item.tomato" });
    expect(byId.butter).toMatchObject({ emoji: "🧈" });
    expect(byId.butter.ttsAssetId).toBeUndefined();
    expect(sandwichChoices.every((choice) => choice.imageId || choice.emoji)).toBe(true);
  });

  it("shuffles button choices without dropping ingredients", () => {
    const randomValues = [0.91, 0.13, 0.72, 0.28, 0.49];
    const shuffled = shuffleSandwichChoices(sandwichChoices, () => randomValues.shift() ?? 0);

    expect(shuffled).not.toEqual(sandwichChoices);
    expect(shuffled.map((choice) => choice.id).sort()).toEqual(sandwichChoices.map((choice) => choice.id).sort());
  });
});
