import type { DwellCancelReason } from "./gaze";

export type DwellPhase = "idle" | "holding" | "grace" | "cooldown";

export type DwellMachineState = {
  phase: DwellPhase;
  targetId?: string;
  accumulatedMs: number;
  lastAt: number;
  graceUntil: number;
  cooldownUntil: number;
};

export type DwellMachineEvent =
  | { type: "enter"; targetId: string }
  | { type: "cancel"; targetId: string; reason: DwellCancelReason }
  | { type: "select"; targetId: string };

export type DwellMachineInput = {
  now: number;
  targetId?: string;
  pointerValid: boolean;
  disabled?: boolean;
  anotherTargetActive?: boolean;
  dwellMs: number;
  graceMs: number;
  cooldownMs: number;
};

export type DwellMachineResult = {
  state: DwellMachineState;
  events: DwellMachineEvent[];
  progress: number;
};

export function createDwellMachineState(): DwellMachineState {
  return {
    phase: "idle",
    accumulatedMs: 0,
    lastAt: 0,
    graceUntil: 0,
    cooldownUntil: 0
  };
}

function holdingState(targetId: string, now: number): DwellMachineState {
  return {
    phase: "holding",
    targetId,
    accumulatedMs: 0,
    lastAt: now,
    graceUntil: 0,
    cooldownUntil: 0
  };
}

function progress(state: DwellMachineState, dwellMs: number) {
  return Math.min(1, state.accumulatedMs / Math.max(1, dwellMs));
}

export function advanceDwellMachine(current: DwellMachineState, input: DwellMachineInput): DwellMachineResult {
  const events: DwellMachineEvent[] = [];
  let state = { ...current };

  if (state.phase === "cooldown") {
    if (input.now < state.cooldownUntil) return { state, events, progress: 0 };
    state = createDwellMachineState();
  }

  if (input.disabled) {
    if (state.targetId) events.push({ type: "cancel", targetId: state.targetId, reason: "disabled" });
    return { state: createDwellMachineState(), events, progress: 0 };
  }

  if (state.phase === "idle") {
    if (input.pointerValid && input.targetId) {
      state = holdingState(input.targetId, input.now);
      events.push({ type: "enter", targetId: input.targetId });
    }
    return { state, events, progress: progress(state, input.dwellMs) };
  }

  if (state.phase === "grace") {
    if (input.anotherTargetActive) {
      if (state.targetId) events.push({ type: "cancel", targetId: state.targetId, reason: "left" });
      return { state: createDwellMachineState(), events, progress: 0 };
    }

    if (input.pointerValid && input.targetId === state.targetId && input.now <= state.graceUntil) {
      state.phase = "holding";
      state.lastAt = input.now;
      return { state, events, progress: progress(state, input.dwellMs) };
    }

    if (input.pointerValid && input.targetId && input.targetId !== state.targetId) {
      if (state.targetId) events.push({ type: "cancel", targetId: state.targetId, reason: "left" });
      state = holdingState(input.targetId, input.now);
      events.push({ type: "enter", targetId: input.targetId });
      return { state, events, progress: 0 };
    }

    if (input.now < state.graceUntil) return { state, events, progress: progress(state, input.dwellMs) };
    if (state.targetId) {
      events.push({
        type: "cancel",
        targetId: state.targetId,
        reason: input.pointerValid ? "left" : "invalid-gaze"
      });
    }
    return { state: createDwellMachineState(), events, progress: 0 };
  }

  if (input.anotherTargetActive) {
    if (state.targetId) events.push({ type: "cancel", targetId: state.targetId, reason: "left" });
    return { state: createDwellMachineState(), events, progress: 0 };
  }

  if (!input.pointerValid || !input.targetId) {
    state.phase = "grace";
    state.graceUntil = input.now + input.graceMs;
    return { state, events, progress: progress(state, input.dwellMs) };
  }

  if (input.targetId !== state.targetId) {
    if (state.targetId) events.push({ type: "cancel", targetId: state.targetId, reason: "left" });
    state = holdingState(input.targetId, input.now);
    events.push({ type: "enter", targetId: input.targetId });
    return { state, events, progress: 0 };
  }

  state.accumulatedMs += Math.max(0, input.now - state.lastAt);
  state.lastAt = input.now;
  const nextProgress = progress(state, input.dwellMs);
  if (nextProgress < 1) return { state, events, progress: nextProgress };

  events.push({ type: "select", targetId: input.targetId });
  return {
    state: {
      phase: "cooldown",
      accumulatedMs: 0,
      lastAt: input.now,
      graceUntil: 0,
      cooldownUntil: input.now + input.cooldownMs
    },
    events,
    progress: 1
  };
}
