import { describe, expect, it } from "vitest";
import { animalEatsFood, generateFeedAnimalRound } from "./model";

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
});
