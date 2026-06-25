import { shuffleItems } from "../../core/random";

export type TrainWagonId = "red" | "yellow" | "green" | "blue" | "violet";

export type TrainWagon = {
  id: TrainWagonId;
  number: number;
  color: string;
  label: string;
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

export function createTrainWagons(random = Math.random): TrainWagon[] {
  return shuffleItems([
    { id: "red", number: 1, color: "#ef9a9a", label: "красный", placed: false },
    { id: "yellow", number: 2, color: "#ffe082", label: "жёлтый", placed: false },
    { id: "green", number: 3, color: "#a5d6a7", label: "зелёный", placed: false },
    { id: "blue", number: 4, color: "#90caf9", label: "синий", placed: false },
    { id: "violet", number: 5, color: "#ce93d8", label: "фиолетовый", placed: false }
  ], random);
}

export function getOrderedTrainWagons(wagons: TrainWagon[]) {
  return [...wagons].sort((a, b) => a.number - b.number);
}

export function getPlacedTrainWagons(wagons: TrainWagon[]) {
  return wagons.filter((wagon) => wagon.placed).sort((a, b) => (a.placedIndex ?? 0) - (b.placedIndex ?? 0));
}

export function getNextTrainWagon(wagons: TrainWagon[]) {
  return getOrderedTrainWagons(wagons).find((wagon) => !wagon.placed);
}

export function selectTrainWagon(wagons: TrainWagon[], wagonId: TrainWagonId): TrainWagonSelectionOutcome {
  const selectedWagon = wagons.find((wagon) => wagon.id === wagonId);
  if (!selectedWagon || selectedWagon.placed) return { kind: "ignored" };

  const expectedWagon = getNextTrainWagon(wagons);
  const nextPlacedIndex = getPlacedTrainWagons(wagons).length + 1;
  const nextWagons = wagons.map((wagon) => wagon.id === wagonId ? { ...wagon, placed: true, placedIndex: nextPlacedIndex } : wagon);
  const nextSelectedWagon = nextWagons.find((wagon) => wagon.id === wagonId) ?? selectedWagon;

  return {
    kind: "placed",
    wagons: nextWagons,
    selectedWagon: nextSelectedWagon,
    expectedWagon,
    isCorrect: wagonId === expectedWagon?.id,
    isComplete: nextWagons.every((wagon) => wagon.placed)
  };
}
