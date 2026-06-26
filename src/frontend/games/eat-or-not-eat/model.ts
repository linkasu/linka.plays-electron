import { sampleItems } from "../../core/random";
import { getWordsByCategory, type WordItem } from "../../data/wordBank";

export type EatOrNotEatAnswer = "food" | "thing";

export type EatOrNotEatRound = {
  roundId: string;
  item: WordItem;
  correctAnswer: EatOrNotEatAnswer;
};

export function generateEatOrNotEatRound(roundIndex = 1, random = Math.random): EatOrNotEatRound {
  const useFood = random() >= 0.5;
  const category = useFood ? "food" : "thing";
  const [item] = sampleItems(getWordsByCategory(category), 1, [], random);
  if (!item) throw new Error(`Нет слов в категории ${category}.`);
  return { roundId: `eat-or-not-eat:round:${roundIndex}`, item, correctAnswer: category };
}
