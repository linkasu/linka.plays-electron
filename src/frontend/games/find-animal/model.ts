import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickByRoundIndex, type ChoiceRound } from "../../core/round";
import { getWordsByCategory, type WordItem } from "../../data/wordBank";

export type FindAnimalChoice = WordItem;

export type FindAnimalRound = ChoiceRound<FindAnimalChoice>;

const animalWords = getWordsByCategory("animal");

export function generateFindAnimalRound(settings: SessionSettings, roundIndex = 1): FindAnimalRound {
  if (animalWords.length < 2) throw new Error("FindAnimalGame needs at least two animal words.");

  const choiceCount = Math.min(5, animalWords.length, choiceCountByPreset(settings, roundIndex, {
    gentle: (index) => 2 + (index % 2),
    standard: (index) => 3 + (index % 3),
    challenge: (index) => 4 + (index % 2)
  }));

  return buildChoiceRound({
    idPrefix: "find-animal",
    roundIndex,
    items: animalWords,
    choiceCount,
    pickTarget: (items, index) => pickByRoundIndex(items, index),
    isSame: idEquality,
    prompt: (target) => `Найди животное: ${target.word}`
  });
}
