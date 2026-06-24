import { shuffleItems } from "../../core/random";

export type PhraseKind = "greeting" | "request" | "thanks";

export type SocialPhraseChoice = {
  id: string;
  kind: PhraseKind;
  emoji: string;
  text: string;
};

export type SocialPhraseScene = {
  id: string;
  scene: string;
  prompt: string;
  partner: string;
  expectedKind: PhraseKind;
  choices: SocialPhraseChoice[];
  correctFeedback: string;
  mistakeFeedback: string;
};

export type SocialPhraseRound = SocialPhraseScene & {
  roundId: string;
  choices: SocialPhraseChoice[];
  correctChoice: SocialPhraseChoice;
  correctIndex: number;
};

export const kindLabels: Record<PhraseKind, string> = {
  greeting: "приветствие",
  request: "просьба",
  thanks: "благодарность"
};

export const kindHints: Record<PhraseKind, string> = {
  greeting: "Здесь ждут приветствие.",
  request: "Здесь нужна просьба.",
  thanks: "Здесь хочется благодарности."
};

export const socialPhraseScenes: SocialPhraseScene[] = [
  {
    id: "morning-adult",
    scene: "Утром ты видишь знакомого взрослого.",
    prompt: "Поздоровайся.",
    partner: "Взрослый улыбается тебе.",
    expectedKind: "greeting",
    choices: [
      { id: "good-morning", kind: "greeting", emoji: "🌤️", text: "Доброе утро!" },
      { id: "water-please", kind: "request", emoji: "💧", text: "Можно воды?" },
      { id: "thank-you", kind: "thanks", emoji: "💛", text: "Спасибо!" }
    ],
    correctFeedback: "Взрослый улыбается в ответ.",
    mistakeFeedback: "Сначала можно поздороваться."
  },
  {
    id: "thirsty",
    scene: "Тебе хочется пить.",
    prompt: "Попроси воду.",
    partner: "Рядом стоит стакан с водой.",
    expectedKind: "request",
    choices: [
      { id: "hello", kind: "greeting", emoji: "👋", text: "Привет!" },
      { id: "may-i-have-water", kind: "request", emoji: "🥤", text: "Дай воды, пожалуйста" },
      { id: "thanks-help", kind: "thanks", emoji: "🙏", text: "Спасибо за помощь" }
    ],
    correctFeedback: "Тебя услышали и подали воду.",
    mistakeFeedback: "Если хочется пить, лучше попросить воду."
  },
  {
    id: "opened-box",
    scene: "Тебе помогли открыть коробку.",
    prompt: "Поблагодари.",
    partner: "Коробка уже открыта.",
    expectedKind: "thanks",
    choices: [
      { id: "hi", kind: "greeting", emoji: "😊", text: "Здравствуйте!" },
      { id: "help-please", kind: "request", emoji: "🤝", text: "Помоги, пожалуйста" },
      { id: "thank-open", kind: "thanks", emoji: "🎁", text: "Спасибо, что открыл" }
    ],
    correctFeedback: "Человек понял твою благодарность.",
    mistakeFeedback: "Коробку уже открыли. Можно сказать спасибо."
  },
  {
    id: "friend-arrives",
    scene: "В комнату пришёл друг.",
    prompt: "Поздоровайся с другом.",
    partner: "Друг смотрит на тебя и машет рукой.",
    expectedKind: "greeting",
    choices: [
      { id: "friend-hi", kind: "greeting", emoji: "👋", text: "Привет!" },
      { id: "toy-please", kind: "request", emoji: "🧸", text: "Дай игрушку, пожалуйста" },
      { id: "thanks-friend", kind: "thanks", emoji: "⭐", text: "Спасибо тебе" }
    ],
    correctFeedback: "Друг рад твоему приветствию.",
    mistakeFeedback: "Друг пришёл и машет. Можно сказать привет."
  },
  {
    id: "far-card",
    scene: "Нужная карточка лежит далеко.",
    prompt: "Попроси карточку.",
    partner: "Человек рядом может её подать.",
    expectedKind: "request",
    choices: [
      { id: "good-day", kind: "greeting", emoji: "☀️", text: "Добрый день!" },
      { id: "card-please", kind: "request", emoji: "🃏", text: "Подай карточку, пожалуйста" },
      { id: "thanks-card", kind: "thanks", emoji: "💚", text: "Спасибо за карточку" }
    ],
    correctFeedback: "Человек подал карточку.",
    mistakeFeedback: "Карточка далеко. Можно попросить её подать."
  },
  {
    id: "favorite-book",
    scene: "Тебе дали любимую книгу.",
    prompt: "Скажи спасибо.",
    partner: "Книга уже у тебя в руках.",
    expectedKind: "thanks",
    choices: [
      { id: "book-hello", kind: "greeting", emoji: "🙋", text: "Приветствую!" },
      { id: "read-please", kind: "request", emoji: "📖", text: "Почитай, пожалуйста" },
      { id: "thanks-book", kind: "thanks", emoji: "📚", text: "Спасибо за книгу" }
    ],
    correctFeedback: "Твоё спасибо услышали.",
    mistakeFeedback: "Книгу уже дали. Можно поблагодарить."
  },
  {
    id: "narrow-way",
    scene: "Ты хочешь пройти к столу.",
    prompt: "Попроси место.",
    partner: "Проход узкий.",
    expectedKind: "request",
    choices: [
      { id: "table-hi", kind: "greeting", emoji: "🙂", text: "Здравствуйте" },
      { id: "pass-please", kind: "request", emoji: "➡️", text: "Можно пройти?" },
      { id: "thanks-place", kind: "thanks", emoji: "🌟", text: "Спасибо за место" }
    ],
    correctFeedback: "Тебе освободили проход.",
    mistakeFeedback: "Проход узкий. Можно попросить место."
  },
  {
    id: "teacher-start",
    scene: "Занятие начинается.",
    prompt: "Поздоровайся с педагогом.",
    partner: "Педагог смотрит на тебя.",
    expectedKind: "greeting",
    choices: [
      { id: "teacher-hello", kind: "greeting", emoji: "👋", text: "Здравствуйте!" },
      { id: "break-please", kind: "request", emoji: "🕊️", text: "Можно паузу?" },
      { id: "thanks-lesson", kind: "thanks", emoji: "💛", text: "Спасибо за занятие" }
    ],
    correctFeedback: "Педагог приветствует тебя в ответ.",
    mistakeFeedback: "Занятие начинается. Можно поздороваться."
  }
];

export function generateSocialPhraseRound(roundIndex = 1, random = Math.random): SocialPhraseRound {
  const source = shuffleItems(socialPhraseScenes, random)[(roundIndex - 1) % socialPhraseScenes.length];
  const choices = shuffleItems(source.choices.map((choice) => ({ ...choice })), random);
  const correctIndex = choices.findIndex((choice) => choice.kind === source.expectedKind);
  if (correctIndex < 0) throw new Error(`Нет правильной фразы для ситуации ${source.id}.`);

  return {
    ...source,
    roundId: `social-phrases:${source.id}:round:${roundIndex}`,
    choices,
    correctChoice: choices[correctIndex],
    correctIndex
  };
}

export function getSocialPhraseChoice(round: SocialPhraseRound, choiceId: string) {
  const choice = round.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`Нет фразы ${choiceId} в раунде ${round.roundId}.`);
  return choice;
}

export function isSocialPhraseChoiceCorrect(round: SocialPhraseRound, choice: SocialPhraseChoice) {
  return choice.kind === round.expectedKind;
}

export function validateSocialPhraseScenes() {
  const errors: string[] = [];
  for (const scene of socialPhraseScenes) {
    if (!scene.scene) errors.push(`${scene.id}: empty scene`);
    if (!scene.prompt) errors.push(`${scene.id}: empty prompt`);
    if (!scene.choices.some((choice) => choice.kind === scene.expectedKind)) errors.push(`${scene.id}: no expected choice`);
    if (new Set(scene.choices.map((choice) => choice.id)).size !== scene.choices.length) errors.push(`${scene.id}: duplicate choice id`);
  }
  return errors;
}
