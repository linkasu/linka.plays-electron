import type { SessionSettings } from "../../core/settings";

export type ShadowMatchChoice = {
  id: string;
  imageSrc: string;
  isCorrect: boolean;
};

export type ShadowMatchItem = {
  id: string;
  label: string;
  imageSrc: string;
  hint: string;
  shadows: ShadowMatchChoice[];
};

export type ShadowMatchRound = {
  roundId: string;
  prompt: string;
  target: ShadowMatchItem;
  choices: ShadowMatchChoice[];
  correctIndex: number;
};

type ShadowMatchSource = { id: string; label: string; hint: string };

// Testers: «ПЕРЕРИСОВАТЬ!». The new set draws one exact shadow per object, so
// the wrong choices are the shadows of the other objects: the child compares
// outlines, not three near-identical silhouettes of the same thing.
const sources: ShadowMatchSource[] = [
  { id: "kettle", label: "чайник", hint: "сравни носик и ручку" },
  { id: "umbrella", label: "зонтик", hint: "сравни купол и ручку" },
  { id: "cat", label: "кошка", hint: "сравни ушки, лапки и хвост" },
  { id: "car", label: "машинка", hint: "сравни колёса и крышу" },
  { id: "fir-tree", label: "ёлка", hint: "сравни ветки и ствол" },
  { id: "fish", label: "рыбка", hint: "сравни хвост и плавники" },
  { id: "airplane", label: "самолёт", hint: "сравни крылья и хвост" },
  { id: "mushroom", label: "гриб", hint: "сравни шляпку и ножку" },
];

const imageSrc = (id: string) => `./images/shadow-match/${id}.png`;
const shadowSrc = (id: string) => `./images/shadow-match/${id}-shadow.png`;

export const shadowMatchItems: ShadowMatchItem[] = sources.map((source) => ({
  ...source,
  imageSrc: imageSrc(source.id),
  shadows: sources.map((other) => ({
    id: other.id === source.id ? `${source.id}-correct` : `${source.id}-other-${other.id}`,
    imageSrc: shadowSrc(other.id),
    isCorrect: other.id === source.id,
  })),
}));

function choiceCountForSettings(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

export function generateShadowMatchRound(
  settings: SessionSettings,
  roundIndex = 1,
): ShadowMatchRound {
  const choiceCount = choiceCountForSettings(settings);
  const target = shadowMatchItems[(roundIndex - 1) % shadowMatchItems.length];
  const correctChoice = target.shadows.find((choice) => choice.isCorrect);
  if (!correctChoice) throw new Error(`Для предмета «${target.label}» не задана правильная тень.`);

  const distractors = target.shadows.filter((choice) => !choice.isCorrect);
  if (distractors.length < choiceCount - 1)
    throw new Error(`Недостаточно вариантов тени для предмета «${target.label}».`);

  const distractorOffset = (roundIndex - 1) % distractors.length;
  const choices = Array.from(
    { length: choiceCount - 1 },
    (_, index) => distractors[(distractorOffset + index) % distractors.length],
  );
  const correctIndex = (roundIndex - 1) % choiceCount;
  choices.splice(correctIndex, 0, correctChoice);

  return {
    roundId: `shadow-match:round:${roundIndex}`,
    prompt: "Найди правильную тень",
    target,
    choices,
    correctIndex,
  };
}
