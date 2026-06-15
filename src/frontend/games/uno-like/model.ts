import type { SessionSettings } from "../../core/settings";

export type UnoLikeColorId = "red" | "blue" | "green" | "yellow";
export type UnoLikeMatchTrait = "color" | "number";

export type UnoLikeColor = {
  id: UnoLikeColorId;
  label: string;
  hex: string;
  textColor: string;
};

export const unoLikeNumbers = [1, 2, 3, 4, 5, 6] as const;
export type UnoLikeNumber = (typeof unoLikeNumbers)[number];

export type UnoLikeCard = {
  id: string;
  color: UnoLikeColor;
  number: UnoLikeNumber;
  label: string;
};

export type UnoLikeRound = {
  roundId: string;
  prompt: string;
  instruction: string;
  openCard: UnoLikeCard;
  choices: UnoLikeCard[];
  playableIds: string[];
  correctIndexes: number[];
};

export const unoLikeColors: UnoLikeColor[] = [
  { id: "red", label: "красный", hex: "#d83a3a", textColor: "#ffffff" },
  { id: "blue", label: "синий", hex: "#2f6fdb", textColor: "#ffffff" },
  { id: "green", label: "зелёный", hex: "#1b5e20", textColor: "#ffffff" },
  { id: "yellow", label: "жёлтый", hex: "#f8c73e", textColor: "#25210c" }
];

export function createUnoLikeCard(color: UnoLikeColor, number: UnoLikeNumber): UnoLikeCard {
  return {
    id: `${color.id}-${number}`,
    color,
    number,
    label: `${color.label} ${number}`
  };
}

export const unoLikeDeck: UnoLikeCard[] = unoLikeColors.flatMap((color) => unoLikeNumbers.map((number) => createUnoLikeCard(color, number)));

export function getUnoLikeMatchTraits(card: UnoLikeCard, openCard: UnoLikeCard): UnoLikeMatchTrait[] {
  const traits: UnoLikeMatchTrait[] = [];
  if (card.color.id === openCard.color.id) traits.push("color");
  if (card.number === openCard.number) traits.push("number");
  return traits;
}

export function isUnoLikePlayable(card: UnoLikeCard, openCard: UnoLikeCard) {
  return getUnoLikeMatchTraits(card, openCard).length > 0;
}

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 3;
  if (settings.preset === "challenge") return 5;
  return 4;
}

function rotateItems<T>(items: T[], offset: number) {
  const normalizedOffset = offset % items.length;
  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function pushCandidate(choices: UnoLikeCard[], openCard: UnoLikeCard, startOffset: number, predicate: (card: UnoLikeCard) => boolean) {
  const openIndex = unoLikeDeck.findIndex((card) => card.id === openCard.id);
  for (let step = 0; step < unoLikeDeck.length; step += 1) {
    const candidate = unoLikeDeck[(openIndex + startOffset + step) % unoLikeDeck.length];
    if (candidate.id !== openCard.id && !choices.some((choice) => choice.id === candidate.id) && predicate(candidate)) {
      choices.push(candidate);
      return;
    }
  }
}

export function generateUnoLikeRound(settings: SessionSettings, roundIndex = 1): UnoLikeRound {
  const choiceCount = choiceCountFor(settings);
  if (unoLikeDeck.length < choiceCount + 1) throw new Error("Недостаточно карт для уно-подобной игры.");

  const openCard = unoLikeDeck[((roundIndex - 1) * 5) % unoLikeDeck.length];
  const choices: UnoLikeCard[] = [];

  pushCandidate(choices, openCard, roundIndex, (card) => card.color.id === openCard.color.id && card.number !== openCard.number);
  pushCandidate(choices, openCard, roundIndex + unoLikeNumbers.length, (card) => card.number === openCard.number && card.color.id !== openCard.color.id);

  while (choices.length < choiceCount) {
    pushCandidate(choices, openCard, roundIndex + choices.length * 3, (card) => card.color.id !== openCard.color.id && card.number !== openCard.number);
  }

  const rotatedChoices = rotateItems(choices, roundIndex % choices.length);
  const playableIds = rotatedChoices.filter((card) => isUnoLikePlayable(card, openCard)).map((card) => card.id);

  return {
    roundId: `uno-like:round:${roundIndex}`,
    prompt: "Выбери карту по цвету или числу",
    instruction: "Подходит карта того же цвета или с таким же числом, как открытая карта.",
    openCard,
    choices: rotatedChoices,
    playableIds,
    correctIndexes: rotatedChoices.reduce<number[]>((indexes, card, index) => {
      if (playableIds.includes(card.id)) indexes.push(index);
      return indexes;
    }, [])
  };
}
