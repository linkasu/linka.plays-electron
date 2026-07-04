import { describe, expect, it } from "vitest";
import {
  stepTetrisCells,
  stepTetrisColumns,
  stepTetrisRows,
  stepTetrisSpawnOutcome,
  canSpawnPiece,
  cellIndex,
  clearFullLines,
  createEmptyBoard,
  createPiece,
  createSpawnPlacement,
  getDropRow,
  getGhostPlacement,
  isValidPlacement,
  lockPiece,
  rotateShape
} from "./model";

describe("step-tetris model", () => {
  it("creates a compact empty board", () => {
    const board = createEmptyBoard();

    expect(board).toHaveLength(stepTetrisCells);
    expect(stepTetrisColumns).toBe(10);
    expect(stepTetrisRows).toBe(12);
    expect(board.every((cell) => cell === "")).toBe(true);
  });

  it("rotates and normalizes shape cells", () => {
    expect(rotateShape([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 1, column: 1 }
    ])).toEqual([
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
      { row: 2, column: 1 }
    ]);
  });

  it("rejects placements outside the board or on locked cells", () => {
    const board = createEmptyBoard();
    const piece = createPiece("o");

    expect(isValidPlacement(board, { piece, row: 0, column: 0 })).toBe(true);
    expect(isValidPlacement(board, { piece, row: 0, column: -1 })).toBe(false);

    board[cellIndex(0, 0)] = "t";
    expect(isValidPlacement(board, { piece, row: 0, column: 0 })).toBe(false);
  });

  it("finds the ghost drop row above existing blocks", () => {
    const board = createEmptyBoard();
    const piece = createPiece("o");
    board[cellIndex(stepTetrisRows - 1, 4)] = "i";

    const placement = { piece, row: 0, column: 4 };
    expect(getDropRow(board, placement)).toBe(stepTetrisRows - 3);
    expect(getGhostPlacement(board, placement)).toEqual({ ...placement, row: stepTetrisRows - 3 });
  });

  it("locks a piece without mutating the original board", () => {
    const board = createEmptyBoard();
    const placement = { piece: createPiece("o"), row: stepTetrisRows - 2, column: 0 };
    const result = lockPiece(board, placement);

    expect(result?.clearedLines).toBe(0);
    expect(result?.board[cellIndex(stepTetrisRows - 1, 1)]).toBe("o");
    expect(board[cellIndex(stepTetrisRows - 1, 1)]).toBe("");
  });

  it("clears full lines and keeps board height", () => {
    const board = createEmptyBoard();
    for (let column = 0; column < stepTetrisColumns; column++) board[cellIndex(stepTetrisRows - 1, column)] = "i";
    board[cellIndex(stepTetrisRows - 2, 0)] = "t";

    const result = clearFullLines(board);
    expect(result.clearedLines).toBe(1);
    expect(result.board).toHaveLength(stepTetrisCells);
    expect(result.board[cellIndex(stepTetrisRows - 1, 0)]).toBe("t");
    expect(result.board[cellIndex(0, 0)]).toBe("");
  });

  it("detects crowded top rows as top-out in strict play", () => {
    const board = createEmptyBoard();
    const piece = createPiece("i");
    const spawn = createSpawnPlacement(piece);
    board[cellIndex(0, spawn.column)] = "s";

    expect(canSpawnPiece(board, piece)).toBe(false);
    expect(stepTetrisSpawnOutcome(board, piece)).toBe("loss");
    expect(stepTetrisSpawnOutcome(createEmptyBoard(), piece)).toBe("playing");
  });
});
