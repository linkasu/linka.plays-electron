export type BridgePieceKind = "support" | "plank";
export type BridgeSlotKind = BridgePieceKind;

export type BridgePiece = {
  id: string;
  order: number;
  label: string;
  shortLabel: string;
  kind: BridgePieceKind;
  color: string;
};

export const buildBridgePieces: BridgePiece[] = [
  { id: "support-left", order: 1, label: "опора 1", shortLabel: "опора", kind: "support", color: "#607d8b" },
  { id: "support-center", order: 2, label: "опора 2", shortLabel: "опора", kind: "support", color: "#546e7a" },
  { id: "support-right", order: 3, label: "опора 3", shortLabel: "опора", kind: "support", color: "#607d8b" },
  { id: "support-far", order: 4, label: "опора 4", shortLabel: "опора", kind: "support", color: "#546e7a" },
  { id: "plank-one", order: 5, label: "доска 1", shortLabel: "доска", kind: "plank", color: "#8d6e63" },
  { id: "plank-two", order: 6, label: "доска 2", shortLabel: "доска", kind: "plank", color: "#795548" },
  { id: "plank-three", order: 7, label: "доска 3", shortLabel: "доска", kind: "plank", color: "#8d6e63" },
  { id: "plank-four", order: 8, label: "доска 4", shortLabel: "доска", kind: "plank", color: "#795548" },
  { id: "plank-five", order: 9, label: "доска 5", shortLabel: "доска", kind: "plank", color: "#8d6e63" }
];

export const buildBridgeMaxSteps = buildBridgePieces.length;

export type BridgeSlot = {
  id: string;
  label: string;
  kind: BridgeSlotKind;
  acceptsPieceId: string;
  supportedBy: string[];
};

export type BridgePlacement = {
  pieceId: string;
  slotId: string;
};

export const buildBridgeSlots: BridgeSlot[] = [
  { id: "slot-support-left", label: "место левой опоры", kind: "support", acceptsPieceId: "support-left", supportedBy: ["riverbed"] },
  { id: "slot-support-center", label: "место средней опоры", kind: "support", acceptsPieceId: "support-center", supportedBy: ["riverbed"] },
  { id: "slot-support-right", label: "место правой опоры", kind: "support", acceptsPieceId: "support-right", supportedBy: ["riverbed"] },
  { id: "slot-support-far", label: "место дальней опоры", kind: "support", acceptsPieceId: "support-far", supportedBy: ["riverbed"] },
  { id: "slot-plank-one", label: "пролёт 1", kind: "plank", acceptsPieceId: "plank-one", supportedBy: ["bank-left", "support-left"] },
  { id: "slot-plank-two", label: "пролёт 2", kind: "plank", acceptsPieceId: "plank-two", supportedBy: ["support-left", "support-center"] },
  { id: "slot-plank-three", label: "пролёт 3", kind: "plank", acceptsPieceId: "plank-three", supportedBy: ["support-center", "support-right"] },
  { id: "slot-plank-four", label: "пролёт 4", kind: "plank", acceptsPieceId: "plank-four", supportedBy: ["support-right", "support-far"] },
  { id: "slot-plank-five", label: "пролёт 5", kind: "plank", acceptsPieceId: "plank-five", supportedBy: ["support-far", "bank-right"] }
];

const permanentSupports = new Set(["riverbed", "bank-left", "bank-right"]);

export function nextBridgePiece(placedIds: readonly string[]) {
  const placed = new Set(placedIds);
  return buildBridgePieces.find((piece) => !placed.has(piece.id));
}

export function canPlaceBridgePiece(pieceId: string, placedIds: readonly string[]) {
  return nextBridgePiece(placedIds)?.id === pieceId;
}

export function bridgeSlotById(slotId: string) {
  return buildBridgeSlots.find((slot) => slot.id === slotId);
}

export function bridgePieceById(pieceId: string) {
  return buildBridgePieces.find((piece) => piece.id === pieceId);
}

export function nextBridgePieceOfKind(kind: BridgePieceKind, placedIds: readonly string[]) {
  const placed = new Set(placedIds);
  return buildBridgePieces.find((piece) => piece.kind === kind && !placed.has(piece.id));
}

export function bridgeSlotTargetId(slot: Pick<BridgeSlot, "id">) {
  return `build-bridge:slot:${slot.id}`;
}

export function hasBridgeSupport(supportId: string, placedIds: readonly string[]) {
  return permanentSupports.has(supportId) || placedIds.includes(supportId);
}

export function placedPieceIds(placements: readonly BridgePlacement[]) {
  return placements.map((placement) => placement.pieceId);
}

export function isBridgeSlotOccupied(slotId: string, placements: readonly BridgePlacement[]) {
  return placements.some((placement) => placement.slotId === slotId);
}

export function supportIdsFromPlacements(placements: readonly BridgePlacement[]) {
  return placements
    .map((placement) => {
      const piece = bridgePieceById(placement.pieceId);
      const slot = bridgeSlotById(placement.slotId);
      return piece?.kind === "support" ? slot?.acceptsPieceId : undefined;
    })
    .filter((id): id is string => Boolean(id));
}

export function hasBridgeSupportAt(supportId: string, placements: readonly BridgePlacement[]) {
  return permanentSupports.has(supportId) || supportIdsFromPlacements(placements).includes(supportId);
}

export function canPlaceBridgePieceAtSlot(pieceId: string, slotId: string, placementsOrPlacedIds: readonly BridgePlacement[] | readonly string[]) {
  const piece = bridgePieceById(pieceId);
  const slot = bridgeSlotById(slotId);
  if (!piece || !slot) return false;
  const placements = placementsOrPlacedIds.filter((item): item is BridgePlacement => typeof item === "object" && item !== null && "pieceId" in item && "slotId" in item);
  const placedIds = placements.length ? placedPieceIds(placements) : placementsOrPlacedIds as readonly string[];
  if (placedIds.includes(pieceId)) return false;
  if (placements.length && isBridgeSlotOccupied(slotId, placements)) return false;
  if (piece.kind !== slot.kind) return false;
  if (!placements.length && piece.kind !== "support" && slot.acceptsPieceId !== pieceId) return false;
  if (piece.kind === "support") return slot.supportedBy.every((supportId) => hasBridgeSupport(supportId, placedIds));
  return slot.supportedBy.every((supportId) => placements.length ? hasBridgeSupportAt(supportId, placements) : hasBridgeSupport(supportId, placedIds));
}

export function bridgePieceTargetId(piece: Pick<BridgePiece, "id">) {
  return `build-bridge:piece:${piece.id}`;
}
