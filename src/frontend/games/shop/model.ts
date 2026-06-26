import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../core/random";

export type ShopTaskKind = "choose-item" | "pay-coins";

export type ShopCoinValue = 1 | 2 | 5;

export type ShopCoin = {
  value: ShopCoinValue;
  label: string;
};

export type ShopItem = {
  id: string;
  label: string;
  emoji: string;
  price: number;
};

export type ShopRound = {
  roundId: string;
  taskKind: ShopTaskKind;
  prompt: string;
  helperText: string;
  targetItem: ShopItem;
  targetPrice: number;
  choices: ShopItem[];
  correctIndex: number;
  coins: ShopCoin[];
  suggestedCoins: ShopCoinValue[];
};

export const shopCoins: ShopCoin[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 5, label: "5" }
];

export const shopItems: ShopItem[] = [
  { id: "apple", label: "яблоко", emoji: "🍎", price: 2 },
  { id: "juice", label: "сок", emoji: "🧃", price: 3 },
  { id: "bread", label: "хлеб", emoji: "🍞", price: 4 },
  { id: "milk", label: "молоко", emoji: "🥛", price: 5 },
  { id: "banana", label: "банан", emoji: "🍌", price: 6 },
  { id: "cookie", label: "печенье", emoji: "🍪", price: 7 },
  { id: "cheese", label: "сыр", emoji: "🧀", price: 8 },
  { id: "berries", label: "ягоды", emoji: "🫐", price: 9 },
  { id: "cake", label: "кекс", emoji: "🧁", price: 10 }
];

function choiceCountFor(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

export function buildShopPaymentSuggestion(total: number): ShopCoinValue[] {
  const coins: ShopCoinValue[] = [];
  let rest = Math.max(2, Math.min(10, Math.floor(total)));
  for (const value of [5, 2, 1] as ShopCoinValue[]) {
    while (rest >= value) {
      coins.push(value);
      rest -= value;
    }
  }
  return coins;
}

export function generateShopRound(settings: SessionSettings, roundIndex = 1, random = Math.random): ShopRound {
  const taskKind: ShopTaskKind = roundIndex % 2 === 0 ? "pay-coins" : "choose-item";
  const choiceCount = choiceCountFor(settings);
  if (shopItems.length < choiceCount) throw new Error("Недостаточно товаров для магазина.");

  const [targetItem] = shuffleItems(shopItems, random).slice(0, 1);
  const distractors = shuffleItems(shopItems.filter((item) => item.price !== targetItem.price), random).slice(0, choiceCount - 1);
  const choices = shuffleItems([targetItem, ...distractors], random);
  const targetPrice = targetItem.price;

  return {
    roundId: `shop:round:${roundIndex}`,
    taskKind,
    prompt: taskKind === "choose-item" ? `Выбери товар за ${targetPrice}` : `Оплати ${targetItem.label}: ${targetPrice}`,
    helperText: taskKind === "choose-item" ? "Смотри на ценники и выбери нужный товар." : "Собери цену монетами и нажми галочку.",
    targetItem,
    targetPrice,
    choices,
    correctIndex: choices.findIndex((item) => item.id === targetItem.id),
    coins: shopCoins,
    suggestedCoins: buildShopPaymentSuggestion(targetPrice)
  };
}
