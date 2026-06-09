import { getAllWords, sampleItems, shuffleItems, type WordItem } from "../../data/wordBank";
import type { SessionSettings } from "../../core/settings";

export type ChoosePictureRound = {
  roundId: string;
  prompt: string;
  target: WordItem;
  choices: WordItem[];
  correctIndex: number;
};

export function generateChoosePictureRound(settings: SessionSettings, roundIndex = 1): ChoosePictureRound {
  const words = getAllWords();
  const choiceCount = 4;
  if (words.length < choiceCount) throw new Error("Недостаточно слов для игры.");
  const [target] = sampleItems(words, 1);
  const distractors = sampleItems(words, choiceCount - 1, [target]);
  const choices = shuffleItems([target, ...distractors]);
  return {
    roundId: `choose-picture:round:${roundIndex}`,
    prompt: `Где ${target.word}?`,
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
