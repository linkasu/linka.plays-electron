import { shuffleItems } from "../../core/random";

export type TrainWagonId = "red" | "yellow" | "green" | "blue" | "violet";

export type TrainWagon = {
  id: TrainWagonId;
  number: number;
  color: string;
  label: string;
  /** Drawn wagon (core/gameArt.ts). */
  artId: string;
  placed: boolean;
  placedIndex?: number;
};

export type TrainWagonSelectionOutcome =
  | { kind: "ignored" }
  | {
      kind: "placed";
      wagons: TrainWagon[];
      selectedWagon: TrainWagon;
      expectedWagon?: TrainWagon;
      isCorrect: boolean;
      isComplete: boolean;
    };

const wagonBases: Omit<TrainWagon, "artId" | "placed">[] = [
  { id: "red", number: 1, color: "#ef9a9a", label: "красный" },
  { id: "yellow", number: 2, color: "#ffe082", label: "жёлтый" },
  { id: "green", number: 3, color: "#a5d6a7", label: "зелёный" },
  { id: "blue", number: 4, color: "#90caf9", label: "синий" },
  { id: "violet", number: 5, color: "#ce93d8", label: "фиолетовый" },
];

// Testers: «мб перерисовать?». The drawn engine and wagons replace the CSS shapes.
export const trainLocomotiveArtId = "train-sequence/locomotive";

export function trainWagonArtId(id: TrainWagonId) {
  return `train-sequence/wagon-${id}`;
}

export const trainSequenceArtIds = [
  trainLocomotiveArtId,
  ...wagonBases.map((wagon) => trainWagonArtId(wagon.id)),
];

export function createTrainWagons(random = Math.random): TrainWagon[] {
  return shuffleItems(
    wagonBases.map((wagon) => ({ ...wagon, artId: trainWagonArtId(wagon.id), placed: false })),
    random,
  );
}

export function getOrderedTrainWagons(wagons: TrainWagon[]) {
  return [...wagons].sort((a, b) => a.number - b.number);
}

export function getPlacedTrainWagons(wagons: TrainWagon[]) {
  return wagons
    .filter((wagon) => wagon.placed)
    .sort((a, b) => (a.placedIndex ?? 0) - (b.placedIndex ?? 0));
}

export function getNextTrainWagon(wagons: TrainWagon[]) {
  return getOrderedTrainWagons(wagons).find((wagon) => !wagon.placed);
}

export function selectTrainWagon(
  wagons: TrainWagon[],
  wagonId: TrainWagonId,
): TrainWagonSelectionOutcome {
  const selectedWagon = wagons.find((wagon) => wagon.id === wagonId);
  if (!selectedWagon || selectedWagon.placed) return { kind: "ignored" };

  const expectedWagon = getNextTrainWagon(wagons);
  const isCorrect = wagonId === expectedWagon?.id;
  if (!isCorrect) {
    return {
      kind: "placed",
      wagons: wagons.map((wagon) => ({ ...wagon })),
      selectedWagon: { ...selectedWagon },
      expectedWagon,
      isCorrect: false,
      isComplete: false,
    };
  }
  const nextPlacedIndex = getPlacedTrainWagons(wagons).length + 1;
  const nextWagons = wagons.map((wagon) =>
    wagon.id === wagonId ? { ...wagon, placed: true, placedIndex: nextPlacedIndex } : wagon,
  );
  const nextSelectedWagon = nextWagons.find((wagon) => wagon.id === wagonId) ?? selectedWagon;

  return {
    kind: "placed",
    wagons: nextWagons,
    selectedWagon: nextSelectedWagon,
    expectedWagon,
    isCorrect,
    isComplete: nextWagons.every((wagon) => wagon.placed),
  };
}
