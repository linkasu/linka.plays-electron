import { shuffleItems } from "../../core/random";

export type ShelfSortingRule = "category" | "color";

export type ShelfSortingShelf = {
  id: string;
  title: string;
  hint: string;
  color: string;
  accent: string;
  icon?: string;
  swatch?: string;
};

export type ShelfSortingItem = {
  id: string;
  label: string;
  categoryShelfId: string;
  colorShelfId?: string;
  imageId?: string;
  icon?: string;
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
  { id: "food", title: "Еда", hint: "то, что можно есть", color: "orange-lighten-4", accent: "#ef6c00", icon: "mdi-food-apple" },
  { id: "toys", title: "Игрушки", hint: "то, чем играют", color: "purple-lighten-4", accent: "#7e57c2", icon: "mdi-teddy-bear" },
  { id: "nature", title: "Природа", hint: "растения, вода и небо", color: "green-lighten-4", accent: "#2e7d32", icon: "mdi-leaf" }
];

const colorShelves: ShelfSortingShelf[] = [
  { id: "red", title: "Красная", hint: "красный цвет", color: "red-lighten-4", accent: "#d32f2f", swatch: "#e53935" },
  { id: "yellow", title: "Жёлтая", hint: "жёлтый цвет", color: "yellow-lighten-4", accent: "#f9a825", swatch: "#fdd835" },
  { id: "green", title: "Зелёная", hint: "зелёный цвет", color: "green-lighten-4", accent: "#2e7d32", swatch: "#43a047" }
];

export const shelfSortingItems: ShelfSortingItem[] = [
  { id: "apple", label: "яблоко", imageId: "apple", categoryShelfId: "food", colorShelfId: "red" },
  { id: "lemon", label: "лимон", imageId: "lemon", categoryShelfId: "food", colorShelfId: "yellow" },
  { id: "grapes", label: "виноград", imageId: "grapes", categoryShelfId: "food" },
  { id: "cucumber", label: "огурец", imageId: "cucumber", categoryShelfId: "food", colorShelfId: "green" },
  { id: "ball", label: "мяч", imageId: "ball", categoryShelfId: "toys" },
  { id: "teddy", label: "мишка", icon: "mdi-teddy-bear", categoryShelfId: "toys" },
  { id: "kite", label: "воздушный змей", icon: "mdi-kite", categoryShelfId: "toys" },
  { id: "flower", label: "цветок", imageId: "flower", categoryShelfId: "nature" },
  { id: "river", label: "река", imageId: "river", categoryShelfId: "nature" },
  { id: "leaf", label: "лист", imageId: "leaf", categoryShelfId: "nature", colorShelfId: "green" }
];

export function shelvesForRule(rule: ShelfSortingRule) {
  return rule === "category" ? categoryShelves : colorShelves;
}

export function correctShelfIdFor(item: ShelfSortingItem, rule: ShelfSortingRule) {
  const shelfId = rule === "category" ? item.categoryShelfId : item.colorShelfId;
  if (!shelfId) throw new Error(`Item ${item.id} has no shelf for rule ${rule}`);
  return shelfId;
}

export function generateShelfSortingRound(roundIndex = 1, random = Math.random): ShelfSortingRound {
  const rule: ShelfSortingRule = roundIndex % 2 === 1 ? "category" : "color";
  const availableItems = rule === "category" ? shelfSortingItems : shelfSortingItems.filter((item) => item.colorShelfId);
  const item = shuffleItems(availableItems, random)[0];
  const shelves = shelvesForRule(rule);
  const correctShelfId = correctShelfIdFor(item, rule);

  return {
    roundId: `shelf-sorting:round:${roundIndex}`,
    rule,
    prompt: `${rule === "category" ? "Сортируем по категории" : "Сортируем по цвету"}. Предмет: ${item.label}.`,
    hint: rule === "category" ? "Найди полку для этого предмета." : "Сравни цвет предмета с образцами на полках.",
    item,
    shelves,
    correctShelfId,
    correctIndex: shelves.findIndex((shelf) => shelf.id === correctShelfId)
  };
}
