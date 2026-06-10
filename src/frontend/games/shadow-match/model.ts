import type { SessionSettings } from "../../core/settings";

export type ShadowMatchItem = {
  id: string;
  label: string;
  icon: string;
  color: string;
  hint: string;
};

export type ShadowMatchRound = {
  roundId: string;
  prompt: string;
  target: ShadowMatchItem;
  choices: ShadowMatchItem[];
  correctIndex: number;
};

export const shadowMatchItems: ShadowMatchItem[] = [
  { id: "house", label: "домик", icon: "mdi-home-outline", color: "deep-orange", hint: "у тени есть крыша" },
  { id: "tree", label: "дерево", icon: "mdi-tree-outline", color: "green", hint: "у тени есть ствол" },
  { id: "flower", label: "цветок", icon: "mdi-flower-outline", color: "pink", hint: "тень похожа на лепестки" },
  { id: "fish", label: "рыбка", icon: "mdi-fish", color: "cyan", hint: "у тени есть хвостик" },
  { id: "duck", label: "утка", icon: "mdi-duck", color: "amber", hint: "тень похожа на уточку" },
  { id: "star", label: "звезда", icon: "mdi-star-outline", color: "yellow-darken-2", hint: "у тени острые лучики" },
  { id: "cloud", label: "облако", icon: "mdi-cloud-outline", color: "blue-lighten-1", hint: "тень мягкая и круглая" },
  { id: "boat", label: "лодочка", icon: "mdi-sail-boat", color: "indigo", hint: "у тени есть парус" },
  { id: "mushroom", label: "грибок", icon: "mdi-mushroom-outline", color: "brown", hint: "у тени широкая шляпка" }
];

function choiceCountForSettings(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

function takeDistractors(target: ShadowMatchItem, roundIndex: number, count: number) {
  const pool = shadowMatchItems.filter((item) => item.id !== target.id);
  const distractors: ShadowMatchItem[] = [];
  let cursor = roundIndex;

  while (distractors.length < count) {
    const item = pool[cursor % pool.length];
    if (!distractors.some((existing) => existing.id === item.id)) distractors.push(item);
    cursor += 2;
  }

  return distractors;
}

export function generateShadowMatchRound(settings: SessionSettings, roundIndex = 1): ShadowMatchRound {
  const choiceCount = choiceCountForSettings(settings);
  if (shadowMatchItems.length < choiceCount) throw new Error("Недостаточно предметов для игры с тенями.");

  const target = shadowMatchItems[((roundIndex - 1) * 2) % shadowMatchItems.length];
  const correctIndex = (roundIndex - 1) % choiceCount;
  const choices = takeDistractors(target, roundIndex, choiceCount - 1);
  choices.splice(correctIndex, 0, target);

  return {
    roundId: `shadow-match:round:${roundIndex}`,
    prompt: "Какая картинка даёт такую тень?",
    target,
    choices,
    correctIndex
  };
}
