import { describe, expect, it } from "vitest";
import { createInitialBoard, createSolvedBoard, isSolved, movableTileIndexes, moveTile, slidingPuzzleCellCount } from "./model";

describe("sliding puzzle model", () => {
  it("creates a solved 3x3 board", () => {
    expect(createSolvedBoard()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
    expect(createSolvedBoard()).toHaveLength(slidingPuzzleCellCount);
  });

  it("creates a deterministic gentle puzzle", () => {
    const board = createInitialBoard();

    expect(board).toEqual([1, 6, 2, 7, 0, 3, 5, 4, 8]);
    expect(isSolved(board)).toBe(false);
    expect([...board].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("finds tiles adjacent to the empty center", () => {
    expect(movableTileIndexes([1, 6, 2, 7, 0, 3, 5, 4, 8])).toEqual([1, 3, 5, 7]);
  });

  it("moves an adjacent tile without mutating the source board", () => {
    const board = [1, 6, 2, 7, 0, 3, 5, 4, 8];
    const result = moveTile(board, 3);

    expect(board).toEqual([1, 6, 2, 7, 0, 3, 5, 4, 8]);
    expect(result).toMatchObject({ moved: true, movedTile: 7, fromIndex: 3, toIndex: 4, emptyIndex: 3 });
    expect(result.board).toEqual([1, 6, 2, 0, 7, 3, 5, 4, 8]);
  });

  it("refuses empty and non-adjacent selections", () => {
    const board = [1, 6, 2, 7, 0, 3, 5, 4, 8];

    expect(moveTile(board, 4)).toEqual({ board, moved: false, emptyIndex: 4 });
    expect(moveTile(board, 0)).toEqual({ board, moved: false, emptyIndex: 4 });
  });

  it("detects a solved board after the final two moves", () => {
    const first = moveTile([1, 2, 3, 4, 5, 6, 0, 7, 8], 7);
    const second = moveTile(first.board, 8);

    expect(isSolved(first.board)).toBe(false);
    expect(isSolved(second.board)).toBe(true);
  });
});
