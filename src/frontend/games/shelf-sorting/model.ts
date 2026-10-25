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
  /** Drawn shelf (core/gameArt.ts), shown instead of the swatch. */
  artId?: string;
};

export type ShelfSortingItem = {
  id: string;
  label: string;
  categoryShelfId: string;
  colorShelfId?: string;
  imageId?: string;
  /** Drawn picture (core/gameArt.ts); wins over the word picture and the icon. */
  artId?: string;
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

// Testers: «нарисовать картиночки, а то с текстом непонятно». The drawn set is
// dishes, clothes and toys with coloured shelves, so the game sorts those
// instead of food / toys / nature. The book is left out until there is a
// fourth shelf; food and nature come back when they are drawn (image request 9).
const categoryShelves: ShelfSortingShelf[] = [
  {
    id: "dishes",
    title: "Посуда",
    hint: "из чего едят и пьют",
    color: "blue-lighten-5",
    accent: "#1565c0",
    icon: "mdi-silverware-fork-knife",
  },
  {
    id: "clothes",
    title: "Одежда",
    hint: "что надевают",
    color: "green-lighten-5",
    accent: "#2e7d32",
    icon: "mdi-tshirt-crew",
  },
  {
    id: "toys",
    title: "Игрушки",
    hint: "то, чем играют",
    color: "purple-lighten-4",
    accent: "#7e57c2",
    icon: "mdi-teddy-bear",
  },
];

const colorShelves: ShelfSortingShelf[] = [
  {
    id: "red",
    title: "Красная",
    hint: "красный цвет",
    color: "red-lighten-4",
    accent: "#d32f2f",
    swatch: "#e53935",
    artId: "shelf-sorting/shelf-red",
  },
  {
    id: "blue",
    title: "Синяя",
    hint: "синий цвет",
    color: "blue-lighten-4",
    accent: "#1565c0",
    swatch: "#1e88e5",
    artId: "shelf-sorting/shelf-blue",
  },
  {
    id: "green",
    title: "Зелёная",
    hint: "зелёный цвет",
    color: "green-lighten-4",
    accent: "#2e7d32",
    swatch: "#43a047",
    artId: "shelf-sorting/shelf-green",
  },
];

function item(
  id: string,
  label: string,
  categoryShelfId: string,
  colorShelfId?: string,
): ShelfSortingItem {
  return { id, label, categoryShelfId, colorShelfId, artId: `shelf-sorting/${id}` };
}

export const shelfSortingItems: ShelfSortingItem[] = [
  item("bowl", "миска", "dishes", "red"),
  item("mug", "кружка", "dishes", "blue"),
  item("plate", "тарелка", "dishes"),
  item("spoon", "ложка", "dishes"),
  item("t-shirt", "футболка", "clothes", "green"),
  item("jeans", "джинсы", "clothes", "blue"),
  item("boot", "ботинок", "clothes"),
  item("ball", "мяч", "toys"),
  item("blocks", "кубики", "toys"),
  item("teddy-bear", "мишка", "toys"),
  item("toy-car", "машинка", "toys", "red"),
];

export const shelfSortingArtIds = [...categoryShelves, ...colorShelves, ...shelfSortingItems]
  .map((entry) => entry.artId)
  .filter((artId): artId is string => Boolean(artId));

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
  const availableItems =
    rule === "category" ? shelfSortingItems : shelfSortingItems.filter((item) => item.colorShelfId);
  const item = shuffleItems(availableItems, random)[0];
  const shelves = shelvesForRule(rule);
  const correctShelfId = correctShelfIdFor(item, rule);

  return {
    roundId: `shelf-sorting:round:${roundIndex}`,
    rule,
    prompt: `${rule === "category" ? "Сортируем по категории" : "Сортируем по цвету"}. Предмет: ${item.label}.`,
    hint:
      rule === "category"
        ? "Найди полку для этого предмета."
        : "Сравни цвет предмета с образцами на полках.",
    item,
    shelves,
    correctShelfId,
    correctIndex: shelves.findIndex((shelf) => shelf.id === correctShelfId),
  };
}
