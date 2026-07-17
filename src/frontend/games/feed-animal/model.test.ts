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

  it("keeps fish as the correct food for the puppy round", () => {
    const round = generateFeedAnimalRound(2);

    expect(round.animal.id).toBe("puppy");
    expect(round.correctFood.id).toBe("fish");
    expect(animalEatsFood(round.animal, round.correctFood)).toBe(true);
  });
});
