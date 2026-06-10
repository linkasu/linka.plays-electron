import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type OddOneOutCategoryId = "animals" | "food" | "clothes" | "transport" | "music" | "nature";

export type OddOneOutItem = {
  id: string;
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
  mistakeHint: string;
};

function item(categoryId: OddOneOutCategoryId, id: string, label: string, emoji: string): OddOneOutItem {
  return { id: `${categoryId}:${id}`, label, emoji, categoryId };
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
  const commonCategory = shuffleItems(oddOneOutCategories)[0];
  const oddCategory = shuffleItems(oddOneOutCategories.filter((category) => category.id !== commonCategory.id))[0];
  const commonItems = shuffleItems(commonCategory.items).slice(0, choiceCount - 1);
  const oddItem = shuffleItems(oddCategory.items)[0];
  const choices = shuffleItems([...commonItems, oddItem]);

  return {
    roundId: `odd-one-out:round:${roundIndex}`,
    prompt: "Что лишнее?",
    commonCategory,
    oddCategory,
    oddItem,
    choices,
    correctIndex: choices.indexOf(oddItem),
    mistakeHint: `Почти. Большинство карточек — ${commonCategory.label}. ${commonCategory.helper} Найди карточку из другой группы.`
  };
}
