export type OpenDoorReward = {
  id: string;
  artId: string;
  label: string;
  color: string;
  glow: string;
  ttsId: string;
};

export type OpenDoorPhase = "closed" | "revealed" | "complete";

export type OpenDoorState = {
  phase: OpenDoorPhase;
  deck: OpenDoorReward[];
  reward?: OpenDoorReward;
  lastRewardId?: string;
  openedCount: number;
  maxSteps: number;
};

export const openDoorTargetId = "open-door:door";

// Testers: «тёплый свет? мягкое сердце?» and «перерисовать картинки» — behind
// the door are plain drawn things named with one simple word.
export const openDoorRewards: OpenDoorReward[] = [
  {
    id: "ball",
    artId: "open-door/ball",
    label: "мяч",
    color: "#2f80d1",
    glow: "#cfe6ff",
    ttsId: "open-door.ball",
  },
  {
    id: "kitten",
    artId: "open-door/kitten",
    label: "котёнок",
    color: "#e08a3c",
    glow: "#ffe0bf",
    ttsId: "open-door.kitten",
  },
  {
    id: "cake",
    artId: "open-door/cake",
    label: "торт",
    color: "#dc5f8b",
    glow: "#ffc2d6",
    ttsId: "open-door.cake",
  },
  {
    id: "toy-car",
    artId: "open-door/toy-car",
    label: "машинка",
    color: "#d84a3a",
    glow: "#ffd0c7",
    ttsId: "open-door.toy-car",
  },
  {
    id: "flower",
    artId: "open-door/flower",
    label: "цветок",
    color: "#54a96b",
    glow: "#c9f4c7",
    ttsId: "open-door.flower",
  },
  {
    id: "star",
    artId: "open-door/star",
    label: "звёздочка",
    color: "#d6a13a",
    glow: "#ffe7bd",
    ttsId: "open-door.star",
  },
  {
    id: "balloon",
    artId: "open-door/balloon",
    label: "шарик",
    color: "#d9473f",
    glow: "#ffd3cf",
    ttsId: "open-door.balloon",
  },
  {
    id: "gift",
    artId: "open-door/gift",
    label: "подарок",
    color: "#9a64c5",
    glow: "#f0dcff",
    ttsId: "open-door.gift",
  },
];

function shuffleRewards(random: () => number) {
  const deck = [...openDoorRewards];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.min(index, Math.floor(Math.max(0, random()) * (index + 1)));
    [deck[index], deck[randomIndex]] = [deck[randomIndex], deck[index]];
  }
  return deck;
}

function createRewardDeck(lastRewardId: string | undefined, random: () => number) {
  const deck = shuffleRewards(random);
  if (deck[0]?.id !== lastRewardId) return deck;

  const replacementIndex = deck.findIndex((reward) => reward.id !== lastRewardId);
  if (replacementIndex > 0) [deck[0], deck[replacementIndex]] = [deck[replacementIndex], deck[0]];
  return deck;
}

export function createOpenDoorState(
  maxSteps = 8,
  random: () => number = Math.random,
): OpenDoorState {
  return {
    phase: "closed",
    deck: createRewardDeck(undefined, random),
    openedCount: 0,
    maxSteps: Math.max(1, Math.trunc(maxSteps)),
  };
}

export function revealOpenDoor(
  state: OpenDoorState,
  random: () => number = Math.random,
): OpenDoorState {
  if (state.phase !== "closed" || state.openedCount >= state.maxSteps) return state;

  const deck = state.deck.length ? state.deck : createRewardDeck(state.lastRewardId, random);
  const [reward, ...remainingDeck] = deck;
  return {
    ...state,
    phase: "revealed",
    deck: remainingDeck,
    reward,
    lastRewardId: reward.id,
    openedCount: state.openedCount + 1,
  };
}

export function advanceOpenDoor(state: OpenDoorState): OpenDoorState {
  if (state.phase !== "revealed") return state;
  if (state.openedCount >= state.maxSteps) return { ...state, phase: "complete" };
  return { ...state, phase: "closed", reward: undefined };
}
