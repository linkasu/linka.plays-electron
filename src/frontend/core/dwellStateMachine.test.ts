import { describe, expect, it } from "vitest";
import { advanceDwellMachine, createDwellMachineState, type DwellMachineState } from "./dwellStateMachine";

function advance(state: DwellMachineState, now: number, targetId?: string, pointerValid = true) {
  return advanceDwellMachine(state, {
    now,
    targetId,
    pointerValid,
    dwellMs: 1000,
    graceMs: 150,
    cooldownMs: 500
  });
}

describe("dwell state machine", () => {
  it("selects after accumulated holding time", () => {
    const entered = advance(createDwellMachineState(), 0, "a");
    const halfway = advance(entered.state, 500, "a");
    const selected = advance(halfway.state, 1000, "a");

    expect(entered.events).toEqual([{ type: "enter", targetId: "a" }]);
    expect(halfway.progress).toBe(0.5);
    expect(selected.events).toEqual([{ type: "select", targetId: "a" }]);
    expect(selected.state.phase).toBe("cooldown");
  });

  it("freezes progress during a short invalid-gaze grace", () => {
    const entered = advance(createDwellMachineState(), 0, "a");
    const holding = advance(entered.state, 400, "a");
    const lost = advance(holding.state, 450, undefined, false);
    const restored = advance(lost.state, 550, "a");
    const continued = advance(restored.state, 650, "a");

    expect(lost.state.phase).toBe("grace");
    expect(lost.progress).toBe(0.4);
    expect(restored.progress).toBe(0.4);
    expect(continued.progress).toBe(0.5);
  });

  it("freezes progress during a short valid exit from the target", () => {
    const entered = advance(createDwellMachineState(), 0, "a");
    const holding = advance(entered.state, 400, "a");
    const left = advance(holding.state, 450, undefined, true);
    const restored = advance(left.state, 550, "a");
    const continued = advance(restored.state, 650, "a");

    expect(left.state.phase).toBe("grace");
    expect(left.progress).toBe(0.4);
    expect(restored.progress).toBe(0.4);
    expect(continued.progress).toBe(0.5);
  });

  it("never accumulates invalid-gaze time", () => {
    const entered = advance(createDwellMachineState(), 0, "a");
    const holding = advance(entered.state, 300, "a");
    const lost = advance(holding.state, 320, undefined, false);
    const stillLost = advance(lost.state, 400, undefined, false);
    const restored = advance(stillLost.state, 430, "a");
    const continued = advance(restored.state, 530, "a");

    expect(lost.progress).toBe(0.3);
    expect(stillLost.progress).toBe(0.3);
    expect(restored.progress).toBe(0.3);
    expect(continued.progress).toBe(0.4);
  });

  it("cancels after invalid gaze exceeds grace", () => {
    const entered = advance(createDwellMachineState(), 0, "a");
    const lost = advance(entered.state, 200, undefined, false);
    const cancelled = advance(lost.state, 351, undefined, false);

    expect(cancelled.events).toEqual([{ type: "cancel", targetId: "a", reason: "invalid-gaze" }]);
    expect(cancelled.state.phase).toBe("idle");
  });

  it("switches immediately to another resolved target", () => {
    const entered = advance(createDwellMachineState(), 0, "a");
    const switched = advance(entered.state, 200, "b");

    expect(switched.events).toEqual([
      { type: "cancel", targetId: "a", reason: "left" },
      { type: "enter", targetId: "b" }
    ]);
    expect(switched.state.targetId).toBe("b");
  });

  it("cancels immediately when another coordinated target wins", () => {
    const entered = advance(createDwellMachineState(), 0, "a");
    const switched = advanceDwellMachine(entered.state, {
      now: 200,
      pointerValid: true,
      anotherTargetActive: true,
      dwellMs: 1000,
      graceMs: 150,
      cooldownMs: 500
    });

    expect(switched.events).toEqual([{ type: "cancel", targetId: "a", reason: "left" }]);
    expect(switched.state.phase).toBe("idle");
  });

  it("cancels a disabled target without grace", () => {
    const entered = advance(createDwellMachineState(), 0, "a");
    const disabled = advanceDwellMachine(entered.state, {
      now: 200,
      pointerValid: true,
      disabled: true,
      dwellMs: 1000,
      graceMs: 150,
      cooldownMs: 500
    });

    expect(disabled.events).toEqual([{ type: "cancel", targetId: "a", reason: "disabled" }]);
    expect(disabled.state.phase).toBe("idle");
  });

  it("does not re-enter during cooldown", () => {
    const entered = advance(createDwellMachineState(), 0, "a");
    const selected = advance(entered.state, 1000, "a");
    const cooling = advance(selected.state, 1200, "a");
    const reentered = advance(cooling.state, 1500, "a");

    expect(cooling.events).toEqual([]);
    expect(cooling.state.phase).toBe("cooldown");
    expect(reentered.events).toEqual([{ type: "enter", targetId: "a" }]);
  });
});
