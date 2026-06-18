import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickRandom, type ChoiceRound } from "../../core/round";
import { getAllWords, type WordItem } from "../../data/wordBank";

export type MatchSameRound = ChoiceRound<WordItem>;

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
  const choiceCount = choiceCountByPreset(settings, roundIndex, { gentle: 3, standard: 4, challenge: 4 });
  if (words.length < choiceCount) throw new Error("Недостаточно разных картинок для игры.");

  return buildChoiceRound({
    idPrefix: "match-same",
    roundIndex,
    items: words,
    choiceCount,
    pickTarget: (items) => pickRandom(items),
    isSame: idEquality,
    prompt: () => "Где такая же?"
  });
}
