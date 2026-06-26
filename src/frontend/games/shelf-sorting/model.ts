import { shuffleItems } from "../../core/random";

export type ShelfSortingRule = "category" | "color";

export type ShelfSortingShelf = {
  id: string;
  title: string;
  hint: string;
  color: string;
  icon: string;
};

export type ShelfSortingItem = {
  id: string;
  label: string;
  emoji: string;
  categoryShelfId: string;
  colorShelfId: string;
};

export type ShelfSortingRound = {
  roundId: string;
  rule: ShelfSortingRule;
  prompt: string;
  hint: string;
  item: ShelfSortingItem;
  shelves: ShelfSortingShelf[];
  correctShelfId: string;
  correctIndex: number;
};

const categoryShelves: ShelfSortingShelf[] = [
  { id: "food", title: "Еда", hint: "то, что можно есть", color: "orange-lighten-4", icon: "mdi-bookshelf" },
  { id: "toys", title: "Игрушки", hint: "то, чем играют", color: "purple-lighten-4", icon: "mdi-bookshelf" },
  { id: "nature", title: "Природа", hint: "растения, вода и небо", color: "green-lighten-4", icon: "mdi-bookshelf" }
];

const colorShelves: ShelfSortingShelf[] = [
  { id: "warm", title: "Тёплые цвета", hint: "красный, жёлтый, оранжевый", color: "amber-lighten-4", icon: "mdi-bookshelf" },
  { id: "cool", title: "Холодные цвета", hint: "синий и фиолетовый", color: "blue-lighten-4", icon: "mdi-bookshelf" },
  { id: "green", title: "Зелёные", hint: "зелёный цвет", color: "teal-lighten-4", icon: "mdi-bookshelf" }
];

const shelfSortingItems: ShelfSortingItem[] = [
  { id: "apple", label: "яблоко", emoji: "🍎", categoryShelfId: "food", colorShelfId: "warm" },
  { id: "lemon", label: "лимон", emoji: "🍋", categoryShelfId: "food", colorShelfId: "warm" },
  { id: "grapes", label: "виноград", emoji: "🍇", categoryShelfId: "food", colorShelfId: "cool" },
  { id: "cucumber", label: "огурец", emoji: "🥒", categoryShelfId: "food", colorShelfId: "green" },
  { id: "ball", label: "мяч", emoji: "⚽", categoryShelfId: "toys", colorShelfId: "cool" },
  { id: "teddy", label: "мишка", emoji: "🧸", categoryShelfId: "toys", colorShelfId: "warm" },
  { id: "kite", label: "змей", emoji: "🪁", categoryShelfId: "toys", colorShelfId: "green" },
  { id: "flower", label: "цветок", emoji: "🌸", categoryShelfId: "nature", colorShelfId: "warm" },
  { id: "river", label: "река", emoji: "🏞️", categoryShelfId: "nature", colorShelfId: "cool" },
  { id: "leaf", label: "лист", emoji: "🍃", categoryShelfId: "nature", colorShelfId: "green" }
];

export function shelvesForRule(rule: ShelfSortingRule) {
  return rule === "category" ? categoryShelves : colorShelves;
}

export function correctShelfIdFor(item: ShelfSortingItem, rule: ShelfSortingRule) {
  return rule === "category" ? item.categoryShelfId : item.colorShelfId;
}

export function generateShelfSortingRound(roundIndex = 1, random = Math.random): ShelfSortingRound {
  const rule: ShelfSortingRule = roundIndex % 2 === 1 ? "category" : "color";
  const item = shuffleItems(shelfSortingItems, random)[0];
  const shelves = shelvesForRule(rule);
  const correctShelfId = correctShelfIdFor(item, rule);

  return {
    roundId: `shelf-sorting:round:${roundIndex}`,
    rule,
    prompt: rule === "category" ? "Выбери полку по категории" : "Выбери полку по цвету",
    hint: rule === "category" ? "Смотри, что это за предмет." : "Смотри на главный цвет предмета.",
    item,
    shelves,
    correctShelfId,
    correctIndex: shelves.findIndex((shelf) => shelf.id === correctShelfId)
  };
}
