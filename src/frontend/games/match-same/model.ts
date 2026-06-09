import type { SessionSettings } from "../../core/settings";
import { getAllWords, sampleItems, shuffleItems, type WordItem } from "../../data/wordBank";

export type MatchSameRound = {
  roundId: string;
  prompt: string;
  target: WordItem;
  choices: WordItem[];
  correctIndex: number;
};

function choiceCountForSettings(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

function uniqueByEmoji(items: WordItem[]) {
  const usedEmoji = new Set<string>();
  return items.filter((item) => {
    if (usedEmoji.has(item.emoji)) return false;
    usedEmoji.add(item.emoji);
    return true;
  });
}

export function generateMatchSameRound(settings: SessionSettings, roundIndex = 1): MatchSameRound {
  const words = uniqueByEmoji(getAllWords());
  const choiceCount = choiceCountForSettings(settings);
  if (words.length < choiceCount) throw new Error("Недостаточно разных картинок для игры.");

  const [target] = sampleItems(words, 1);
  const distractorPool = words.filter((word) => word.id !== target.id && word.emoji !== target.emoji);
  const distractors = sampleItems(distractorPool, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors]);
  return {
    roundId: `match-same:round:${roundIndex}`,
    prompt: "Где такая же?",
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
