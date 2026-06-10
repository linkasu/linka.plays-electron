import { describe, expect, it } from "vitest";
import {
  applyCheckersLightMove,
  cellIndex,
  checkersLightCells,
  createInitialCheckersLightBoard,
  getMovablePieceIndexes,
  getMoveTargets,
  isDarkCell
} from "./model";

describe("checkers-light model", () => {
  it("creates a 4x4 board with four pieces on dark cells", () => {
    const board = createInitialCheckersLightBoard();
    const pieceIndexes = board.map((piece, index) => piece ? index : undefined).filter((index): index is number => index !== undefined);

    expect(board).toHaveLength(checkersLightCells);
    expect(pieceIndexes).toEqual([1, 3, 12, 14]);
    expect(pieceIndexes.every(isDarkCell)).toBe(true);
  });

  it("returns empty diagonal dark cells as move targets", () => {
    const board = createInitialCheckersLightBoard();

    expect(getMoveTargets(board, cellIndex(3, 0))).toEqual([cellIndex(2, 1)]);
    expect(getMoveTargets(board, cellIndex(3, 2))).toEqual([cellIndex(2, 1), cellIndex(2, 3)]);
  });

  it("does not include occupied cells as move targets", () => {
    const board = createInitialCheckersLightBoard();
    board[cellIndex(2, 1)] = { id: "blocker", side: "blue" };

    expect(getMoveTargets(board, cellIndex(3, 0))).toEqual([]);
  });

  it("moves a piece immutably and rejects unavailable moves", () => {
    const board = createInitialCheckersLightBoard();
    const from = cellIndex(3, 0);
    const to = cellIndex(2, 1);
    const nextBoard = applyCheckersLightMove(board, from, to);

    expect(nextBoard?.[from]).toBeUndefined();
    expect(nextBoard?.[to]).toEqual({ id: "gold-1", side: "gold" });
    expect(board[from]).toEqual({ id: "gold-1", side: "gold" });
    expect(applyCheckersLightMove(board, from, cellIndex(3, 2))).toBeUndefined();
  });

  it("lists pieces that can currently move", () => {
    const board = createInitialCheckersLightBoard();

    expect(getMovablePieceIndexes(board)).toEqual([1, 3, 12, 14]);
  });
});
