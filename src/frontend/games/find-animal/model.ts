import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickByRoundIndex, type ChoiceRound } from "../../core/round";
import { createNonRepeatingRandomIndexGenerator } from "../../core/random";
import { getWordsByCategory, type WordItem } from "../../data/wordBank";

export type FindAnimalChoice = WordItem;

export type FindAnimalRound = ChoiceRound<FindAnimalChoice> & { assetMode: "image" };

const animalWords = getWordsByCategory("animal");

function buildFindAnimalRound(settings: SessionSettings, roundIndex: number, target: FindAnimalChoice, random = Math.random): FindAnimalRound {
  if (animalWords.length < 2) throw new Error("FindAnimalGame needs at least two animal words.");

  const choiceCount = Math.min(5, animalWords.length, choiceCountByPreset(settings, roundIndex, {
    gentle: (index) => 2 + (index % 2),
    standard: (index) => 3 + (index % 3),
    challenge: (index) => 4 + (index % 2)
  }));

  return {
    ...buildChoiceRound({
      idPrefix: "find-animal",
      roundIndex,
      items: animalWords,
      choiceCount,
      pickTarget: () => target,
      isSame: idEquality,
      prompt: (roundTarget) => `Найди животное: ${roundTarget.word}`,
      random
    }),
    assetMode: "image"
  };
}

export function generateFindAnimalRound(settings: SessionSettings, roundIndex = 1): FindAnimalRound {
  return buildFindAnimalRound(settings, roundIndex, pickByRoundIndex(animalWords, roundIndex));
}

export function createFindAnimalRoundGenerator(random = Math.random) {
  const targetIndexes = createNonRepeatingRandomIndexGenerator(animalWords.length, random);
  return (settings: SessionSettings, roundIndex = 1) => {
    const targetIndex = targetIndexes.next();
    if (targetIndex === undefined) throw new Error("FindAnimalGame needs at least one animal image.");
    return buildFindAnimalRound(settings, roundIndex, animalWords[targetIndex], random);
  };
}
