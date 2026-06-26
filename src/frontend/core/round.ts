import type { SessionSettings } from "./settings";
import { shuffleItems } from "./random";

export type ChoiceRound<T> = {
  roundId: string;
  prompt: string;
  target: T;
  choices: T[];
  correctIndex: number;
};

export type ChoiceCountByPresetConfig = {
  gentle: number | ((roundIndex: number) => number);
  standard: number | ((roundIndex: number) => number);
  challenge: number | ((roundIndex: number) => number);
  cap?: number;
};

export function choiceCountByPreset(settings: SessionSettings, roundIndex: number, config: ChoiceCountByPresetConfig) {
  const presetKey: keyof Omit<ChoiceCountByPresetConfig, "cap"> = settings.preset === "gentle"
    ? "gentle"
    : settings.preset === "challenge"
    ? "challenge"
    : "standard";
  const raw = config[presetKey];
  const value = typeof raw === "function" ? raw(Math.max(1, roundIndex)) : raw;
  const safe = Math.max(2, Math.floor(value));
  return config.cap ? Math.min(config.cap, safe) : safe;
}

export type BuildChoiceRoundInput<T> = {
  idPrefix: string;
  roundIndex: number;
  items: T[];
  choiceCount: number;
  pickTarget: (items: T[], roundIndex: number) => T;
  isSame: (left: T, right: T) => boolean;
  prompt: (target: T, roundIndex: number) => string;
  random?: () => number;
};

export function buildChoiceRound<T>(input: BuildChoiceRoundInput<T>): ChoiceRound<T> {
  if (input.items.length < 2) throw new Error(`buildChoiceRound: pool too small for ${input.idPrefix}.`);

  const requested = Math.max(2, Math.floor(input.choiceCount));
  const choiceCount = Math.min(requested, input.items.length);
  const target = input.pickTarget(input.items, Math.max(1, input.roundIndex));
  const distractors = shuffleItems(input.items.filter((item) => !input.isSame(item, target)), input.random).slice(0, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors], input.random);
  const correctIndex = choices.findIndex((choice) => input.isSame(choice, target));

  return {
    roundId: `${input.idPrefix}:round:${input.roundIndex}`,
    prompt: input.prompt(target, input.roundIndex),
    target,
    choices,
    correctIndex
  };
}

export function pickByRoundIndex<T>(items: T[], roundIndex: number) {
  if (items.length === 0) throw new Error("pickByRoundIndex: empty items.");
  const safe = Math.max(1, Math.floor(roundIndex));
  return items[(safe - 1) % items.length];
}

export function pickRandom<T>(items: T[], random = Math.random) {
  if (items.length === 0) throw new Error("pickRandom: empty items.");
  return items[Math.floor(random() * items.length)];
}

export function idEquality<T extends { id: string }>(left: T, right: T) {
  return left.id === right.id;
}

export function referenceEquality<T>(left: T, right: T) {
  return left === right;
}
