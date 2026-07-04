import { shuffleItems } from "../../core/random";

export type MiniDialogScenario = "greeting" | "feeling" | "activity" | "choice" | "closing";

export type MiniDialogNodeId = "hello" | "feeling" | "ready" | "picture" | "continue" | "more" | "goodbye" | "finish";

export type MiniDialogCharacter = {
  name: string;
  role: string;
  icon: string;
  color: string;
  voiceLabel: string;
};

export type MiniDialogChoice = {
  id: string;
  text: string;
  emoji: string;
  confirmation: string;
  feedback: string;
  nextNodeId?: MiniDialogNodeId;
  expected?: boolean;
};

export type MiniDialogNode = {
  id: MiniDialogNodeId;
  scenario: MiniDialogScenario;
  partnerLine: string;
  prompt: string;
  setting: string;
  expression: string;
  choices: MiniDialogChoice[];
};

export type MiniDialogRound = {
  roundId: string;
  nodeId: MiniDialogNodeId;
  scenario: MiniDialogScenario;
  character: MiniDialogCharacter;
  partnerLine: string;
  prompt: string;
  setting: string;
  expression: string;
  choices: MiniDialogChoice[];
  expectedChoice: MiniDialogChoice;
  correctIndex: number;
  isTerminal: boolean;
};

export const miniDialogCharacter: MiniDialogCharacter = {
  name: "Мира",
  role: "дружелюбный собеседник",
  icon: "mdi-account-voice",
  color: "#6d65c7",
  voiceLabel: "голос Алёна"
};

export const miniDialogVoiceRoles = {
  partner: "Алёна говорит за Миру",
  correct: "Филипп озвучивает выбранную реплику",
  mistake: "Юлия объясняет ошибку"
} as const;

export const miniDialogPath: MiniDialogNodeId[] = ["hello", "feeling", "ready", "picture", "continue", "more", "goodbye"];

export const miniDialogGraph: Record<MiniDialogNodeId, MiniDialogNode> = {
  hello: {
    id: "hello",
    scenario: "greeting",
    partnerLine: "Привет! Я Мира. Я рада тебя видеть.",
    prompt: "Выбери ответ.",
    setting: "начало разговора",
    expression: "👋",
    choices: [
      { id: "hello", text: "Привет, Мира", emoji: "👋", expected: true, nextNodeId: "feeling", confirmation: "Мира улыбается.", feedback: "Мы только встретились. Давай поздороваемся." },
      { id: "more", text: "Ещё", emoji: "➕", confirmation: "", feedback: "Ещё будет позже. Сначала скажем привет." },
      { id: "bye", text: "Пока", emoji: "🏡", confirmation: "", feedback: "Мы только начали. Пока скажем в конце." }
    ]
  },
  feeling: {
    id: "feeling",
    scenario: "feeling",
    partnerLine: "Как у тебя дела?",
    prompt: "Выбери ответ.",
    setting: "Мира слушает ответ",
    expression: "🙂",
    choices: [
      { id: "calm", text: "Мне хорошо", emoji: "🫧", expected: true, nextNodeId: "ready", confirmation: "Мира рада это слышать.", feedback: "Еда подождёт. Скажи Мире, как у тебя дела." },
      { id: "eat", text: "Есть", emoji: "🍽️", confirmation: "", feedback: "Еда подождёт. Скажи Мире, как у тебя дела." },
      { id: "go", text: "Идти", emoji: "🚶", confirmation: "", feedback: "Пойдём позже. Сначала ответим Мире." }
    ]
  },
  ready: {
    id: "ready",
    scenario: "activity",
    partnerLine: "Хочешь посмотреть картинку?",
    prompt: "Выбери ответ.",
    setting: "перед картинкой",
    expression: "🖼️",
    choices: [
      { id: "ready", text: "Да", emoji: "✅", expected: true, nextNodeId: "picture", confirmation: "Мира показывает картинку.", feedback: "Если хочешь смотреть, скажи: да." },
      { id: "thanks", text: "Спасибо", emoji: "💛", confirmation: "", feedback: "Спасибо приятно слышать. А на картинку можно ответить: да." },
      { id: "sleep", text: "Спать", emoji: "🛏️", confirmation: "", feedback: "Если устал, можно попросить паузу. Сейчас Мира ждёт ответ про картинку." }
    ]
  },
  picture: {
    id: "picture",
    scenario: "activity",
    partnerLine: "Вот солнце. Тебе нравится картинка?",
    prompt: "Выбери ответ.",
    setting: "смотрим картинку",
    expression: "☀️",
    choices: [
      { id: "like", text: "Нравится", emoji: "😊", expected: true, nextNodeId: "continue", confirmation: "Мира тоже смотрит на солнце.", feedback: "Мира рядом. Сначала ответим про картинку." },
      { id: "help", text: "Помощь", emoji: "🤝", confirmation: "", feedback: "Мира рядом. Сначала ответим про картинку." },
      { id: "bye", text: "До встречи", emoji: "👋", confirmation: "", feedback: "До встречи скажем позже. Сейчас мы смотрим картинку." }
    ]
  },
  continue: {
    id: "continue",
    scenario: "choice",
    partnerLine: "Продолжим диалог или сделаем паузу?",
    prompt: "Как хочешь?",
    setting: "выбор темпа",
    expression: "🌿",
    choices: [
      { id: "continue", text: "Продолжим", emoji: "➡️", expected: true, nextNodeId: "more", confirmation: "Мира продолжает разговор.", feedback: "Мира ждёт: продолжим или пауза." },
      { id: "pause", text: "Пауза", emoji: "✋", expected: true, nextNodeId: "more", confirmation: "Мира подождёт.", feedback: "" },
      { id: "hungry", text: "Голоден", emoji: "🍎", confirmation: "", feedback: "Поняла. Сначала скажем Мире: продолжим или пауза." }
    ]
  },
  more: {
    id: "more",
    scenario: "choice",
    partnerLine: "Спасибо, что отвечаешь. Хочешь ещё один вопрос?",
    prompt: "Ответь: ещё или хватит.",
    setting: "решаем продолжать ли",
    expression: "❔",
    choices: [
      { id: "more", text: "Ещё", emoji: "➕", expected: true, nextNodeId: "goodbye", confirmation: "Мира задаст последний вопрос.", feedback: "Если хочешь продолжить, скажи: ещё." },
      { id: "enough", text: "Хватит", emoji: "✅", expected: true, nextNodeId: "goodbye", confirmation: "Мира услышала тебя.", feedback: "" },
      { id: "hello", text: "Привет", emoji: "👋", confirmation: "", feedback: "Привет уже был. Теперь можно сказать: ещё или хватит." }
    ]
  },
  goodbye: {
    id: "goodbye",
    scenario: "closing",
    partnerLine: "Спасибо за разговор. Пора попрощаться.",
    prompt: "Выбери ответ.",
    setting: "конец разговора",
    expression: "💛",
    choices: [
      { id: "bye", text: "Пока", emoji: "👋", expected: true, nextNodeId: "finish", confirmation: "Мира машет рукой.", feedback: "На прощание можно сказать: пока." },
      { id: "thanks", text: "Спасибо", emoji: "🌟", expected: true, nextNodeId: "finish", confirmation: "Мира улыбается.", feedback: "" },
      { id: "again", text: "Сначала", emoji: "🔁", confirmation: "", feedback: "Начало уже было. Сейчас пора попрощаться." }
    ]
  },
  finish: {
    id: "finish",
    scenario: "closing",
    partnerLine: "Спасибо. Мне было приятно.",
    prompt: "Диалог завершён.",
    setting: "финал",
    expression: "🌟",
    choices: [
      { id: "done", text: "Готово", emoji: "✅", expected: true, confirmation: "Готово.", feedback: "" }
    ]
  }
};

function nodeById(nodeId: MiniDialogNodeId) {
  const node = miniDialogGraph[nodeId];
  if (!node) throw new Error(`Нет узла диалога ${nodeId}.`);
  return node;
}

function defaultNodeForRound(roundIndex: number) {
  return miniDialogPath[(roundIndex - 1) % miniDialogPath.length];
}

export function generateMiniDialogRound(roundIndex = 1, random = Math.random, nodeId: MiniDialogNodeId = defaultNodeForRound(roundIndex)): MiniDialogRound {
  const node = nodeById(nodeId);
  const choices = shuffleItems(node.choices.map((choice) => ({ ...choice })), random);
  const correctIndex = choices.findIndex((choice) => choice.expected);
  if (correctIndex < 0) throw new Error(`В узле ${nodeId} нет ожидаемой реплики.`);

  return {
    roundId: `mini-dialog:${node.id}:round:${roundIndex}`,
    nodeId: node.id,
    scenario: node.scenario,
    character: miniDialogCharacter,
    partnerLine: node.partnerLine,
    prompt: node.prompt,
    setting: node.setting,
    expression: node.expression,
    choices,
    expectedChoice: choices[correctIndex],
    correctIndex,
    isTerminal: node.id === "finish"
  };
}

export function getMiniDialogChoice(round: MiniDialogRound, choiceId: string) {
  const choice = round.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`Нет реплики ${choiceId} в раунде ${round.roundId}.`);
  return choice;
}

export function isMiniDialogChoiceCorrect(choice: MiniDialogChoice) {
  return choice.expected === true;
}

export function getMiniDialogNextNodeId(choice: MiniDialogChoice) {
  return choice.nextNodeId;
}

export function getMiniDialogScenarioCoverage(roundCount = miniDialogPath.length) {
  return Array.from({ length: roundCount }, (_, index) => generateMiniDialogRound(index + 1, () => 0.99).scenario);
}

export function validateMiniDialogGraph() {
  const errors: string[] = [];
  for (const nodeId of miniDialogPath) {
    const node = nodeById(nodeId);
    if (!node.partnerLine) errors.push(`${nodeId}: empty partner line`);
    if (!node.choices.some((choice) => choice.expected)) errors.push(`${nodeId}: no expected choice`);
    for (const choice of node.choices) {
      if (choice.expected && !choice.nextNodeId) errors.push(`${nodeId}:${choice.id}: expected choice has no next node`);
      if (choice.nextNodeId && !miniDialogGraph[choice.nextNodeId]) errors.push(`${nodeId}:${choice.id}: missing next node ${choice.nextNodeId}`);
      if (!choice.expected && !choice.feedback) errors.push(`${nodeId}:${choice.id}: wrong choice has no feedback`);
    }
  }
  return errors;
}
