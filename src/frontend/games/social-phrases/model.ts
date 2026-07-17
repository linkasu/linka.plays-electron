import { shuffleItems } from "../../core/random";

export type PhraseKind = "greeting" | "request" | "thanks";

export type FunctionalPhraseKind = "refusal" | "help" | "stop";

export type SocialPhraseChoice = {
  id: string;
  kind: PhraseKind | "functional";
  function?: FunctionalPhraseKind;
  icon: string;
  color: string;
  iconColor: string;
  text: string;
  accepted: boolean;
  endsSession?: boolean;
};

export type SocialPhraseScene = {
  id: string;
  scene: string;
  prompt: string;
  partner: string;
  sceneIcon: string;
  sceneColor: string;
  expectedKind: PhraseKind;
  choices: SocialPhraseChoice[];
  correctFeedback: string;
  mistakeFeedback: string;
};

export type SocialPhraseRound = Omit<SocialPhraseScene, "choices"> & {
  roundId: string;
  choices: SocialPhraseChoice[];
  expectedChoice: SocialPhraseChoice;
};

export type SocialPhraseEvaluation = {
  type: "communication" | "hint";
  phrase: string;
  feedback: string;
  isCorrect: boolean;
  noFail: true;
  functional: boolean;
  endsSession: boolean;
};

export const socialPhrasesInstruction = "Посмотри на ситуацию и выбери, что можно сказать. Если тебе нужна помощь, ты не хочешь или хочешь остановиться, выбери такую карточку: это тоже важный ответ.";

export const socialPhraseScenes: SocialPhraseScene[] = [
  {
    id: "morning-adult",
    scene: "Утром ты встречаешь знакомого взрослого.",
    prompt: "Что можно сказать?",
    partner: "Взрослый улыбается и смотрит на тебя.",
    sceneIcon: "mdi-weather-sunset-up",
    sceneColor: "amber-lighten-5",
    expectedKind: "greeting",
    choices: [
      { id: "good-morning", kind: "greeting", icon: "mdi-weather-sunny", color: "amber-lighten-4", iconColor: "amber-darken-4", text: "Доброе утро!", accepted: true },
      { id: "good-evening", kind: "greeting", icon: "mdi-weather-night", color: "deep-purple-lighten-5", iconColor: "deep-purple-darken-3", text: "Добрый вечер!", accepted: false },
      { id: "no-greeting", kind: "functional", function: "refusal", icon: "mdi-comment-off-outline", color: "red-lighten-5", iconColor: "red-darken-3", text: "Я не хочу здороваться.", accepted: true },
      { id: "help-greeting", kind: "functional", function: "help", icon: "mdi-help-circle-outline", color: "blue-lighten-5", iconColor: "blue-darken-3", text: "Помоги мне поздороваться.", accepted: true }
    ],
    correctFeedback: "Взрослый услышал твоё приветствие.",
    mistakeFeedback: "Сейчас утро. Посмотри на картинки солнца и луны."
  },
  {
    id: "thirsty",
    scene: "Тебе хочется пить, а вода стоит далеко.",
    prompt: "Что можно попросить?",
    partner: "Человек рядом может подать нужный предмет.",
    sceneIcon: "mdi-cup-water",
    sceneColor: "blue-lighten-5",
    expectedKind: "request",
    choices: [
      { id: "water-please", kind: "request", icon: "mdi-cup-water", color: "blue-lighten-4", iconColor: "blue-darken-3", text: "Дай воды, пожалуйста.", accepted: true },
      { id: "book-please", kind: "request", icon: "mdi-book-open-page-variant-outline", color: "green-lighten-5", iconColor: "green-darken-3", text: "Дай книгу, пожалуйста.", accepted: false },
      { id: "no-water", kind: "functional", function: "refusal", icon: "mdi-cup-off-outline", color: "red-lighten-5", iconColor: "red-darken-3", text: "Нет, я не хочу пить.", accepted: true },
      { id: "help-water", kind: "functional", function: "help", icon: "mdi-help-circle-outline", color: "amber-lighten-5", iconColor: "amber-darken-4", text: "Помоги мне попросить воду.", accepted: true }
    ],
    correctFeedback: "Тебя услышали и подали воду.",
    mistakeFeedback: "Ты хочешь пить. Найди карточку со стаканом воды."
  },
  {
    id: "opened-box",
    scene: "Тебе помогли открыть коробку.",
    prompt: "За что можно поблагодарить?",
    partner: "Коробка открыта, и человек ждёт твоего ответа.",
    sceneIcon: "mdi-package-variant-closed-check",
    sceneColor: "green-lighten-5",
    expectedKind: "thanks",
    choices: [
      { id: "thanks-open", kind: "thanks", icon: "mdi-package-variant-closed-check", color: "green-lighten-4", iconColor: "green-darken-3", text: "Спасибо, что помог открыть коробку.", accepted: true },
      { id: "thanks-book", kind: "thanks", icon: "mdi-book-heart-outline", color: "blue-lighten-5", iconColor: "blue-darken-3", text: "Спасибо за книгу.", accepted: false },
      { id: "no-speaking", kind: "functional", function: "refusal", icon: "mdi-comment-off-outline", color: "red-lighten-5", iconColor: "red-darken-3", text: "Я не хочу говорить.", accepted: true },
      { id: "help-thanks", kind: "functional", function: "help", icon: "mdi-help-circle-outline", color: "amber-lighten-5", iconColor: "amber-darken-4", text: "Помоги мне сказать спасибо.", accepted: true }
    ],
    correctFeedback: "Человек понял твою благодарность.",
    mistakeFeedback: "Посмотри, что уже открыли: коробку или книгу?"
  },
  {
    id: "loud-activity",
    scene: "На занятии стало слишком громко.",
    prompt: "Что можно попросить?",
    partner: "Взрослый рядом может сделать звук тише или остановиться.",
    sceneIcon: "mdi-volume-high",
    sceneColor: "deep-orange-lighten-5",
    expectedKind: "request",
    choices: [
      { id: "quieter-please", kind: "request", icon: "mdi-volume-low", color: "green-lighten-5", iconColor: "green-darken-3", text: "Сделай тише, пожалуйста.", accepted: true },
      { id: "louder-please", kind: "request", icon: "mdi-volume-high", color: "deep-purple-lighten-5", iconColor: "deep-purple-darken-3", text: "Сделай громче, пожалуйста.", accepted: false },
      { id: "stop-please", kind: "functional", function: "stop", icon: "mdi-stop-circle-outline", color: "red-lighten-5", iconColor: "red-darken-3", text: "Стоп, пожалуйста.", accepted: true, endsSession: true },
      { id: "help-noise", kind: "functional", function: "help", icon: "mdi-help-circle-outline", color: "amber-lighten-5", iconColor: "amber-darken-4", text: "Помоги мне, пожалуйста.", accepted: true }
    ],
    correctFeedback: "Тебя услышали и сделали звук тише.",
    mistakeFeedback: "Сейчас и так громко. Найди тихий динамик или попроси остановиться."
  }
];

function buildSocialPhraseRound(scene: SocialPhraseScene, roundIndex: number, random = Math.random): SocialPhraseRound {
  const choices = shuffleItems(scene.choices.map((choice) => ({ ...choice })), random);
  const expectedChoice = choices.find((choice) => choice.kind === scene.expectedKind && choice.accepted);
  if (!expectedChoice) throw new Error(`Нет подходящей фразы для ситуации ${scene.id}.`);

  return {
    ...scene,
    roundId: `social-phrases:${scene.id}:round:${roundIndex}`,
    choices,
    expectedChoice
  };
}

export function createSocialPhraseDeck(random = Math.random): SocialPhraseRound[] {
  return shuffleItems(socialPhraseScenes, random).map((scene, index) => buildSocialPhraseRound(scene, index + 1, random));
}

export function getSocialPhraseChoice(round: SocialPhraseRound, choiceId: string) {
  const choice = round.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`Нет фразы ${choiceId} в раунде ${round.roundId}.`);
  return choice;
}

export function evaluateSocialPhraseChoice(round: SocialPhraseRound, choice: SocialPhraseChoice): SocialPhraseEvaluation {
  const functional = choice.kind === "functional";
  const accepted = choice.accepted || functional;
  return {
    type: accepted ? "communication" : "hint",
    phrase: choice.text,
    feedback: accepted ? functional ? "Я услышал твой ответ." : round.correctFeedback : round.mistakeFeedback,
    isCorrect: accepted,
    noFail: true,
    functional,
    endsSession: choice.endsSession === true
  };
}

export function validateSocialPhraseScenes() {
  const errors: string[] = [];
  for (const scene of socialPhraseScenes) {
    if (!scene.scene) errors.push(`${scene.id}: empty scene`);
    if (!scene.prompt) errors.push(`${scene.id}: empty prompt`);
    if (!scene.sceneIcon.startsWith("mdi-")) errors.push(`${scene.id}: missing scene icon`);
    if (scene.choices.length < 3 || scene.choices.length > 4) errors.push(`${scene.id}: expected 3 or 4 choices`);
    if (!scene.choices.some((choice) => choice.kind === scene.expectedKind && choice.accepted)) errors.push(`${scene.id}: no expected choice`);
    if (scene.choices.some((choice) => choice.kind !== "functional" && choice.kind !== scene.expectedKind)) errors.push(`${scene.id}: mixed semantic roles`);
    if (scene.choices.some((choice) => choice.kind === "functional" && (!choice.function || !choice.accepted))) errors.push(`${scene.id}: invalid functional choice`);
    if (new Set(scene.choices.map((choice) => choice.id)).size !== scene.choices.length) errors.push(`${scene.id}: duplicate choice id`);
    if (new Set(scene.choices.map((choice) => choice.icon)).size !== scene.choices.length) errors.push(`${scene.id}: duplicate choice icon`);
    if (new Set(scene.choices.map((choice) => choice.color)).size !== scene.choices.length) errors.push(`${scene.id}: duplicate choice color`);
    if (scene.choices.some((choice) => !choice.text || !/[.!?]$/.test(choice.text))) errors.push(`${scene.id}: incomplete phrase`);
  }
  return errors;
}
