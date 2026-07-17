export type ObjectActionChoice = {
  id: string;
  title: string;
  actorEmoji: string;
  propEmoji: string;
  cueEmoji: string;
  settingEmoji: string;
  sceneLabel: string;
  successText: string;
  successAssetId?: string;
};

export type ObjectActionRound = {
  roundId: string;
  prompt: string;
  targetAction: ObjectActionChoice;
  choices: ObjectActionChoice[];
  correctChoice: ObjectActionChoice;
  explanation: string;
};

export const objectActionChoices: ObjectActionChoice[] = [
  {
    id: "drink",
    title: "пить",
    actorEmoji: "🧑",
    propEmoji: "🥤",
    cueEmoji: "↗️",
    settingEmoji: "💧",
    sceneLabel: "Человек подносит чашку ко рту и пьёт",
    successText: "Человек пьёт из чашки.",
    successAssetId: "object-action.phrase.cup-drink"
  },
  {
    id: "eat",
    title: "есть",
    actorEmoji: "😋",
    propEmoji: "🥣",
    cueEmoji: "🥄",
    settingEmoji: "🍽️",
    sceneLabel: "Человек ест ложкой из миски",
    successText: "Человек ест ложкой.",
    successAssetId: "object-action.phrase.spoon-eat"
  },
  {
    id: "sleep",
    title: "спать",
    actorEmoji: "😴",
    propEmoji: "🛏️",
    cueEmoji: "💤",
    settingEmoji: "🌙",
    sceneLabel: "Человек спит в кровати ночью",
    successText: "Человек спит в кровати."
  },
  {
    id: "walk",
    title: "идти",
    actorEmoji: "🚶",
    propEmoji: "🌳",
    cueEmoji: "➡️",
    settingEmoji: "🛤️",
    sceneLabel: "Человек идёт вперёд по дорожке",
    successText: "Человек идёт по дорожке."
  },
  {
    id: "wash",
    title: "мыть",
    actorEmoji: "👐",
    propEmoji: "🧼",
    cueEmoji: "💦",
    settingEmoji: "🚰",
    sceneLabel: "Человек моет руки водой с мылом",
    successText: "Человек моет руки с мылом.",
    successAssetId: "object-action.phrase.soap-wash"
  },
  {
    id: "draw",
    title: "рисовать",
    actorEmoji: "🧑‍🎨",
    propEmoji: "🖍️",
    cueEmoji: "✍️",
    settingEmoji: "📄",
    sceneLabel: "Человек рисует карандашом на бумаге",
    successText: "Человек рисует карандашом.",
    successAssetId: "object-action.phrase.pencil-draw"
  },
  {
    id: "roll",
    title: "катать",
    actorEmoji: "🧒",
    propEmoji: "⚽",
    cueEmoji: "↔️",
    settingEmoji: "🛝",
    sceneLabel: "Ребёнок толкает и катает мяч",
    successText: "Ребёнок катает мяч.",
    successAssetId: "object-action.phrase.ball-roll"
  }
];

export function createObjectActionExplanation(action: ObjectActionChoice) {
  return `Это действие — ${action.title}.`;
}

export function isObjectActionCorrect(round: ObjectActionRound, choice: ObjectActionChoice) {
  return round.correctChoice.id === choice.id;
}

export function generateObjectActionRound(roundIndex = 1): ObjectActionRound {
  if (objectActionChoices.length < 4) throw new Error("Недостаточно визуальных сцен действий для игры.");

  const normalizedIndex = Math.max(1, Math.floor(roundIndex));
  const targetIndex = (normalizedIndex - 1) % objectActionChoices.length;
  const targetAction = objectActionChoices[targetIndex];
  const selected = [targetAction];
  for (let offset = 1; selected.length < 4; offset += 1) {
    selected.push(objectActionChoices[(targetIndex + offset) % objectActionChoices.length]);
  }
  const shift = (normalizedIndex - 1) % selected.length;
  const choices = selected.map((_, index) => selected[(index + shift) % selected.length]);

  return {
    roundId: `object-action:round:${normalizedIndex}`,
    prompt: `Покажи действие: ${targetAction.title}.`,
    targetAction,
    choices,
    correctChoice: targetAction,
    explanation: createObjectActionExplanation(targetAction)
  };
}
