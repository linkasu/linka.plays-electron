import { shuffleItems } from "../../core/random";
import type { SessionSettings } from "../../core/settings";
import { getAllWords, type WordItem } from "../../data/wordBank";

export type TypeWordRound = {
  roundId: string;
  item: WordItem;
  letters: string[];
  letterChoices: string[][];
  wordAudioAssetId: string;
};

export type TypeWordSelection = {
  isCorrect: boolean;
  nextIndex: number;
  complete: boolean;
};

const alphabet = Array.from("абвгдеёжзийклмнопрстуфхцчшщыьэюя");
const categoriesWithImagesAndTts = new Set(["food", "animal", "transport", "clothes"]);

function choiceCount(settings: SessionSettings) {
  if (settings.preset === "gentle") return 2;
  if (settings.preset === "challenge") return 4;
  return 3;
}

export function typeWordAudioAssetId(itemId: string) {
  return `word-categories.item.${itemId}`;
}

export function createTypeWordDeck(settings: SessionSettings, random = Math.random) {
  const maxLength = settings.preset === "gentle" ? 4 : 5;
  const items = getAllWords().filter((item) => {
    const length = Array.from(item.word).length;
    return categoriesWithImagesAndTts.has(item.category) && length >= 3 && length <= maxLength;
  });

  if (!items.length) throw new Error("Нет коротких слов для печати.");
  return shuffleItems(items, random);
}

export function generateTypeWordRound(settings: SessionSettings, item: WordItem, roundIndex = 1, random = Math.random): TypeWordRound {
  const letters = Array.from(item.word.toLowerCase());
  const wordLetters = new Set(letters);
  const distractors = alphabet.filter((letter) => !wordLetters.has(letter));
  const targetChoiceCount = choiceCount(settings);
  const letterChoices = letters.map((letter) => {
    const alternatives = shuffleItems(distractors, random).slice(0, targetChoiceCount - 1);
    return shuffleItems([letter, ...alternatives], random);
  });

  return {
    roundId: `type-word:round:${roundIndex}`,
    item,
    letters,
    letterChoices,
    wordAudioAssetId: typeWordAudioAssetId(item.id)
  };
}

export function evaluateTypeWordChoice(round: TypeWordRound, currentIndex: number, choice: string): TypeWordSelection {
  const expected = round.letters[currentIndex];
  if (expected === undefined) throw new RangeError("Текущий слот находится за границами слова.");

  const isCorrect = choice === expected;
  const nextIndex = isCorrect ? currentIndex + 1 : currentIndex;
  return { isCorrect, nextIndex, complete: nextIndex === round.letters.length };
}
