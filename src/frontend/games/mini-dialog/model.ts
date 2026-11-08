import { shuffleItems } from "../../core/random";

// Testers: «вообще не понятная фигня … если хотим оставить мини-диалог, то надо сделать например так:
// картинка с девочкой и написано, что она говорит привет. Вопрос — Мира сказала тебе привет,
// выбери, как ей ответить, и карточки привет, пока, спасибо, пожалуйста. Следующая: Мира говорит
// тебе пока, что нужно ответить. Мира угостила тебя яблоком, что нужно ответить».

export type MiniDialogReplyId = "hello" | "bye" | "thanks" | "please";

export type MiniDialogReply = {
  id: MiniDialogReplyId;
  /** The word on the card and what the child "says". */
  text: string;
  /** Drawn picture, see core/gameArt.ts. */
  artId: string;
};

export type MiniDialogSituation = {
  id: string;
  /** What Mira says, shown in her speech bubble; empty when she does something instead. */
  miraLine: string;
  /** The task: on screen and said aloud. */
  prompt: string;
  /** Mira in this situation, drawn. */
  artId: string;
  answer: MiniDialogReplyId;
};

export type MiniDialogRound = {
  roundId: string;
  situation: MiniDialogSituation;
  choices: MiniDialogReply[];
  correctIndex: number;
};

export const miniDialogReplies: MiniDialogReply[] = [
  { id: "hello", text: "Привет", artId: "mini-dialog/hello" },
  { id: "bye", text: "Пока", artId: "mini-dialog/bye" },
  { id: "thanks", text: "Спасибо", artId: "mini-dialog/thanks" },
  { id: "please", text: "Пожалуйста", artId: "mini-dialog/please" },
];

export const miniDialogSituations: MiniDialogSituation[] = [
  {
    id: "hello",
    miraLine: "Привет!",
    prompt: "Мира сказала тебе привет. Выбери, как ей ответить.",
    artId: "mini-dialog/mira-hello",
    answer: "hello",
  },
  {
    id: "bye",
    miraLine: "Пока!",
    prompt: "Мира говорит тебе пока. Что нужно ответить?",
    artId: "mini-dialog/mira-bye",
    answer: "bye",
  },
  {
    id: "apple",
    miraLine: "",
    prompt: "Мира угостила тебя яблоком. Что нужно ответить?",
    artId: "mini-dialog/mira-apple",
    answer: "thanks",
  },
  {
    id: "thanks",
    miraLine: "Спасибо!",
    prompt: "Мира сказала тебе спасибо. Что нужно ответить?",
    artId: "mini-dialog/mira-thanks",
    answer: "please",
  },
];

export function miniDialogPromptAssetId(situation: MiniDialogSituation) {
  return `mini-dialog.task.${situation.id}`;
}

export function miniDialogReplyAssetId(reply: MiniDialogReply) {
  return `mini-dialog.reply.${reply.id}`;
}

/**
 * Situations come in shuffled passes, so each one is met before any repeats and the
 * same situation never follows itself across passes.
 */
export function createMiniDialogRoundGenerator(random = Math.random) {
  let deck: MiniDialogSituation[] = [];
  let last: MiniDialogSituation | undefined;

  return (roundIndex = 1): MiniDialogRound => {
    if (deck.length === 0) {
      deck = shuffleItems(miniDialogSituations, random);
      if (deck.length > 1 && deck[0] === last) deck.push(deck.shift() as MiniDialogSituation);
    }
    const situation = deck.shift() as MiniDialogSituation;
    last = situation;
    const choices = shuffleItems(miniDialogReplies, random);
    return {
      roundId: `mini-dialog:round:${Math.max(1, Math.floor(roundIndex))}:${situation.id}`,
      situation,
      choices,
      correctIndex: choices.findIndex((reply) => reply.id === situation.answer),
    };
  };
}
