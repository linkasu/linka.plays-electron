import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../core/random";

export type ShopTaskKind = "shopping-list" | "pay-coins";

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
  targetItems: ShopItem[];
  targetPrice: number;
  walletTotal: number;
  choices: ShopItem[];
  correctIndex: number;
  correctItemIds: string[];
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

function shoppingWalletFor(settings: SessionSettings) {
  return settings.preset === "gentle" ? 6 : 10;
}

function sumItems(items: ShopItem[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

function buildShoppingPairs(walletTotal: number) {
  const pairs: ShopItem[][] = [];
  for (let firstIndex = 0; firstIndex < shopItems.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < shopItems.length; secondIndex += 1) {
      const pair = [shopItems[firstIndex], shopItems[secondIndex]];
      if (sumItems(pair) <= walletTotal) pairs.push(pair);
    }
  }
  return pairs;
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

export function validateShopShoppingCart(round: ShopRound, selectedItemIds: string[]) {
  const selectedItems = selectedItemIds
   .map((id) => shopItems.find((item) => item.id === id))
   .filter((item): item is ShopItem => Boolean(item));
  const selectedSet = new Set(selectedItemIds);
  const targetSet = new Set(round.correctItemIds);
  const matchesTargets = selectedSet.size === targetSet.size && [...targetSet].every((id) => selectedSet.has(id));
  return matchesTargets && sumItems(selectedItems) <= round.walletTotal;
}

export function generateShopRound(settings: SessionSettings, roundIndex = 1, random = Math.random): ShopRound {
  const taskKind: ShopTaskKind = roundIndex % 2 === 0 ? "pay-coins" : "shopping-list";
  const choiceCount = choiceCountFor(settings);
  if (shopItems.length < choiceCount) throw new Error("Недостаточно товаров для магазина.");

  if (taskKind === "shopping-list") {
    const walletTotal = shoppingWalletFor(settings);
    const [targetItems] = shuffleItems(buildShoppingPairs(walletTotal), random);
    if (!targetItems) throw new Error("Недостаточно товаров для списка покупок.");
    const targetIds = new Set(targetItems.map((item) => item.id));
    const distractors = shuffleItems(shopItems.filter((item) => !targetIds.has(item.id)), random).slice(0, choiceCount - targetItems.length);
    const choices = shuffleItems([...targetItems, ...distractors], random);
    const targetPrice = sumItems(targetItems);

    return {
      roundId: `shop:round:${roundIndex}`,
      taskKind,
      prompt: `У тебя ${walletTotal} монет. Купи ${targetItems.map((item) => item.label).join(" и ")}.`,
      helperText: `Выбери оба товара из списка. Нужно потратить ${targetPrice} из ${walletTotal} монет.`,
      targetItem: targetItems[0],
      targetItems,
      targetPrice,
      walletTotal,
      choices,
      correctIndex: choices.findIndex((item) => item.id === targetItems[0].id),
      correctItemIds: targetItems.map((item) => item.id),
      coins: shopCoins,
      suggestedCoins: buildShopPaymentSuggestion(targetPrice)
    };
  }

  const [targetItem] = shuffleItems(shopItems, random).slice(0, 1);
  const distractors = shuffleItems(shopItems.filter((item) => item.price !== targetItem.price), random).slice(0, choiceCount - 1);
  const choices = shuffleItems([targetItem, ...distractors], random);
  const targetPrice = targetItem.price;

  return {
    roundId: `shop:round:${roundIndex}`,
    taskKind,
    prompt: `Оплати ${targetItem.label}: ${targetPrice}`,
    helperText: "Собери цену монетами и нажми галочку.",
    targetItem,
    targetItems: [targetItem],
    targetPrice,
    walletTotal: targetPrice,
    choices,
    correctIndex: choices.findIndex((item) => item.id === targetItem.id),
    correctItemIds: [targetItem.id],
    coins: shopCoins,
    suggestedCoins: buildShopPaymentSuggestion(targetPrice)
  };
}
