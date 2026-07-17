import { describe, expect, it } from "vitest";
import { advanceBuildBridge, bridgeSlotTargetId, buildBridgeMaxSteps, buildBridgePieces, buildBridgeSlots, canPlaceBridgePieceAtSlot, createBuildBridgeState, currentBridgePiece, hasBridgeSupport, nextBridgePiece } from "./model";

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

  it("keeps telemetry target ids stable", () => {
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

  it("accepts only the matching place for the current detail", () => {
    expect(canPlaceBridgePieceAtSlot("support-left", "slot-support-left", [])).toBe(true);
    expect(canPlaceBridgePieceAtSlot("support-left", "slot-support-center", [])).toBe(false);
    expect(canPlaceBridgePieceAtSlot("plank-four", "slot-plank-one", ["support-left", "support-right"])).toBe(false);
  });

  it("starts directly in placement mode with the first ordered detail", () => {
    const state = createBuildBridgeState();

    expect(state.phase).toBe("placing");
    expect(currentBridgePiece(state)?.id).toBe("support-left");
  });

  it("keeps a soft error on the same detail without changing progress", () => {
    const state = createBuildBridgeState();
    const outcome = advanceBuildBridge(state, "slot-support-center");

    expect(outcome.kind).toBe("soft-error");
    expect(outcome.state).toBe(state);
    expect(outcome.state.placements).toHaveLength(0);
    expect(currentBridgePiece(outcome.state)?.id).toBe("support-left");
  });

  it("advances to the next detail after one successful place choice", () => {
    const outcome = advanceBuildBridge(createBuildBridgeState(), "slot-support-left");

    expect(outcome.kind).toBe("placed");
    expect(outcome.state.placements).toEqual([{ pieceId: "support-left", slotId: "slot-support-left" }]);
    expect(currentBridgePiece(outcome.state)?.id).toBe("support-center");
  });

  it("completes the bridge in one successful transition per detail", () => {
    let state = createBuildBridgeState();

    for (const piece of buildBridgePieces) {
      const slot = buildBridgeSlots.find((item) => item.acceptsPieceId === piece.id);
      if (!slot) throw new Error(`Missing slot for ${piece.id}.`);
      const outcome = advanceBuildBridge(state, slot.id);
      if (outcome.kind !== "placed") throw new Error(`Expected ${piece.id} to be placed.`);
      state = outcome.state;
    }

    expect(state.phase).toBe("complete");
    expect(state.placements).toHaveLength(buildBridgeMaxSteps);
    expect(currentBridgePiece(state)).toBeUndefined();
  });
});
