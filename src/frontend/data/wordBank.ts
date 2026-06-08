export type WordItem = {
  id: string;
  word: string;
  emoji: string;
  category: string;
  audioSrc?: string;
};

export const wordBank: WordItem[] = [
  { id: "apple", word: "яблоко", emoji: "🍎", category: "food" },
  { id: "banana", word: "банан", emoji: "🍌", category: "food" },
  { id: "bread", word: "хлеб", emoji: "🍞", category: "food" },
  { id: "cheese", word: "сыр", emoji: "🧀", category: "food" },
  { id: "carrot", word: "морковь", emoji: "🥕", category: "food" },
  { id: "ball", word: "мяч", emoji: "⚽", category: "thing" },
  { id: "book", word: "книга", emoji: "📘", category: "thing" },
  { id: "chair", word: "стул", emoji: "🪑", category: "thing" },
  { id: "key", word: "ключ", emoji: "🔑", category: "thing" },
  { id: "lamp", word: "лампа", emoji: "💡", category: "thing" },
  { id: "cat", word: "кот", emoji: "🐱", category: "animal" },
  { id: "dog", word: "пёс", emoji: "🐶", category: "animal" },
  { id: "fish", word: "рыба", emoji: "🐟", category: "animal" },
  { id: "duck", word: "утка", emoji: "🦆", category: "animal" },
  { id: "flower", word: "цветок", emoji: "🌸", category: "nature" },
  { id: "tree", word: "дерево", emoji: "🌳", category: "nature" }
];

export function getAllWords() {
  return [...wordBank];
}

export function getWordsByCategory(category: string) {
  return wordBank.filter((item) => item.category === category);
}

export function getWordsByLength(min: number, max: number) {
  return wordBank.filter((item) => Array.from(item.word).length >= min && Array.from(item.word).length <= max);
}

export function sampleItems<T>(items: T[], count: number, exclude: T[] = []) {
  const excluded = new Set(exclude);
  const pool = items.filter((item) => !excluded.has(item));
  const result: T[] = [];
  while (pool.length && result.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    const [item] = pool.splice(index, 1);
    result.push(item);
  }
  return result;
}

export function shuffleItems<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function validateWordBank(items = wordBank) {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id) errors.push("Word id is empty.");
    if (ids.has(item.id)) errors.push(`Duplicate word id: ${item.id}`);
    ids.add(item.id);
    if (!item.word) errors.push(`Word is empty for ${item.id}`);
    if (!item.emoji) errors.push(`Emoji is empty for ${item.id}`);
    if (!item.category) errors.push(`Category is empty for ${item.id}`);
  }
  if (getWordsByCategory("food").length < 2) errors.push("Need at least two food words.");
  if (getWordsByCategory("thing").length < 2) errors.push("Need at least two thing words.");
  return errors;
}
