import { describe, expect, it } from "vitest";
import {
  cellIndex,
  chooseLinesFiveCell,
  completedLinesThrough,
  countColors,
  createEmptyLinesFiveBoard,
  createInitialLinesFiveState,
  findPath,
  linesFiveCellCount,
  linesFiveOutcome,
  nextColorForStep,
  placeBall,
  reachableDestinationIndexes,
  suggestedMoveIndexes,
  type LinesFiveState
} from "./model";

describe("lines-five model", () => {
  it("creates a 6x6 opening board with a near line of five", () => {
    const state = createInitialLinesFiveState();

    expect(state.board).toHaveLength(linesFiveCellCount);
    expect(countColors(state.board)).toEqual({ sky: 4, sun: 1, leaf: 1, berry: 1 });
    expect(suggestedMoveIndexes(state.board, "sky")).toContain(cellIndex(0, 4));
    expect(state.nextBalls).toHaveLength(3);
  });

  it("keeps the legacy color cycle helper deterministic", () => {
    expect([0, 1, 2, 3, 4].map(nextColorForStep)).toEqual(["sky", "sun", "leaf", "berry", "sky"]);
  });

  it("places a ball and clears a line of five", () => {
    const result = placeBall(createInitialLinesFiveState().board, cellIndex(0, 4), "sky");

    expect(result?.completedLines).toEqual([[cellIndex(0, 0), cellIndex(0, 1), cellIndex(0, 2), cellIndex(0, 3), cellIndex(0, 4)]]);
    expect(result?.cleared).toEqual([cellIndex(0, 0), cellIndex(0, 1), cellIndex(0, 2), cellIndex(0, 3), cellIndex(0, 4)]);
    expect(result?.board[cellIndex(0, 0)]).toBe("");
    expect(result?.board[cellIndex(0, 4)]).toBe("");
  });

  it("selects a ball before moving it", () => {
    const state = createInitialLinesFiveState();
    const result = chooseLinesFiveCell(state, cellIndex(0, 0));

    expect(result.event).toBe("selected");
    expect(result.state.selectedIndex).toBe(cellIndex(0, 0));
    expect(result.state.board).toEqual(state.board);
  });

  it("moves selected balls through a free path and clears five", () => {
    const board = createEmptyLinesFiveBoard();
    board[cellIndex(0, 0)] = "sky";
    board[cellIndex(0, 1)] = "sky";
    board[cellIndex(0, 2)] = "sky";
    board[cellIndex(0, 3)] = "sky";
    board[cellIndex(5, 5)] = "sky";
    let state: LinesFiveState = { board, nextBalls: ["sun", "leaf", "berry"], score: 0, moveCount: 0, seed: 1, status: "playing" };
    state = chooseLinesFiveCell(state, cellIndex(5, 5)).state;
    const result = chooseLinesFiveCell(state, cellIndex(0, 4));

    expect(result.event).toBe("cleared");
    expect(result.movedFrom).toBe(cellIndex(5, 5));
    expect(result.movedTo).toBe(cellIndex(0, 4));
    expect(result.cleared).toEqual([cellIndex(0, 0), cellIndex(0, 1), cellIndex(0, 2), cellIndex(0, 3), cellIndex(0, 4)]);
    expect(result.state.score).toBe(5);
    expect(result.state.board[cellIndex(0, 4)]).toBe("");
  });

  it("rejects unreachable destinations without mutating the state", () => {
    const board = createEmptyLinesFiveBoard();
    board[cellIndex(1, 1)] = "sky";
    board[cellIndex(0, 1)] = "sun";
    board[cellIndex(1, 0)] = "sun";
    board[cellIndex(1, 2)] = "sun";
    board[cellIndex(2, 1)] = "sun";
    const state: LinesFiveState = { board, selectedIndex: cellIndex(1, 1), nextBalls: ["sky", "sun", "leaf"], score: 0, moveCount: 0, seed: 1, status: "playing" };

    const result = chooseLinesFiveCell(state, cellIndex(4, 4));

    expect(result.event).toBe("invalid");
    expect(result.state).toEqual(state);
    expect(findPath(board, cellIndex(1, 1), cellIndex(4, 4))).toEqual([]);
  });

  it("spawns queued balls after a move that does not clear a line", () => {
    let state = createInitialLinesFiveState(123);
    state = chooseLinesFiveCell(state, cellIndex(5, 5)).state;
    const result = chooseLinesFiveCell(state, cellIndex(5, 0));

    expect(result.event).toBe("moved");
    expect(result.spawned).toHaveLength(3);
    expect(result.state.moveCount).toBe(1);
    expect(countColors(result.state.board).sky + countColors(result.state.board).sun + countColors(result.state.board).leaf + countColors(result.state.board).berry).toBe(10);
  });

  it("detects reachable destinations and board-full loss", () => {
    const state = createInitialLinesFiveState();
    expect(reachableDestinationIndexes(state.board, cellIndex(0, 0))).toContain(cellIndex(0, 4));
    expect(completedLinesThrough(state.board, cellIndex(0, 0))).toEqual([]);
    expect(linesFiveOutcome(Array(linesFiveCellCount).fill("sky"))).toBe("loss");
  });
});
