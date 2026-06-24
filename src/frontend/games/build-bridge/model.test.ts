import { describe, expect, it } from "vitest";
import { bridgePieceTargetId, bridgeSlotTargetId, buildBridgeMaxSteps, buildBridgePieces, buildBridgeSlots, canPlaceBridgePiece, canPlaceBridgePieceAtSlot, hasBridgeSupport, nextBridgePiece, nextBridgePieceOfKind } from "./model";

describe("build bridge model", () => {
  it("keeps the bridge build order stable", () => {
    expect(buildBridgePieces).toHaveLength(buildBridgeMaxSteps);
    expect(buildBridgePieces.map((piece) => piece.id)).toEqual([
      "support-left",
      "support-center",
      "support-right",
      "support-far",
      "plank-one",
      "plank-two",
      "plank-three",
      "plank-four",
      "plank-five"
    ]);
  });

  it("finds the next piece from placed ids", () => {
    expect(nextBridgePiece([])?.id).toBe("support-left");
    expect(nextBridgePiece(["support-left", "support-center", "support-right", "support-far"])?.id).toBe("plank-one");
    expect(nextBridgePiece(buildBridgePieces.map((piece) => piece.id))).toBeUndefined();
  });

  it("only allows the next expected piece to be placed", () => {
    expect(canPlaceBridgePiece("support-left", [])).toBe(true);
    expect(canPlaceBridgePiece("plank-one", [])).toBe(false);
    expect(canPlaceBridgePiece("plank-one", ["support-left", "support-center", "support-right", "support-far"])).toBe(true);
  });

  it("keeps telemetry target ids stable", () => {
    expect(bridgePieceTargetId(buildBridgePieces[0])).toBe("build-bridge:piece:support-left");
    expect(bridgeSlotTargetId(buildBridgeSlots[0])).toBe("build-bridge:slot:slot-support-left");
  });

  it("allows support pieces to stand on the riverbed", () => {
    expect(canPlaceBridgePieceAtSlot("support-center", "slot-support-center", [])).toBe(true);
    expect(hasBridgeSupport("riverbed", [])).toBe(true);
  });

  it("drops planks when there is no support underneath", () => {
    expect(canPlaceBridgePieceAtSlot("plank-three", "slot-plank-three", [])).toBe(false);
    expect(canPlaceBridgePieceAtSlot("plank-three", "slot-plank-three", ["support-center"])).toBe(false);
    expect(canPlaceBridgePieceAtSlot("plank-three", "slot-plank-three", ["support-center", "support-right"])).toBe(true);
  });

  it("selects the next available piece by kind", () => {
    expect(nextBridgePieceOfKind("support", [])?.id).toBe("support-left");
    expect(nextBridgePieceOfKind("support", ["support-left", "support-center"])?.id).toBe("support-right");
    expect(nextBridgePieceOfKind("support", ["support-left", "support-center", "support-right"])?.id).toBe("support-far");
    expect(nextBridgePieceOfKind("plank", ["plank-one", "plank-two"])?.id).toBe("plank-three");
  });

  it("allows supports in any free support slot and rejects mismatched planks", () => {
    expect(canPlaceBridgePieceAtSlot("support-left", "slot-support-center", [])).toBe(true);
    expect(canPlaceBridgePieceAtSlot("plank-four", "slot-plank-one", ["support-left", "support-right"])).toBe(false);
  });

  it("uses the selected support slot for later stability checks", () => {
    const placements = [{ pieceId: "support-left", slotId: "slot-support-center" }];

    expect(canPlaceBridgePieceAtSlot("plank-three", "slot-plank-three", placements)).toBe(false);
    expect(canPlaceBridgePieceAtSlot("plank-two", "slot-plank-two", placements)).toBe(false);
    expect(canPlaceBridgePieceAtSlot("plank-three", "slot-plank-three", [
      { pieceId: "support-left", slotId: "slot-support-center" },
      { pieceId: "support-center", slotId: "slot-support-right" }
    ])).toBe(true);
  });

  it("does not allow placing another piece into an occupied slot", () => {
    const placements = [{ pieceId: "support-left", slotId: "slot-support-center" }];

    expect(canPlaceBridgePieceAtSlot("support-center", "slot-support-center", placements)).toBe(false);
  });
});
