import { sampleItems } from "../../core/random";
import { getAllWords, type WordItem } from "../../data/wordBank";

export type YesNoAnswer = "yes" | "no";

export type YesNoChoice = {
  id: YesNoAnswer;
  title: string;
  icon: string;
  color: string;
};

export type YesNoNameAsset = {
  id: string;
  text: string;
};

export type YesNoRound = {
  roundId: string;
  prompt: string;
  item: WordItem;
  askedItem: WordItem;
  answer: YesNoAnswer;
  choices: YesNoChoice[];
};

export type YesNoRoundOptions = {
  random?: () => number;
  recentAnswers?: YesNoAnswer[];
};

export const yesNoChoices: YesNoChoice[] = [
  { id: "yes", title: "Да", icon: "mdi-check-bold", color: "green-lighten-4" },
  { id: "no", title: "Нет", icon: "mdi-close-thick", color: "red-lighten-4" }
];

export function findYesNoNameAsset(item: WordItem, assets: YesNoNameAsset[]) {
  const normalizedWord = item.word.trim().toLocaleLowerCase("ru-RU");
  const matchingAssets = assets.filter((asset) => asset.text.trim().toLocaleLowerCase("ru-RU").replace(/[.!?]+$/u, "") === normalizedWord);
  const nameMarkers = [".word.", ".name.", ".item.", ".card."];
  const isNameAsset = (asset: YesNoNameAsset) => nameMarkers.some((marker) => asset.id.includes(marker));

  return matchingAssets.find((asset) => asset.id.endsWith(`.${item.id}`) && isNameAsset(asset))
    ?? matchingAssets.find(isNameAsset);
}

export function generateYesNoRound(roundIndex = 1, optionsOrRandom: YesNoRoundOptions | (() => number) = {}): YesNoRound {
  const options = typeof optionsOrRandom === "function" ? { random: optionsOrRandom } : optionsOrRandom;
  const random = options.random ?? Math.random;
  const words = getAllWords();
  if (words.length < 2) throw new Error("Недостаточно слов для игры Да / нет.");

  const [item] = sampleItems(words, 1, [], random);
  if (!item) throw new Error("Не удалось выбрать слово для игры Да / нет.");

  const answer = selectYesNoAnswer(options.recentAnswers, random);
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

export function selectYesNoAnswer(recentAnswers: YesNoAnswer[] = [], random = Math.random): YesNoAnswer {
  const rolled: YesNoAnswer = random() < 0.5 ? "yes" : "no";
  const lastTwo = recentAnswers.slice(-2);
  if (lastTwo.length === 2 && lastTwo[0] === lastTwo[1] && rolled === lastTwo[0]) {
    return rolled === "yes" ? "no" : "yes";
  }
  return rolled;
}
