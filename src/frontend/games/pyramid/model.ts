export type PyramidRingId = "ring-1" | "ring-2" | "ring-3" | "ring-4";

export type PyramidRing = {
  id: PyramidRingId;
  size: number;
  color: string;
  placed: boolean;
  placedIndex?: number;
};

export type PyramidSelectionOutcome =
  | { kind: "ignored" }
  | {
      kind: "placed";
      rings: PyramidRing[];
      selectedRing: PyramidRing;
      expectedRing?: PyramidRing;
      isCorrect: boolean;
      isComplete: boolean;
    };

export function createPyramidRings(): PyramidRing[] {
  return [
    { id: "ring-1", size: 240, color: "#ff8a65", placed: false },
    { id: "ring-2", size: 200, color: "#ffd54f", placed: false },
    { id: "ring-3", size: 160, color: "#4fc3f7", placed: false },
    { id: "ring-4", size: 120, color: "#9575cd", placed: false }
  ];
}

export function getNextPyramidRing(rings: PyramidRing[]) {
  return rings.filter((ring) => !ring.placed).sort((a, b) => b.size - a.size)[0];
}

export function getPlacedPyramidRings(rings: PyramidRing[]) {
  return rings.filter((ring) => ring.placed).sort((a, b) => (a.placedIndex ?? 0) - (b.placedIndex ?? 0));
}

export function getCorrectPyramidOrder(rings: PyramidRing[]) {
  return [...rings].sort((a, b) => b.size - a.size);
}

export function selectPyramidRing(rings: PyramidRing[], ringId: PyramidRingId): PyramidSelectionOutcome {
  const selectedRing = rings.find((ring) => ring.id === ringId);
  if (!selectedRing || selectedRing.placed) return { kind: "ignored" };

  const expectedRing = getNextPyramidRing(rings);
  const nextPlacedIndex = getPlacedPyramidRings(rings).length + 1;
  const nextRings = rings.map((ring) => ring.id === ringId ? { ...ring, placed: true, placedIndex: nextPlacedIndex } : ring);
  const nextSelectedRing = nextRings.find((ring) => ring.id === ringId) ?? selectedRing;

  return {
    kind: "placed",
    rings: nextRings,
    selectedRing: nextSelectedRing,
    expectedRing,
    isCorrect: ringId === expectedRing?.id,
    isComplete: nextRings.every((ring) => ring.placed)
  };
}
