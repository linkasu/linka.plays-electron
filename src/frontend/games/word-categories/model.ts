import { shuffleItems } from "../../core/random";
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

function generateItemToCategoryRound(roundIndex: number, random = Math.random): WordCategoriesRound {
  if (categoryWords.length < wordCategories.length) throw new Error("WordCategoriesGame needs category words.");

  const targetItem = categoryWords[(roundIndex - 1) % categoryWords.length];
  const targetCategory = getWordCategory(targetItem.category);
  if (!targetCategory) throw new Error(`Unknown word category: ${targetItem.category}`);

  const choices = shuffleItems(wordCategories, random);
  const correctChoiceId = targetCategory.id;

  return {
    roundId: `word-categories:round:${roundIndex}`,
    mode: "item-to-category",
    prompt: `К какой группе относится ${targetItem.word}?`,
    instruction: "Выбери категорию предмета.",
    explanation: `${targetItem.word} относится к группе «${targetCategory.title}»: ${targetCategory.hint}.`,
    targetItem,
    targetCategory,
    choices,
    correctChoiceId,
    correctIndex: choices.findIndex((choice) => choice.id === correctChoiceId)
  };
}

function generateCategoryToItemRound(roundIndex: number, random = Math.random): WordCategoriesRound {
  const targetCategory = wordCategories[(roundIndex - 1) % wordCategories.length];
  const targetItem = pickWord(targetCategory.id, roundIndex);
  const distractors = shuffleItems(wordCategories
    .filter((category) => category.id !== targetCategory.id)
    .map((category, index) => pickWord(category.id, roundIndex + index + 1)), random)
    .slice(0, 3);
  const choices = shuffleItems([targetItem, ...distractors], random);
  const correctChoiceId = targetItem.id;

  return {
    roundId: `word-categories:round:${roundIndex}`,
    mode: "category-to-item",
    prompt: `Что подходит к группе «${targetCategory.title}»?`,
    instruction: "Выбери предмет для категории.",
    explanation: `${targetItem.word} подходит к группе «${targetCategory.title}»: ${targetCategory.hint}.`,
    targetItem,
    targetCategory,
    choices,
    correctChoiceId,
    correctIndex: choices.findIndex((choice) => choice.id === correctChoiceId)
  };
}

export function generateWordCategoriesRound(roundIndex = 1, random = Math.random): WordCategoriesRound {
  return roundIndex % 2 === 1 ? generateItemToCategoryRound(roundIndex, random) : generateCategoryToItemRound(roundIndex, random);
}
