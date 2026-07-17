import { createNonRepeatingRandomIndexGenerator, sampleItems, shuffleItems } from "../../core/random";
import { getWordsByCategory, type WordItem } from "../../data/wordBank";

export type EatOrNotEatAnswer = "food" | "thing";

export type EatOrNotEatRound = {
  roundId: string;
  prompt: string;
  item: WordItem;
  correctAnswer: EatOrNotEatAnswer;
};

const itemsByAnswer: Record<EatOrNotEatAnswer, WordItem[]> = {
  food: getWordsByCategory("food"),
  thing: getWordsByCategory("thing")
};

function buildEatOrNotEatRound(roundIndex: number, item: WordItem, correctAnswer: EatOrNotEatAnswer): EatOrNotEatRound {
  return {
    roundId: `eat-or-not-eat:round:${roundIndex}`,
    prompt: `Куда относится «${item.word}»: еда или не еда?`,
    item,
    correctAnswer
  };
}

export function generateEatOrNotEatRound(roundIndex = 1, random = Math.random): EatOrNotEatRound {
  const useFood = random() >= 0.5;
  const category = useFood ? "food" : "thing";
  const [item] = sampleItems(itemsByAnswer[category], 1, [], random);
  if (!item) throw new Error(`Нет слов в категории ${category}.`);
  return buildEatOrNotEatRound(roundIndex, item, category);
}

export function createEatOrNotEatRoundGenerator(random = Math.random) {
  const itemIndexes = {
    food: createNonRepeatingRandomIndexGenerator(itemsByAnswer.food.length, random),
    thing: createNonRepeatingRandomIndexGenerator(itemsByAnswer.thing.length, random)
  };
  let answerPair: EatOrNotEatAnswer[] = [];

  return (roundIndex = 1): EatOrNotEatRound => {
    if (answerPair.length === 0) answerPair = shuffleItems<EatOrNotEatAnswer>(["food", "thing"], random);
    const correctAnswer = answerPair.shift();
    if (!correctAnswer) throw new Error("Не удалось выбрать категорию для игры Съедобное.");

    const itemIndex = itemIndexes[correctAnswer].next();
    const item = itemIndex === undefined ? undefined : itemsByAnswer[correctAnswer][itemIndex];
    if (!item) throw new Error(`Нет слов в категории ${correctAnswer}.`);
    return buildEatOrNotEatRound(roundIndex, item, correctAnswer);
  };
}
