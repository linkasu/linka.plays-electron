import { getWordsByCategory, sampleItems, type WordItem } from "../../data/wordBank";

export type EatOrNotEatAnswer = "food" | "thing";

export type EatOrNotEatRound = {
  item: WordItem;
  correctAnswer: EatOrNotEatAnswer;
};

export function generateEatOrNotEatRound(): EatOrNotEatRound {
  const useFood = Math.random() >= 0.5;
  const category = useFood ? "food" : "thing";
  const [item] = sampleItems(getWordsByCategory(category), 1);
  if (!item) throw new Error(`Нет слов в категории ${category}.`);
  return { item, correctAnswer: category };
}
