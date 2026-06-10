import { describe, expect, it } from "vitest";
import {
  calmTetrisCells,
  calmTetrisColumns,
  calmTetrisRows,
  calmTetrisSpawnOutcome,
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

describe("calm-tetris model", () => {
  it("creates a compact empty board", () => {
    const board = createEmptyBoard();

    expect(board).toHaveLength(calmTetrisCells);
    expect(calmTetrisColumns).toBe(10);
    expect(calmTetrisRows).toBe(12);
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
    board[cellIndex(calmTetrisRows - 1, 4)] = "i";

    const placement = { piece, row: 0, column: 4 };
    expect(getDropRow(board, placement)).toBe(calmTetrisRows - 3);
    expect(getGhostPlacement(board, placement)).toEqual({ ...placement, row: calmTetrisRows - 3 });
  });

  it("locks a piece without mutating the original board", () => {
    const board = createEmptyBoard();
    const placement = { piece: createPiece("o"), row: calmTetrisRows - 2, column: 0 };
    const result = lockPiece(board, placement);

    expect(result?.clearedLines).toBe(0);
    expect(result?.board[cellIndex(calmTetrisRows - 1, 1)]).toBe("o");
    expect(board[cellIndex(calmTetrisRows - 1, 1)]).toBe("");
  });

  it("clears full lines and keeps board height", () => {
    const board = createEmptyBoard();
    for (let column = 0; column < calmTetrisColumns; column++) board[cellIndex(calmTetrisRows - 1, column)] = "i";
    board[cellIndex(calmTetrisRows - 2, 0)] = "t";

    const result = clearFullLines(board);
    expect(result.clearedLines).toBe(1);
    expect(result.board).toHaveLength(calmTetrisCells);
    expect(result.board[cellIndex(calmTetrisRows - 1, 0)]).toBe("t");
    expect(result.board[cellIndex(0, 0)]).toBe("");
  });

  it("detects crowded top rows as top-out in strict play", () => {
    const board = createEmptyBoard();
    const piece = createPiece("i");
    const spawn = createSpawnPlacement(piece);
    board[cellIndex(0, spawn.column)] = "s";

    expect(canSpawnPiece(board, piece)).toBe(false);
    expect(calmTetrisSpawnOutcome(board, piece)).toBe("loss");
    expect(calmTetrisSpawnOutcome(createEmptyBoard(), piece)).toBe("playing");
  });
});
