import { shuffleItems } from "../../core/random";
import { choiceCountByPreset } from "../../core/round";
import type { SessionSettings } from "../../core/settings";
import { getWordsByCategory, type WordItem } from "../../data/wordBank";

export type WordCategoriesMode = "item-to-category" | "category-to-item";
export type WordCategoryId = "food" | "animal" | "transport" | "clothes";

export type WordCategory = {
  id: WordCategoryId;
  title: string;
  hint: string;
  emoji: string;
  color: string;
};

export type WordCategoryChoice = WordCategory | WordItem;

export type WordCategoriesRound = {
  roundId: string;
  mode: WordCategoriesMode;
  prompt: string;
  instruction: string;
  explanation: string;
  targetItem: WordItem;
  targetCategory: WordCategory;
  choices: WordCategoryChoice[];
  correctChoiceId: string;
  correctIndex: number;
};

export const wordCategories: WordCategory[] = [
  { id: "food", title: "Еда", hint: "то, что можно есть или пить", emoji: "🍎", color: "orange-lighten-4" },
  { id: "animal", title: "Животные", hint: "живые звери, птицы и рыбы", emoji: "🐱", color: "green-lighten-4" },
  { id: "transport", title: "Транспорт", hint: "то, на чём можно ехать или лететь", emoji: "🚗", color: "blue-lighten-4" },
  { id: "clothes", title: "Одежда", hint: "то, что надевают", emoji: "👕", color: "purple-lighten-4" }
];

const wordsByCategory = new Map<WordCategoryId, WordItem[]>(wordCategories.map((category) => [category.id, getWordsByCategory(category.id)]));
const categoryWords = wordCategories.flatMap((category) => wordsByCategory.get(category.id) ?? []);

export function getWordCategory(categoryId: string) {
  return wordCategories.find((category) => category.id === categoryId);
}

function wordsForCategory(categoryId: WordCategoryId) {
  const words = wordsByCategory.get(categoryId) ?? [];
  if (words.length < 2) throw new Error(`WordCategoriesGame needs at least two words for ${categoryId}.`);
  return words;
}

function pickWord(categoryId: WordCategoryId, roundIndex: number) {
  const words = wordsForCategory(categoryId);
  return words[(roundIndex - 1) % words.length];
}

function choiceCountFor(settings: SessionSettings, roundIndex: number) {
  return choiceCountByPreset(settings, roundIndex, { gentle: 2, standard: 3, challenge: 4, cap: wordCategories.length });
}

function generateItemToCategoryRound(settings: SessionSettings, roundIndex: number, random = Math.random): WordCategoriesRound {
  if (categoryWords.length < wordCategories.length) throw new Error("WordCategoriesGame needs category words.");

  const targetItem = categoryWords[(roundIndex - 1) % categoryWords.length];
  const targetCategory = getWordCategory(targetItem.category);
  if (!targetCategory) throw new Error(`Unknown word category: ${targetItem.category}`);

  const correctChoiceId = targetCategory.id;
  const distractors = shuffleItems(wordCategories.filter((category) => category.id !== correctChoiceId), random).slice(0, choiceCountFor(settings, roundIndex) - 1);
  const choices = shuffleItems([targetCategory, ...distractors], random);

  return {
    roundId: `word-categories:round:${roundIndex}`,
    mode: "item-to-category",
    prompt: `К какой категории относится «${targetItem.word}»?`,
    instruction: "Предмет → категория",
    explanation: `${targetItem.word} относится к группе «${targetCategory.title}»: ${targetCategory.hint}.`,
    targetItem,
    targetCategory,
    choices,
    correctChoiceId,
    correctIndex: choices.findIndex((choice) => choice.id === correctChoiceId)
  };
}

function generateCategoryToItemRound(settings: SessionSettings, roundIndex: number, random = Math.random): WordCategoriesRound {
  const targetCategory = wordCategories[(roundIndex - 1) % wordCategories.length];
  const targetItem = pickWord(targetCategory.id, roundIndex);
  const distractors = shuffleItems(wordCategories
   .filter((category) => category.id !== targetCategory.id)
   .map((category, index) => pickWord(category.id, roundIndex + index + 1)), random)
   .slice(0, choiceCountFor(settings, roundIndex) - 1);
  const choices = shuffleItems([targetItem, ...distractors], random);
  const correctChoiceId = targetItem.id;

  return {
    roundId: `word-categories:round:${roundIndex}`,
    mode: "category-to-item",
    prompt: `Какой предмет относится к категории «${targetCategory.title}»?`,
    instruction: "Категория → предмет",
    explanation: `${targetItem.word} подходит к группе «${targetCategory.title}»: ${targetCategory.hint}.`,
    targetItem,
    targetCategory,
    choices,
    correctChoiceId,
    correctIndex: choices.findIndex((choice) => choice.id === correctChoiceId)
  };
}

export function generateWordCategoriesRound(settings: SessionSettings, mode: WordCategoriesMode, roundIndex = 1, random = Math.random): WordCategoriesRound {
  return mode === "item-to-category"
    ? generateItemToCategoryRound(settings, roundIndex, random)
    : generateCategoryToItemRound(settings, roundIndex, random);
}
