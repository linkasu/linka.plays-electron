import {
  createNonRepeatingRandomIndexGenerator,
  sampleItems,
  shuffleItems,
} from "../../core/random";
import type { WordItem } from "../../data/wordBank";

export type EatOrNotEatAnswer = "food" | "thing";

export type EatOrNotEatItem = WordItem & {
  /** Picture drawn for this game, see core/gameArt.ts. */
  artId: string;
};

export type EatOrNotEatRound = {
  roundId: string;
  prompt: string;
  item: EatOrNotEatItem;
  correctAnswer: EatOrNotEatAnswer;
};

// Testers: «перерисовать картинки». The game uses the drawn set only, so the
// pictures in a session share one style. The prompt is spoken without the
// item name, so no new recordings are needed.
const item = (
  id: string,
  word: string,
  emoji: string,
  category: "food" | "thing",
): EatOrNotEatItem => ({ id, word, emoji, category, artId: `eat-or-not-eat/${id}` });

export const itemsByAnswer: Record<EatOrNotEatAnswer, EatOrNotEatItem[]> = {
  food: [
    item("apple", "яблоко", "🍎", "food"),
    item("banana", "банан", "🍌", "food"),
    item("bread", "хлеб", "🍞", "food"),
    item("carrot", "морковь", "🥕", "food"),
    item("cheese", "сыр", "🧀", "food"),
    item("fish", "рыба", "🐟", "food"),
  ],
  thing: [
    item("toy-car", "машинка", "🚗", "thing"),
    item("sock", "носок", "🧦", "thing"),
    item("soap", "мыло", "🧼", "thing"),
    item("block", "кубик", "🧊", "thing"),
    item("leaf", "лист", "🍃", "thing"),
    item("crayon", "мелок", "🖍️", "thing"),
  ],
};

function buildEatOrNotEatRound(
  roundIndex: number,
  item: EatOrNotEatItem,
  correctAnswer: EatOrNotEatAnswer,
): EatOrNotEatRound {
  return {
    roundId: `eat-or-not-eat:round:${roundIndex}`,
    prompt: `Куда относится «${item.word}»: еда или не еда?`,
    item,
    correctAnswer,
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
    thing: createNonRepeatingRandomIndexGenerator(itemsByAnswer.thing.length, random),
  };
  let answerPair: EatOrNotEatAnswer[] = [];

  return (roundIndex = 1): EatOrNotEatRound => {
    if (answerPair.length === 0)
      answerPair = shuffleItems<EatOrNotEatAnswer>(["food", "thing"], random);
    const correctAnswer = answerPair.shift();
    if (!correctAnswer) throw new Error("Не удалось выбрать категорию для игры Съедобное.");

    const itemIndex = itemIndexes[correctAnswer].next();
    const item = itemIndex === undefined ? undefined : itemsByAnswer[correctAnswer][itemIndex];
    if (!item) throw new Error(`Нет слов в категории ${correctAnswer}.`);
    return buildEatOrNotEatRound(roundIndex, item, correctAnswer);
  };
}
