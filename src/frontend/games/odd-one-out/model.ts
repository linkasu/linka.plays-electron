import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type OddOneOutCategoryId = "animals" | "food" | "clothes" | "transport" | "music" | "nature";
export type OddOneOutAssetMode = "image" | "emoji";

export type OddOneOutItem = {
  id: string;
  wordId?: string;
  label: string;
  emoji: string;
  categoryId: OddOneOutCategoryId;
};

export type OddOneOutCategory = {
  id: OddOneOutCategoryId;
  label: string;
  helper: string;
  items: OddOneOutItem[];
};

export type OddOneOutRound = {
  roundId: string;
  prompt: string;
  commonCategory: OddOneOutCategory;
  oddCategory: OddOneOutCategory;
  oddItem: OddOneOutItem;
  choices: OddOneOutItem[];
  correctIndex: number;
  assetMode: OddOneOutAssetMode;
  mistakeHint: string;
};

function item(categoryId: OddOneOutCategoryId, id: string, label: string, emoji: string): OddOneOutItem {
  const defaultImageId = categoryId === "animals"
    || categoryId === "food"
    || categoryId === "transport"
    || categoryId === "nature" ? id : undefined;
  const exceptionalImageIds: Record<string, string> = {
    shirt: "shirt",
    dress: "dress",
    hat: "cap",
    shoe: "shoes",
    sock: "socks",
    drum: "drum"
  };
  return { id: `${categoryId}:${id}`, wordId: defaultImageId ?? exceptionalImageIds[id], label, emoji, categoryId };
}

export const oddOneOutCategories: OddOneOutCategory[] = [
  {
    id: "animals",
    label: "животные",
    helper: "Это живые звери и птицы.",
    items: [
      item("animals", "cat", "кот", "🐱"),
      item("animals", "dog", "пёс", "🐶"),
      item("animals", "duck", "утка", "🦆"),
      item("animals", "rabbit", "заяц", "🐰"),
      item("animals", "fish", "рыба", "🐟")
    ]
  },
  {
    id: "food",
    label: "еда",
    helper: "Это можно есть или пить.",
    items: [
      item("food", "apple", "яблоко", "🍎"),
      item("food", "banana", "банан", "🍌"),
      item("food", "bread", "хлеб", "🍞"),
      item("food", "cheese", "сыр", "🧀"),
      item("food", "carrot", "морковь", "🥕")
    ]
  },
  {
    id: "clothes",
    label: "одежда",
    helper: "Это надевают на себя.",
    items: [
      item("clothes", "shirt", "футболка", "👕"),
      item("clothes", "dress", "платье", "👗"),
      item("clothes", "hat", "шапка", "🧢"),
      item("clothes", "shoe", "ботинок", "👟"),
      item("clothes", "sock", "носок", "🧦")
    ]
  },
  {
    id: "transport",
    label: "транспорт",
    helper: "На этом можно ехать, плыть или лететь.",
    items: [
      item("transport", "car", "машина", "🚗"),
      item("transport", "bus", "автобус", "🚌"),
      item("transport", "train", "поезд", "🚆"),
      item("transport", "boat", "лодка", "⛵"),
      item("transport", "plane", "самолёт", "✈️")
    ]
  },
  {
    id: "music",
    label: "музыкальные инструменты",
    helper: "На них играют музыку.",
    items: [
      item("music", "drum", "барабан", "🥁"),
      item("music", "guitar", "гитара", "🎸"),
      item("music", "trumpet", "труба", "🎺"),
      item("music", "violin", "скрипка", "🎻"),
      item("music", "piano", "пианино", "🎹")
    ]
  },
  {
    id: "nature",
    label: "природа",
    helper: "Это растения и природные предметы.",
    items: [
      item("nature", "flower", "цветок", "🌸"),
      item("nature", "tree", "дерево", "🌳"),
      item("nature", "leaf", "лист", "🍃"),
      item("nature", "mushroom", "гриб", "🍄"),
      item("nature", "sun", "солнце", "☀️")
    ]
  }
];

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle" || settings.distractors === "none") return 3;
  if (settings.preset === "challenge" || settings.distractors === "medium") return 5;
  return 4;
}

export function generateOddOneOutRound(settings: SessionSettings, roundIndex = 1): OddOneOutRound {
  const choiceCount = choiceCountFor(settings);
  const assetMode: OddOneOutAssetMode = roundIndex % 2 === 1 ? "image" : "emoji";
  const supportsMode = (candidate: OddOneOutItem) => assetMode === "emoji" || Boolean(candidate.wordId);
  const commonCategory = shuffleItems(oddOneOutCategories.filter((category) => category.items.filter(supportsMode).length >= choiceCount - 1))[0];
  const oddCategory = shuffleItems(oddOneOutCategories.filter((category) => category.id !== commonCategory.id && category.items.some(supportsMode)))[0];
  const commonItems = shuffleItems(commonCategory.items.filter(supportsMode)).slice(0, choiceCount - 1);
  const oddItem = shuffleItems(oddCategory.items.filter(supportsMode))[0];
  const choices = shuffleItems([...commonItems, oddItem]);

  return {
    roundId: `odd-one-out:round:${roundIndex}`,
    prompt: "Что лишнее?",
    commonCategory,
    oddCategory,
    oddItem,
    choices,
    correctIndex: choices.indexOf(oddItem),
    assetMode,
    mistakeHint: `Почти. Большинство карточек — ${commonCategory.label}. ${commonCategory.helper} Найди карточку из другой группы.`
  };
}
