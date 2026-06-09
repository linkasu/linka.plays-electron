export type MiniDialogScenario = "greeting" | "continue-stop" | "thanks-more";

export type MiniDialogChoice = {
  id: string;
  text: string;
  emoji: string;
  confirmation: string;
};

export type MiniDialogRound = {
  roundId: string;
  scenario: MiniDialogScenario;
  partnerLine: string;
  prompt: string;
  choices: MiniDialogChoice[];
};

const miniDialogRoundTemplates: Omit<MiniDialogRound, "roundId">[] = [
  {
    scenario: "greeting",
    partnerLine: "Привет! Я рад тебя видеть.",
    prompt: "Что ответим?",
    choices: [
      { id: "hello", text: "Привет", emoji: "👋", confirmation: "Привет. Мы начали разговор." },
      { id: "i-am-here", text: "Я здесь", emoji: "🙂", confirmation: "Хорошо. Ты здесь, я рядом." },
      { id: "smile", text: "Улыбнуться", emoji: "😊", confirmation: "Я вижу улыбку. Это тёплый ответ." }
    ]
  },
  {
    scenario: "continue-stop",
    partnerLine: "Мы можем продолжить или остановиться.",
    prompt: "Выбери, как попросить партнёра.",
    choices: [
      { id: "continue", text: "Продолжить", emoji: "➡️", confirmation: "Хорошо, продолжаем медленно." },
      { id: "stop", text: "Стоп", emoji: "✋", confirmation: "Стоп принят. Можно сделать паузу." },
      { id: "pause", text: "Пауза", emoji: "🌿", confirmation: "Пауза тоже подходит. Дышим спокойно." }
    ]
  },
  {
    scenario: "greeting",
    partnerLine: "Как ты себя чувствуешь сейчас?",
    prompt: "Можно ответить коротко.",
    choices: [
      { id: "good", text: "Хорошо", emoji: "☀️", confirmation: "Хорошо. Спасибо, что сказал." },
      { id: "calm", text: "Спокойно", emoji: "🫧", confirmation: "Спокойно. Продолжаем без спешки." },
      { id: "help", text: "Нужна помощь", emoji: "🤝", confirmation: "Я услышал. Помощь можно попросить." }
    ]
  },
  {
    scenario: "thanks-more",
    partnerLine: "Спасибо, что ответил. Хочешь ещё?",
    prompt: "Выбери благодарность или просьбу.",
    choices: [
      { id: "thank-you", text: "Спасибо", emoji: "💛", confirmation: "Спасибо принято. Это приятные слова." },
      { id: "more", text: "Ещё", emoji: "➕", confirmation: "Ещё можно. Я задам следующий вопрос." },
      { id: "enough", text: "Хватит", emoji: "✅", confirmation: "Хватит тоже понятно. Можно завершать." }
    ]
  },
  {
    scenario: "continue-stop",
    partnerLine: "Если удобно, попроси меня идти дальше или остановиться.",
    prompt: "Что скажем партнёру?",
    choices: [
      { id: "go-on", text: "Идём дальше", emoji: "🚶", confirmation: "Идём дальше маленькими шагами." },
      { id: "wait", text: "Подожди", emoji: "🕊️", confirmation: "Я подожду. Такой ответ важен." }
    ]
  },
  {
    scenario: "thanks-more",
    partnerLine: "Мне приятно общаться с тобой.",
    prompt: "Выбери мягкую реплику.",
    choices: [
      { id: "me-too", text: "И мне", emoji: "🤍", confirmation: "И мне. Это тёплый диалог." },
      { id: "thanks-again", text: "Спасибо", emoji: "🙏", confirmation: "Спасибо. Я услышал добрые слова." },
      { id: "another-question", text: "Ещё вопрос", emoji: "❔", confirmation: "Ещё вопрос можно. Продолжаем." }
    ]
  },
  {
    scenario: "greeting",
    partnerLine: "До встречи. Хочешь сказать что-то в конце?",
    prompt: "Выбери завершающую реплику.",
    choices: [
      { id: "bye", text: "Пока", emoji: "👋", confirmation: "Пока. Диалог завершён спокойно." },
      { id: "final-thanks", text: "Спасибо", emoji: "🌟", confirmation: "Спасибо за разговор." },
      { id: "see-you", text: "До встречи", emoji: "🏡", confirmation: "До встречи. Было приятно общаться." }
    ]
  }
];

export function generateMiniDialogRound(roundIndex = 1): MiniDialogRound {
  const template = miniDialogRoundTemplates[(roundIndex - 1) % miniDialogRoundTemplates.length];
  if (!template) throw new Error("Нет сценариев для игры Мини-диалог.");

  return {
    roundId: `mini-dialog:round:${roundIndex}`,
    scenario: template.scenario,
    partnerLine: template.partnerLine,
    prompt: template.prompt,
    choices: template.choices.map((choice) => ({ ...choice }))
  };
}

export function getMiniDialogChoice(round: MiniDialogRound, choiceId: string) {
  const choice = round.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`Нет реплики ${choiceId} в раунде ${round.roundId}.`);
  return choice;
}

export function getMiniDialogScenarioCoverage(roundCount = miniDialogRoundTemplates.length) {
  return Array.from({ length: roundCount }, (_, index) => generateMiniDialogRound(index + 1).scenario);
}
