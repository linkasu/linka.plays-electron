import type { SessionSettings } from "../../core/settings";
import { randomInt, shuffleItems } from "../../core/random";

export type CoinCountingCoinValue = 1 | 2 | 5;

export type CoinCountingCoin = {
  value: CoinCountingCoinValue;
  label: string;
};

export type CoinCountingRound = {
  roundId: string;
  prompt: string;
  targetTotal: number;
  coins: CoinCountingCoin[];
  suggestedCoins: CoinCountingCoinValue[];
};

export const coinCountingCoins: CoinCountingCoin[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 5, label: "5" }
];

export function buildCoinCountingSuggestion(total: number): CoinCountingCoinValue[] {
  const coins: CoinCountingCoinValue[] = [];
  let rest = Math.max(1, Math.min(10, Math.floor(total)));
  for (const value of [5, 2, 1] as CoinCountingCoinValue[]) {
    while (rest >= value) {
      coins.push(value);
      rest -= value;
    }
  }
  return coins;
}

export function generateCoinCountingRound(_settings: SessionSettings, roundIndex = 1, random = Math.random): CoinCountingRound {
  const targetTotal = randomInt(1, 10, random);
  return {
    roundId: `coin-counting:round:${roundIndex}`,
    prompt: `Собери ${targetTotal}`,
    targetTotal,
    coins: shuffleItems(coinCountingCoins, random),
    suggestedCoins: buildCoinCountingSuggestion(targetTotal)
  };
}
