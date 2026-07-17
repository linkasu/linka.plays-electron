export type OpenDoorReward = {
  id: string;
  icon: string;
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

export const openDoorRewards: OpenDoorReward[] = [
  { id: "warm-light", icon: "mdi-lightbulb-on", label: "тёплый свет", color: "#e6a425", glow: "#ffe5a3", ttsId: "open-door.warm-light" },
  { id: "pink-heart", icon: "mdi-heart", label: "розовое сердце", color: "#dc5f8b", glow: "#ffc2d6", ttsId: "open-door.pink-heart" },
  { id: "green-flower", icon: "mdi-flower", label: "зелёный цветок", color: "#54a96b", glow: "#c9f4c7", ttsId: "open-door.green-flower" },
  { id: "violet-star", icon: "mdi-star", label: "фиолетовая звезда", color: "#9a64c5", glow: "#f9e7ff", ttsId: "open-door.violet-star" },
  { id: "sun-ray", icon: "mdi-weather-sunny", label: "лучик солнца", color: "#e7a72e", glow: "#ffdf8a", ttsId: "open-door.sun-ray" },
  { id: "fluffy-cloud", icon: "mdi-cloud", label: "пушистое облако", color: "#70a8df", glow: "#d7ecff", ttsId: "open-door.fluffy-cloud" },
  { id: "music-note", icon: "mdi-music-note", label: "нота", color: "#7469ca", glow: "#d8d1ff", ttsId: "open-door.music-note" },
  { id: "gold-spark", icon: "mdi-creation", label: "золотая искра", color: "#d6a13a", glow: "#ffe7bd", ttsId: "open-door.gold-spark" }
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

export function createOpenDoorState(maxSteps = 8, random: () => number = Math.random): OpenDoorState {
  return {
    phase: "closed",
    deck: createRewardDeck(undefined, random),
    openedCount: 0,
    maxSteps: Math.max(1, Math.trunc(maxSteps))
  };
}

export function revealOpenDoor(state: OpenDoorState, random: () => number = Math.random): OpenDoorState {
  if (state.phase !== "closed" || state.openedCount >= state.maxSteps) return state;

  const deck = state.deck.length ? state.deck : createRewardDeck(state.lastRewardId, random);
  const [reward, ...remainingDeck] = deck;
  return {
    ...state,
    phase: "revealed",
    deck: remainingDeck,
    reward,
    lastRewardId: reward.id,
    openedCount: state.openedCount + 1
  };
}

export function advanceOpenDoor(state: OpenDoorState): OpenDoorState {
  if (state.phase !== "revealed") return state;
  if (state.openedCount >= state.maxSteps) return { ...state, phase: "complete" };
  return { ...state, phase: "closed", reward: undefined };
}
