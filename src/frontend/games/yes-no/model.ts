import { sampleItems } from "../../core/random";
import { getAllWords, type WordItem } from "../../data/wordBank";

export type YesNoAnswer = "yes" | "no";

export type YesNoChoice = {
  id: YesNoAnswer;
  title: string;
  emoji: string;
};

export type YesNoRound = {
  roundId: string;
  prompt: string;
  item: WordItem;
  askedItem: WordItem;
  answer: YesNoAnswer;
  choices: YesNoChoice[];
};

export const yesNoChoices: YesNoChoice[] = [
  { id: "yes", title: "Да", emoji: "✅" },
  { id: "no", title: "Нет", emoji: "❌" }
];

export function generateYesNoRound(roundIndex = 1, random = Math.random): YesNoRound {
  const words = getAllWords();
  if (words.length < 2) throw new Error("Недостаточно слов для игры Да / нет.");

  const [item] = sampleItems(words, 1, [], random);
  if (!item) throw new Error("Не удалось выбрать слово для игры Да / нет.");

  const answer: YesNoAnswer = roundIndex % 2 === 1 ? "yes" : "no";
  const [distractor] = sampleItems(words, 1, [item], random);
  const askedItem = answer === "yes" ? item : distractor;
  if (!askedItem) throw new Error("Не удалось выбрать вопрос для игры Да / нет.");

  return {
    roundId: `yes-no:round:${roundIndex}`,
    prompt: `Это ${askedItem.word}?`,
    item,
    askedItem,
    answer,
    choices: yesNoChoices
  };
}
