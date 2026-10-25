import { describe, expect, it } from "vitest";
import { animalEatsFood, feedAnimalFoods, feedAnimals, generateFeedAnimalRound } from "./model";

describe("feed animal model", () => {
  it("generates one edible choice and two unsuitable choices", () => {
    for (let index = 1; index <= 16; index += 1) {
      const round = generateFeedAnimalRound(index);
      const edibleChoices = round.foods.filter((food) => animalEatsFood(round.animal, food));

      expect(round.foods).toHaveLength(3);
      expect(edibleChoices).toEqual([round.correctFood]);
      expect(round.foods[round.correctIndex]).toBe(round.correctFood);
    }
  });

  it("feeds the puppy a bone", () => {
    // Testers: «у щенка должна быть кость».
    for (let index = 2; index <= 2 + feedAnimals.length * 6; index += feedAnimals.length) {
      const round = generateFeedAnimalRound(index);
      expect(round.animal.id).toBe("puppy");
      expect(round.correctFood.id).toBe("bone");
    }
  });

  it("never offers food the animal might eat as a wrong choice", () => {
    for (let index = 1; index <= feedAnimals.length * 12; index += 1) {
      const round = generateFeedAnimalRound(index);
      const wrong = round.foods.filter((food) => food.id !== round.correctFood.id);
      expect(wrong).toHaveLength(2);
      for (const food of wrong) {
        expect(round.animal.eats).not.toContain(food.id);
        expect(round.animal.avoid).not.toContain(food.id);
      }
    }
  });

  it("names only foods that exist", () => {
    const ids = new Set(feedAnimalFoods.map((food) => food.id));
    for (const animal of feedAnimals)
      for (const id of [...animal.eats, ...animal.avoid]) expect(ids.has(id), id).toBe(true);
  });
});
