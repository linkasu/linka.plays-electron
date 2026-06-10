import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type ActionWhoAction = {
  id: string;
  label: string;
  question: string;
  icon: string;
  color: string;
};

export type ActionWhoCharacter = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export type ActionWhoChoice = {
  id: string;
  character: ActionWhoCharacter;
  action: ActionWhoAction;
};

export type ActionWhoRound = {
  roundId: string;
  prompt: string;
  targetAction: ActionWhoAction;
  target: ActionWhoChoice;
  choices: ActionWhoChoice[];
  correctIndex: number;
};

export const actionWhoActions: ActionWhoAction[] = [
  { id: "jump", label: "прыгает", question: "Кто прыгает?", icon: "mdi-run-fast", color: "deep-purple-lighten-4" },
  { id: "sleep", label: "спит", question: "Кто спит?", icon: "mdi-sleep", color: "indigo-lighten-4" },
  { id: "eat", label: "ест", question: "Кто ест?", icon: "mdi-food-apple", color: "green-lighten-4" },
  { id: "read", label: "читает", question: "Кто читает?", icon: "mdi-book-open-page-variant", color: "blue-lighten-4" },
  { id: "wash", label: "моет руки", question: "Кто моет руки?", icon: "mdi-hand-wash", color: "cyan-lighten-4" },
  { id: "dance", label: "танцует", question: "Кто танцует?", icon: "mdi-dance-ballroom", color: "pink-lighten-4" }
];

export const actionWhoCharacters: ActionWhoCharacter[] = [
  { id: "bunny", name: "зайка", icon: "mdi-rabbit", color: "#d81b60" },
  { id: "bear", name: "мишка", icon: "mdi-teddy-bear", color: "#6d4c41" },
  { id: "duck", name: "утёнок", icon: "mdi-duck", color: "#f9a825" },
  { id: "cat", name: "кот", icon: "mdi-cat", color: "#ef6c00" },
  { id: "dog", name: "пёс", icon: "mdi-dog", color: "#546e7a" },
  { id: "owl", name: "сова", icon: "mdi-owl", color: "#8e24aa" }
];

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 2;
  if (settings.preset === "challenge") return 4;
  return 3;
}

export function generateActionWhoRound(settings: SessionSettings, roundIndex = 1): ActionWhoRound {
  const choiceCount = choiceCountFor(settings);
  if (actionWhoActions.length < choiceCount) throw new Error("ActionWhoGame needs enough actions for unique choices.");
  if (actionWhoCharacters.length < choiceCount) throw new Error("ActionWhoGame needs enough characters for unique choices.");

  const targetAction = actionWhoActions[(roundIndex - 1) % actionWhoActions.length];
  const targetCharacter = actionWhoCharacters[(roundIndex * 2) % actionWhoCharacters.length];
  const distractorActions = shuffleItems(actionWhoActions.filter((action) => action.id !== targetAction.id)).slice(0, choiceCount - 1);
  const characters = shuffleItems(actionWhoCharacters.filter((character) => character.id !== targetCharacter.id)).slice(0, choiceCount - 1);
  const target: ActionWhoChoice = {
    id: `${targetCharacter.id}-${targetAction.id}`,
    character: targetCharacter,
    action: targetAction
  };
  const distractors = distractorActions.map((action, index) => {
    const character = characters[index];

    return {
      id: `${character.id}-${action.id}`,
      character,
      action
    };
  });
  const choices = shuffleItems([target, ...distractors]);

  return {
    roundId: `action-who:round:${roundIndex}`,
    prompt: targetAction.question,
    targetAction,
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
