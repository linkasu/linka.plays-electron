import { sampleItems, shuffleItems } from "../../core/random";
import { getWordsByLength, type WordItem } from "../../data/wordBank";
import type { SessionSettings } from "../../core/settings";

export type TypeWordRound = {
  roundId: string;
  item: WordItem;
  letters: string[];
  keyboardChoices: string[];
};

const alphabet = Array.from("абвгдеёжзийклмнопрстуфхцчшщыьэюя");

export function generateTypeWordRound(settings: SessionSettings, roundIndex = 1, random = Math.random): TypeWordRound {
  const maxLength = settings.preset === "gentle" ? 4 : 6;
  const words = getWordsByLength(2, maxLength).sort((a, b) => a.word.length - b.word.length);
  const [item] = sampleItems(words, 1, [], random);
  if (!item) throw new Error("Нет коротких слов для печати.");
  const letters = Array.from(item.word.toLowerCase());
  const baseKeyCount = settings.preset === "gentle" ? Math.max(4, letters.length) : Math.max(6, letters.length + 2);
  const keyCount = Math.min(8, baseKeyCount + (baseKeyCount % 2));
  const keys = new Set(letters);
  const distractorLetters = shuffleItems(alphabet.filter((letter) => !keys.has(letter)), random);
  for (const letter of distractorLetters) {
    if (keys.size >= keyCount) break;
    keys.add(letter);
  }
  return { roundId: `type-word:round:${roundIndex}`, item, letters, keyboardChoices: shuffleItems([...keys], random) };
}
