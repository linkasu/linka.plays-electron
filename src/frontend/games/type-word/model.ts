import { getWordsByLength, sampleItems, shuffleItems, type WordItem } from "../../data/wordBank";
import type { SessionSettings } from "../../core/settings";

export type TypeWordRound = {
  roundId: string;
  item: WordItem;
  letters: string[];
  keyboardChoices: string[];
};

const alphabet = Array.from("абвгдеёжзийклмнопрстуфхцчшщыьэюя");

export function generateTypeWordRound(settings: SessionSettings, roundIndex = 1): TypeWordRound {
  const maxLength = settings.preset === "gentle" ? 4 : 6;
  const words = getWordsByLength(2, maxLength).sort((a, b) => a.word.length - b.word.length);
  const [item] = sampleItems(words, 1);
  if (!item) throw new Error("Нет коротких слов для печати.");
  const letters = Array.from(item.word.toLowerCase());
  const keyCount = settings.preset === "gentle" ? Math.max(3, letters.length) : Math.max(5, letters.length + 2);
  const keys = new Set(letters);
  while (keys.size < keyCount) keys.add(alphabet[Math.floor(Math.random() * alphabet.length)]);
  return { roundId: `type-word:round:${roundIndex}`, item, letters, keyboardChoices: shuffleItems([...keys]) };
}
