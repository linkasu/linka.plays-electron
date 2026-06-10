import type { SessionSettings } from "../../core/settings";
import { getWordsByCategory, shuffleItems, type WordItem } from "../../data/wordBank";

export type FindAnimalChoice = WordItem;

export type FindAnimalRound = {
  roundId: string;
  prompt: string;
  target: FindAnimalChoice;
  choices: FindAnimalChoice[];
  correctIndex: number;
};

const animalWords = getWordsByCategory("animal");

function choiceCountFor(settings: SessionSettings, roundIndex: number) {
  if (settings.preset === "gentle") return 2 + (roundIndex % 2);
  if (settings.preset === "challenge") return 4 + (roundIndex % 2);
  return 3 + (roundIndex % 3);
}

export function generateFindAnimalRound(settings: SessionSettings, roundIndex = 1): FindAnimalRound {
  if (animalWords.length < 2) throw new Error("FindAnimalGame needs at least two animal words.");

  const choiceCount = Math.min(5, animalWords.length, choiceCountFor(settings, roundIndex));
  const target = animalWords[(roundIndex - 1) % animalWords.length];
  const distractors = shuffleItems(animalWords.filter((animal) => animal.id !== target.id)).slice(0, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors]);

  return {
    roundId: `find-animal:round:${roundIndex}`,
    prompt: `Найди животное: ${target.word}`,
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
