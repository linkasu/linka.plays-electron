import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type LogicPairRelation = "meaning" | "number";

export type LogicPairCard = {
  id: string;
  wordId?: string;
  artId?: string;
  label: string;
  visual: string;
};

export type LogicPairDefinition = {
  id: string;
  relation: LogicPairRelation;
  target: LogicPairCard;
  pair: LogicPairCard;
  explanation: string;
  /** Pairs whose answer looks alike; they never meet in one round. */
  lookalikes?: string[];
};

export type LogicPairsRound = {
  roundId: string;
  prompt: string;
  instruction: string;
  relation: LogicPairRelation;
  target: LogicPairCard;
  pair: LogicPairCard;
  choices: LogicPairCard[];
  correctIndex: number;
  explanation: string;
};

// Testers: «убрать геометрические фигуры» and «нарисовать картинки» — shape
// pairs are gone, meaning pairs are drawn; number rounds are spread between them.
export const logicPairDefinitions: LogicPairDefinition[] = [
  {
    id: "key-lock",
    relation: "meaning",
    target: { id: "key", artId: "logic-pairs/key", label: "ключ", visual: "🔑" },
    pair: { id: "lock", artId: "logic-pairs/lock", label: "замок", visual: "🔒" },
    explanation: "Ключ подходит к замку.",
  },
  {
    id: "spoon-plate",
    relation: "meaning",
    target: { id: "spoon", artId: "logic-pairs/spoon", label: "ложка", visual: "🥄" },
    pair: { id: "plate", artId: "logic-pairs/plate", label: "тарелка", visual: "🍽️" },
    explanation: "Ложкой едят из тарелки.",
  },
  {
    id: "hand-glove",
    relation: "meaning",
    target: { id: "hand", artId: "logic-pairs/hand", label: "рука", visual: "✋" },
    pair: { id: "glove", artId: "logic-pairs/glove", label: "перчатка", visual: "🧤" },
    explanation: "Перчатка надевается на руку.",
  },
  {
    id: "two-dots",
    relation: "number",
    target: { id: "number-2", label: "цифра два", visual: "2" },
    pair: { id: "dots-2", label: "две точки", visual: "••" },
    explanation: "Цифра 2 подходит к двум точкам.",
  },
  {
    id: "pencil-notebook",
    relation: "meaning",
    target: { id: "pencil", artId: "logic-pairs/pencil", label: "карандаш", visual: "✏️" },
    pair: { id: "notebook", artId: "logic-pairs/notebook", label: "тетрадь", visual: "📓" },
    explanation: "Карандашом пишут в тетради.",
  },
  {
    id: "cup-saucer",
    relation: "meaning",
    target: { id: "cup", artId: "logic-pairs/cup", label: "чашка", visual: "☕" },
    pair: { id: "saucer", artId: "logic-pairs/saucer", label: "блюдце", visual: "🍽️" },
    explanation: "Чашку ставят на блюдце.",
    // The drawn saucer and plate are both white dishes.
    lookalikes: ["spoon-plate"],
  },
  {
    id: "toothbrush-toothpaste",
    relation: "meaning",
    target: {
      id: "toothbrush",
      artId: "logic-pairs/toothbrush",
      label: "зубная щётка",
      visual: "🪥",
    },
    pair: {
      id: "toothpaste",
      artId: "logic-pairs/toothpaste",
      label: "зубная паста",
      visual: "🧴",
    },
    explanation: "Пасту выдавливают на зубную щётку.",
  },
  {
    id: "three-dots",
    relation: "number",
    target: { id: "number-3", label: "цифра три", visual: "3" },
    pair: { id: "dots-3", label: "три точки", visual: "•••" },
    explanation: "Цифра 3 подходит к трём точкам.",
  },
  {
    id: "sock-boot",
    relation: "meaning",
    target: { id: "sock", artId: "logic-pairs/sock", label: "носок", visual: "🧦" },
    pair: { id: "boot", artId: "logic-pairs/boot", label: "ботинок", visual: "🥾" },
    explanation: "Сначала носок, потом ботинок.",
  },
  {
    id: "paintbrush-paint",
    relation: "meaning",
    target: { id: "paintbrush", artId: "logic-pairs/paintbrush", label: "кисточка", visual: "🖌️" },
    pair: { id: "paint", artId: "logic-pairs/paint", label: "краска", visual: "🎨" },
    explanation: "Кисточку макают в краску.",
  },
  {
    id: "bucket-shovel",
    relation: "meaning",
    target: { id: "bucket", artId: "logic-pairs/bucket", label: "ведёрко", visual: "🪣" },
    pair: { id: "shovel", artId: "logic-pairs/shovel", label: "лопатка", visual: "🧹" },
    explanation: "Ведёрко и лопатка нужны в песочнице.",
  },
  {
    id: "four-dots",
    relation: "number",
    target: { id: "number-4", label: "цифра четыре", visual: "4" },
    pair: { id: "dots-4", label: "четыре точки", visual: "••••" },
    explanation: "Цифра 4 подходит к четырём точкам.",
  },
  {
    id: "ball-goal",
    relation: "meaning",
    target: { id: "ball", artId: "logic-pairs/ball", label: "мяч", visual: "⚽" },
    pair: { id: "goal", artId: "logic-pairs/goal", label: "ворота", visual: "🥅" },
    explanation: "Мяч забивают в ворота.",
  },
];

function choiceCountForSettings(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

function promptForRelation(relation: LogicPairRelation) {
  if (relation === "meaning") return "Что подходит по смыслу?";
  return "Что подходит по числу?";
}

function looksAlike(left: LogicPairDefinition, right: LogicPairDefinition) {
  return Boolean(left.lookalikes?.includes(right.id) || right.lookalikes?.includes(left.id));
}

export function generateLogicPairsRound(
  settings: SessionSettings,
  roundIndex = 1,
): LogicPairsRound {
  const choiceCount = choiceCountForSettings(settings);
  if (logicPairDefinitions.length < choiceCount)
    throw new Error("Недостаточно логических пар для игры.");

  const targetPair = logicPairDefinitions[(roundIndex - 1) % logicPairDefinitions.length];
  const picked = [targetPair];
  for (const pair of shuffleItems(logicPairDefinitions)) {
    if (picked.length === choiceCount) break;
    if (picked.some((other) => other.id === pair.id || looksAlike(other, pair))) continue;
    picked.push(pair);
  }
  const distractors = picked.slice(1).map((pair) => pair.pair);
  const choices = shuffleItems([targetPair.pair, ...distractors]);

  return {
    roundId: `logic-pairs:round:${roundIndex}`,
    prompt: promptForRelation(targetPair.relation),
    instruction: "Выбери карточку, которая образует пару.",
    relation: targetPair.relation,
    target: targetPair.target,
    pair: targetPair.pair,
    choices,
    correctIndex: choices.findIndex((choice) => choice.id === targetPair.pair.id),
    explanation: targetPair.explanation,
  };
}
