import { describe, expect, it } from "vitest";
import {
  applySokobanLargeMove,
  createSokobanLargeState,
  getSokobanLargeExpectedDirection,
  isSokobanLargeComplete,
  sokobanLargePlan,
  type SokobanLargeState
} from "./model";

function playPlan(state: SokobanLargeState) {
  return sokobanLargePlan.reduce((currentState, direction) => applySokobanLargeMove(currentState, direction).state, state);
}

describe("sokoban large model", () => {
  it("creates a small large-cell board with a 12 step plan", () => {
    const state = createSokobanLargeState();

    expect(state.width).toBe(5);
    expect(state.height).toBe(5);
    expect(state.player).toEqual({ row: 4, column: 3 });
    expect(state.box).toEqual({ row: 3, column: 1 });
    expect(state.goal).toEqual({ row: 0, column: 4 });
    expect(sokobanLargePlan).toHaveLength(12);
    expect(getSokobanLargeExpectedDirection(state)).toBe("left");
  });

  it("does not apply a wrong move and returns the hint direction", () => {
    const state = createSokobanLargeState();
    const result = applySokobanLargeMove(state, "right");

    expect(result.event).toBe("wrong-direction");
    expect(result.moved).toBe(false);
    expect(result.expectedDirection).toBe("left");
    expect(result.state).toEqual(state);
    expect(result.state).not.toBe(state);
  });

  it("applies walking moves without moving the box", () => {
    const state = createSokobanLargeState();
    const result = applySokobanLargeMove(state, "left");

    expect(result.event).toBe("moved");
    expect(result.moved).toBe(true);
    expect(result.pushed).toBe(false);
    expect(result.state.player).toEqual({ row: 4, column: 2 });
    expect(result.state.box).toEqual(state.box);
    expect(state.player).toEqual({ row: 4, column: 3 });
  });

  it("pushes the box when the player steps into it", () => {
    let state = createSokobanLargeState();
    for (const direction of sokobanLargePlan.slice(0, 4)) state = applySokobanLargeMove(state, direction).state;

    const push = applySokobanLargeMove(state, "up");

    expect(push.event).toBe("pushed");
    expect(push.pushed).toBe(true);
    expect(push.state.player).toEqual({ row: 3, column: 1 });
    expect(push.state.box).toEqual({ row: 2, column: 1 });
  });

  it("finishes when the planned pushes place the box on the goal", () => {
    const finalState = playPlan(createSokobanLargeState());

    expect(finalState.stepIndex).toBe(12);
    expect(finalState.box).toEqual(finalState.goal);
    expect(isSokobanLargeComplete(finalState)).toBe(true);
    expect(applySokobanLargeMove(finalState, "right").event).toBe("complete");
  });
});
