import { describe, expect, it } from "vitest";
import {
  applySokobanLargeMove,
  createSokobanLargeState,
  hasSokobanLargeWall,
  isSokobanLargeComplete,
  sokobanLargeChoiceOutcome,
  sokobanLargeSolution,
  solveSokobanLargeState,
  type SokobanLargeState
} from "./model";

function perimeterWalls(width: number, height: number) {
  const walls = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (row === 0 || column === 0 || row === height - 1 || column === width - 1) walls.push({ row, column });
    }
  }
  return walls;
}

function fixedState(): SokobanLargeState {
  return {
    width: 6,
    height: 6,
    walls: perimeterWalls(6, 6),
    player: { row: 4, column: 2 },
    box: { row: 3, column: 2 },
    goal: { row: 2, column: 4 },
    stepIndex: 0,
    roundIndex: 0,
    solution: [...sokobanLargeSolution]
  };
}

function playSolution(state: SokobanLargeState) {
  return state.solution.reduce((currentState, direction) => applySokobanLargeMove(currentState, direction).state, state);
}

describe("sokoban large model", () => {
  it("generates solved-by-proof rounds", () => {
    for (let roundIndex = 0; roundIndex < 10; roundIndex += 1) {
      const state = createSokobanLargeState(roundIndex);
      const solution = solveSokobanLargeState(state);

      expect(state.width).toBe(6);
      expect(state.height).toBe(6);
      expect(state.solution.length).toBeGreaterThan(0);
      expect(solution.length).toBeGreaterThan(0);
      expect(playSolution(state).box).toEqual(state.goal);
    }
  });

  it("creates a wall-bounded test board with a real solution", () => {
    const state = fixedState();

    expect(state.player).toEqual({ row: 4, column: 2 });
    expect(state.box).toEqual({ row: 3, column: 2 });
    expect(state.goal).toEqual({ row: 2, column: 4 });
    expect(hasSokobanLargeWall(state, { row: 0, column: 0 })).toBe(true);
    expect(hasSokobanLargeWall(state, { row: 3, column: 2 })).toBe(false);
    expect(state.solution).toEqual(["up", "left", "up", "right", "right"]);
  });

  it("blocks walls without changing the state", () => {
    const state = fixedState();
    const result = applySokobanLargeMove(state, "down");

    expect(result.event).toBe("blocked");
    expect(result.moved).toBe(false);
    expect(result.state).toEqual(state);
    expect(result.state).not.toBe(state);
  });

  it("treats blocked moves as retryable mistakes, not loss", () => {
    const state = fixedState();
    const blocked = applySokobanLargeMove(state, "down");
    const moved = applySokobanLargeMove(state, "left");

    expect(sokobanLargeChoiceOutcome(moved, 99)).toBe("move");
    expect(sokobanLargeChoiceOutcome(blocked, 99)).toBe("wrong-move");
  });

  it("applies walking moves without moving the box", () => {
    const state = fixedState();
    const result = applySokobanLargeMove(state, "left");

    expect(result.event).toBe("moved");
    expect(result.moved).toBe(true);
    expect(result.pushed).toBe(false);
    expect(result.state.player).toEqual({ row: 4, column: 1 });
    expect(result.state.box).toEqual(state.box);
    expect(state.player).toEqual({ row: 4, column: 2 });
  });

  it("pushes the box only when the destination behind it is free", () => {
    const state = fixedState();
    const push = applySokobanLargeMove(state, "up");

    expect(push.event).toBe("pushed");
    expect(push.pushed).toBe(true);
    expect(push.state.player).toEqual({ row: 3, column: 2 });
    expect(push.state.box).toEqual({ row: 2, column: 2 });
  });

  it("finishes when real sokoban pushes place the box on the goal", () => {
    const finalState = playSolution(fixedState());

    expect(finalState.stepIndex).toBe(5);
    expect(finalState.box).toEqual(finalState.goal);
    expect(isSokobanLargeComplete(finalState)).toBe(true);
  });
});
