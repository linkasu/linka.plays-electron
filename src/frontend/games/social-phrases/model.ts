// Testers: «вообще не понятно, что это такое, может, уберём? Или сделаем просто набор с фразами
// и картинками типа нет, да, хочу отдохнуть, хочу есть, хочу пить, хочу в туалет и т. д.».
// A board of everyday phrases: every card is a valid message, nothing is wrong.

export type SocialPhrase = {
  id: string;
  /** The words on the card. */
  label: string;
  /** What the voice says for the child. */
  phrase: string;
  /** Drawn picture, see core/gameArt.ts. */
  artId: string;
};

export const socialPhrasesPrompt = "Что ты хочешь сказать? Выбери карточку.";

/** Fixed order: a communication board keeps every card in its place. */
export const socialPhrases: SocialPhrase[] = [
  { id: "yes", label: "Да", phrase: "Да.", artId: "social-phrases/yes" },
  { id: "no", label: "Нет", phrase: "Нет.", artId: "social-phrases/no" },
  { id: "eat", label: "Хочу есть", phrase: "Я хочу есть.", artId: "social-phrases/eat" },
  { id: "drink", label: "Хочу пить", phrase: "Я хочу пить.", artId: "i-want/water" },
  { id: "rest", label: "Хочу отдохнуть", phrase: "Я хочу отдохнуть.", artId: "i-want/rest" },
  { id: "toilet", label: "Хочу в туалет", phrase: "Я хочу в туалет.", artId: "social-phrases/toilet" },
  { id: "play", label: "Хочу играть", phrase: "Я хочу играть.", artId: "social-phrases/play" },
  { id: "help", label: "Помоги мне", phrase: "Помоги мне, пожалуйста.", artId: "social-phrases/help" },
];

export function socialPhraseAssetId(phrase: SocialPhrase) {
  return `social-phrases.phrase.${phrase.id}`;
}

export const socialPhrasesPromptAssetId = "social-phrases.prompt";
