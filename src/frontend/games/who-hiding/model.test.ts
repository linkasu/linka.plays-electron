import { describe, expect, it } from "vitest";
import {
  beginWhoHidingPlayback,
  cancelWhoHidingPlayback,
  canChooseWhoHidingSpot,
  completeWhoHidingPlayback,
  createWhoHidingInputState
} from "./model";

describe("who-hiding input state machine", () => {
  it("unlocks input only after the active TTS playback completes", () => {
    const speaking = beginWhoHidingPlayback(createWhoHidingInputState(), "prompt");

    expect(canChooseWhoHidingSpot(speaking)).toBe(false);
    expect(completeWhoHidingPlayback(speaking, speaking.playbackId - 1, "ready")).toEqual(speaking);
    expect(canChooseWhoHidingSpot(completeWhoHidingPlayback(speaking, speaking.playbackId, "ready"))).toBe(true);
  });

  it("keeps stale completion from unlocking input after a safe cancel", () => {
    const speaking = beginWhoHidingPlayback(createWhoHidingInputState(), "feedback");
    const paused = cancelWhoHidingPlayback(speaking, "paused");
    const staleCompletion = completeWhoHidingPlayback(paused, speaking.playbackId, "ready");

    expect(staleCompletion).toEqual(paused);
    expect(canChooseWhoHidingSpot(staleCompletion)).toBe(false);
  });
});
