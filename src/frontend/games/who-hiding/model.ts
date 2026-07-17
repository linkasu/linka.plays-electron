export type WhoHidingInputPhase = "prompt" | "ready" | "feedback" | "paused" | "finished";

export type WhoHidingInputState = {
  phase: WhoHidingInputPhase;
  playbackId: number;
};

export function createWhoHidingInputState(): WhoHidingInputState {
  return { phase: "prompt", playbackId: 0 };
}

export function beginWhoHidingPlayback(state: WhoHidingInputState, phase: "prompt" | "feedback"): WhoHidingInputState {
  return { phase, playbackId: state.playbackId + 1 };
}

export function completeWhoHidingPlayback(
  state: WhoHidingInputState,
  playbackId: number,
  nextPhase: WhoHidingInputPhase
): WhoHidingInputState {
  if (state.playbackId !== playbackId) return state;
  return { ...state, phase: nextPhase };
}

export function cancelWhoHidingPlayback(state: WhoHidingInputState, nextPhase: WhoHidingInputPhase): WhoHidingInputState {
  return { phase: nextPhase, playbackId: state.playbackId + 1 };
}

export function canChooseWhoHidingSpot(state: WhoHidingInputState) {
  return state.phase === "ready";
}
