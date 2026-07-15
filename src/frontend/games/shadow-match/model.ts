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

function shadowChoices(id: string): ShadowMatchChoice[] {
  const basePath = `./images/shadow-match/${id}-shadow`;
  return [
    { id: `${id}-correct`, imageSrc: `${basePath}-correct.png`, isCorrect: true },
    { id: `${id}-3`, imageSrc: `${basePath}-3.png`, isCorrect: false },
    { id: `${id}-4`, imageSrc: `${basePath}-4.png`, isCorrect: false },
    { id: `${id}-5`, imageSrc: `${basePath}-5.png`, isCorrect: false }
  ];
}

export const shadowMatchItems: ShadowMatchItem[] = [
  { id: "kitten", label: "котёнок", imageSrc: "./images/shadow-match/kitten.png", hint: "сравни ушки, лапки и хвост", shadows: shadowChoices("kitten") },
  { id: "house", label: "дом", imageSrc: "./images/shadow-match/house.png", hint: "сравни крышу, окна и трубу", shadows: shadowChoices("house") },
  { id: "dog", label: "пёс", imageSrc: "./images/shadow-match/dog.png", hint: "сравни ушки, лапки и хвост", shadows: shadowChoices("dog") },
  { id: "butterfly", label: "бабочка", imageSrc: "./images/shadow-match/butterfly.png", hint: "сравни форму крыльев и усики", shadows: shadowChoices("butterfly") }
];

function choiceCountForSettings(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

export function generateShadowMatchRound(settings: SessionSettings, roundIndex = 1): ShadowMatchRound {
  const choiceCount = choiceCountForSettings(settings);
  const target = shadowMatchItems[(roundIndex - 1) % shadowMatchItems.length];
  const correctChoice = target.shadows.find((choice) => choice.isCorrect);
  if (!correctChoice) throw new Error(`Для предмета «${target.label}» не задана правильная тень.`);

  const distractors = target.shadows.filter((choice) => !choice.isCorrect);
  if (distractors.length < choiceCount - 1) throw new Error(`Недостаточно вариантов тени для предмета «${target.label}».`);

  const distractorOffset = (roundIndex - 1) % distractors.length;
  const choices = Array.from(
    { length: choiceCount - 1 },
    (_, index) => distractors[(distractorOffset + index) % distractors.length]
  );
  const correctIndex = (roundIndex - 1) % choiceCount;
  choices.splice(correctIndex, 0, correctChoice);

  return {
    roundId: `shadow-match:round:${roundIndex}`,
    prompt: "Найди правильную тень",
    target,
    choices,
    correctIndex
  };
}
