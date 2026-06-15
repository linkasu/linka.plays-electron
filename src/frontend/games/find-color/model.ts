import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickRandom, type ChoiceRound } from "../../core/round";

export type FindColorOption = {
  id: string;
  label: string;
  hex: string;
  textColor: string;
};

export type FindColorRound = ChoiceRound<FindColorOption>;

export const findColorOptions: FindColorOption[] = [
  { id: "red", label: "красный", hex: "#B71C1C", textColor: "#FFFFFF" },
  { id: "blue", label: "синий", hex: "#0D47A1", textColor: "#FFFFFF" },
  { id: "green", label: "зелёный", hex: "#1B5E20", textColor: "#FFFFFF" },
  { id: "yellow", label: "жёлтый", hex: "#F9A825", textColor: "#1A1A1A" },
  { id: "purple", label: "фиолетовый", hex: "#4A148C", textColor: "#FFFFFF" },
  { id: "orange", label: "оранжевый", hex: "#EF6C00", textColor: "#1A1A1A" },
  { id: "teal", label: "бирюзовый", hex: "#00695C", textColor: "#FFFFFF" },
  { id: "pink", label: "розовый", hex: "#880E4F", textColor: "#FFFFFF" }
];

export function generateFindColorRound(settings: SessionSettings, roundIndex = 1): FindColorRound {
  const choiceCount = choiceCountByPreset(settings, roundIndex, { gentle: 3, standard: 4, challenge: 4 });
  if (findColorOptions.length < choiceCount) throw new Error("Недостаточно цветов для игры.");

  return buildChoiceRound({
    idPrefix: "find-color",
    roundIndex,
    items: findColorOptions,
    choiceCount,
    pickTarget: (items) => pickRandom(items),
    isSame: idEquality,
    prompt: (target) => `Найди ${target.label}`
  });
}
