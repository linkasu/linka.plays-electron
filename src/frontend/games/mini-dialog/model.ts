import { shuffleItems } from "../../core/random";

export type MiniDialogScenario = "greeting" | "feeling" | "activity" | "opinion" | "choice" | "closing";

export type MiniDialogNodeId = "hello" | "feeling" | "activity" | "picture" | "more" | "finish";

export type MiniDialogChoiceKind = "answer" | "refusal" | "support" | "repeat" | "more" | "stop";

export type MiniDialogCharacter = {
  name: string;
  role: string;
  icon: string;
  color: string;
};

export type MiniDialogChoice = {
  id: string;
  kind: MiniDialogChoiceKind;
  text: string;
  icon: string;
  color: string;
  iconColor: string;
  nextNodeId: MiniDialogNodeId;
};

export type MiniDialogNode = {
  id: MiniDialogNodeId;
  scenario: MiniDialogScenario;
  partnerLine: string;
  prompt: string;
  sceneIcon: string;
  choices: MiniDialogChoice[];
};

export type MiniDialogRound = {
  roundId: string;
  nodeId: MiniDialogNodeId;
  scenario: MiniDialogScenario;
  character: MiniDialogCharacter;
  partnerLine: string;
  prompt: string;
  sceneIcon: string;
  choices: MiniDialogChoice[];
  isTerminal: boolean;
};

export const miniDialogInstruction = "Послушай Миру и выбери, что ты хочешь сказать. Здесь нет неправильных ответов.";

export const miniDialogCharacter: MiniDialogCharacter = {
  name: "Мира",
  role: "твой собеседник",
  icon: "mdi-account-voice",
  color: "#6d65c7"
};

export const miniDialogPath: MiniDialogNodeId[] = ["hello", "feeling", "activity", "picture", "more", "finish"];

export const miniDialogGraph: Record<MiniDialogNodeId, MiniDialogNode> = {
  hello: {
    id: "hello",
    scenario: "greeting",
    partnerLine: "Привет! Я Мира. Хочешь немного поговорить?",
    prompt: "Выбери, что ты хочешь сказать.",
    sceneIcon: "mdi-hand-wave-outline",
    choices: [
      { id: "talk", kind: "answer", text: "Да, я хочу поговорить.", icon: "mdi-message-text-outline", color: "blue-lighten-5", iconColor: "blue-darken-3", nextNodeId: "feeling" },
      { id: "not-now", kind: "refusal", text: "Нет, я не хочу разговаривать.", icon: "mdi-close-circle-outline", color: "red-lighten-5", iconColor: "red-darken-3", nextNodeId: "finish" },
      { id: "help", kind: "support", text: "Помоги мне ответить, пожалуйста.", icon: "mdi-help-circle-outline", color: "amber-lighten-5", iconColor: "amber-darken-4", nextNodeId: "feeling" },
      { id: "repeat", kind: "repeat", text: "Скажи ещё раз, пожалуйста.", icon: "mdi-replay", color: "deep-purple-lighten-5", iconColor: "deep-purple-darken-3", nextNodeId: "hello" }
    ]
  },
  feeling: {
    id: "feeling",
    scenario: "feeling",
    partnerLine: "Как ты себя чувствуешь сейчас?",
    prompt: "Можно ответить по-разному.",
    sceneIcon: "mdi-emoticon-outline",
    choices: [
      { id: "good", kind: "answer", text: "Мне хорошо.", icon: "mdi-emoticon-happy-outline", color: "green-lighten-5", iconColor: "green-darken-3", nextNodeId: "activity" },
      { id: "sad", kind: "answer", text: "Мне грустно.", icon: "mdi-emoticon-sad-outline", color: "blue-lighten-5", iconColor: "blue-darken-3", nextNodeId: "activity" },
      { id: "tired", kind: "answer", text: "Я устал.", icon: "mdi-sleep", color: "deep-purple-lighten-5", iconColor: "deep-purple-darken-3", nextNodeId: "activity" },
      { id: "skip-feeling", kind: "refusal", text: "Я не хочу отвечать.", icon: "mdi-comment-off-outline", color: "red-lighten-5", iconColor: "red-darken-3", nextNodeId: "activity" }
    ]
  },
  activity: {
    id: "activity",
    scenario: "activity",
    partnerLine: "Спасибо, что ответил. Хочешь посмотреть картинку с солнцем?",
    prompt: "Скажи, чего ты хочешь.",
    sceneIcon: "mdi-image-outline",
    choices: [
      { id: "see-picture", kind: "answer", text: "Да, я хочу посмотреть.", icon: "mdi-image-check-outline", color: "blue-lighten-5", iconColor: "blue-darken-3", nextNodeId: "picture" },
      { id: "no-picture", kind: "refusal", text: "Нет, я не хочу смотреть.", icon: "mdi-image-off-outline", color: "red-lighten-5", iconColor: "red-darken-3", nextNodeId: "more" },
      { id: "help-picture", kind: "support", text: "Помоги мне посмотреть, пожалуйста.", icon: "mdi-help-circle-outline", color: "amber-lighten-5", iconColor: "amber-darken-4", nextNodeId: "picture" },
      { id: "stop-activity", kind: "stop", text: "Стоп, пожалуйста.", icon: "mdi-stop-circle-outline", color: "deep-orange-lighten-5", iconColor: "deep-orange-darken-3", nextNodeId: "finish" }
    ]
  },
  picture: {
    id: "picture",
    scenario: "opinion",
    partnerLine: "Вот солнце. Что ты хочешь сказать о картинке?",
    prompt: "Выбери свою реплику.",
    sceneIcon: "mdi-weather-sunny",
    choices: [
      { id: "like", kind: "answer", text: "Мне нравится эта картинка.", icon: "mdi-thumb-up-outline", color: "green-lighten-5", iconColor: "green-darken-3", nextNodeId: "more" },
      { id: "dislike", kind: "answer", text: "Мне не нравится эта картинка.", icon: "mdi-thumb-down-outline", color: "red-lighten-5", iconColor: "red-darken-3", nextNodeId: "more" },
      { id: "tell-more", kind: "more", text: "Расскажи ещё, пожалуйста.", icon: "mdi-message-plus-outline", color: "deep-purple-lighten-5", iconColor: "deep-purple-darken-3", nextNodeId: "more" },
      { id: "stop-picture", kind: "stop", text: "Стоп, пожалуйста.", icon: "mdi-stop-circle-outline", color: "deep-orange-lighten-5", iconColor: "deep-orange-darken-3", nextNodeId: "finish" }
    ]
  },
  more: {
    id: "more",
    scenario: "choice",
    partnerLine: "Хочешь поговорить ещё?",
    prompt: "Ты решаешь, продолжать или закончить.",
    sceneIcon: "mdi-message-question-outline",
    choices: [
      { id: "more", kind: "more", text: "Да, давай ещё.", icon: "mdi-message-plus-outline", color: "blue-lighten-5", iconColor: "blue-darken-3", nextNodeId: "feeling" },
      { id: "enough", kind: "refusal", text: "Нет, спасибо.", icon: "mdi-check-circle-outline", color: "green-lighten-5", iconColor: "green-darken-3", nextNodeId: "finish" },
      { id: "help-more", kind: "support", text: "Помоги мне выбрать, пожалуйста.", icon: "mdi-help-circle-outline", color: "amber-lighten-5", iconColor: "amber-darken-4", nextNodeId: "more" },
      { id: "stop-more", kind: "stop", text: "Я хочу остановиться.", icon: "mdi-stop-circle-outline", color: "deep-orange-lighten-5", iconColor: "deep-orange-darken-3", nextNodeId: "finish" }
    ]
  },
  finish: {
    id: "finish",
    scenario: "closing",
    partnerLine: "Хорошо. Спасибо за разговор. Пока!",
    prompt: "Мира услышала тебя.",
    sceneIcon: "mdi-hand-wave-outline",
    choices: []
  }
};

function nodeById(nodeId: MiniDialogNodeId) {
  const node = miniDialogGraph[nodeId];
  if (!node) throw new Error(`Нет узла диалога ${nodeId}.`);
  return node;
}

export function generateMiniDialogRound(roundIndex = 1, random = Math.random, nodeId: MiniDialogNodeId = "hello"): MiniDialogRound {
  const node = nodeById(nodeId);
  return {
    roundId: `mini-dialog:${node.id}:round:${roundIndex}`,
    nodeId: node.id,
    scenario: node.scenario,
    character: miniDialogCharacter,
    partnerLine: node.partnerLine,
    prompt: node.prompt,
    sceneIcon: node.sceneIcon,
    choices: shuffleItems(node.choices.map((choice) => ({ ...choice })), random),
    isTerminal: node.id === "finish"
  };
}

export function getMiniDialogChoice(round: MiniDialogRound, choiceId: string) {
  const choice = round.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`Нет реплики ${choiceId} в раунде ${round.roundId}.`);
  return choice;
}

export function createMiniDialogCommunication(choice: MiniDialogChoice) {
  return {
    phrase: choice.text,
    expected: "valid-communication" as const,
    actual: choice.text,
    isCorrect: true as const,
    noFail: true as const
  };
}

export function getMiniDialogNextNodeId(choice: MiniDialogChoice) {
  return choice.nextNodeId;
}

export function validateMiniDialogGraph() {
  const errors: string[] = [];
  for (const nodeId of miniDialogPath) {
    const node = nodeById(nodeId);
    if (!node.partnerLine) errors.push(`${nodeId}: empty partner line`);
    if (!node.sceneIcon.startsWith("mdi-")) errors.push(`${nodeId}: missing scene icon`);
    if (node.id !== "finish" && (node.choices.length < 3 || node.choices.length > 4)) errors.push(`${nodeId}: expected 3 or 4 choices`);
    if (node.id === "finish" && node.choices.length > 0) errors.push(`${nodeId}: terminal node has choices`);
    if (new Set(node.choices.map((choice) => choice.id)).size !== node.choices.length) errors.push(`${nodeId}: duplicate choice id`);
    if (new Set(node.choices.map((choice) => choice.icon)).size !== node.choices.length) errors.push(`${nodeId}: duplicate choice icon`);
    if (new Set(node.choices.map((choice) => choice.color)).size !== node.choices.length) errors.push(`${nodeId}: duplicate choice color`);
    for (const choice of node.choices) {
      if (!choice.text || !/[.!?]$/.test(choice.text)) errors.push(`${nodeId}:${choice.id}: incomplete phrase`);
      if (!choice.icon.startsWith("mdi-")) errors.push(`${nodeId}:${choice.id}: missing choice icon`);
      if (!miniDialogGraph[choice.nextNodeId]) errors.push(`${nodeId}:${choice.id}: missing next node ${choice.nextNodeId}`);
    }
  }
  return errors;
}
