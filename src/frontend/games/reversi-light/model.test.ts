import { describe, expect, it } from "vitest";
import { applyMove, cellIndex, chooseAiMove, countPieces, createInitialBoard, findWinner, isValidMove, validMoves } from "./model";

describe("reversi-light model", () => {
  it("creates a 4x4 opening board", () => {
    const board = createInitialBoard();

    expect(board).toHaveLength(16);
    expect(countPieces(board)).toEqual({ player: 2, ai: 2 });
  });

  it("finds highlighted player moves from the opening", () => {
    const board = createInitialBoard();

    expect(validMoves(board, "player").sort((a, b) => a - b)).toEqual([1, 4, 11, 14]);
    expect(isValidMove(board, cellIndex(0, 0), "player")).toBe(false);
  });

  it("applies a valid move and flips captured pieces", () => {
    const result = applyMove(createInitialBoard(), cellIndex(0, 1), "player");

    expect(result?.flipped).toEqual([cellIndex(1, 1)]);
    expect(result?.board[cellIndex(0, 1)]).toBe("player");
    expect(result?.board[cellIndex(1, 1)]).toBe("player");
    expect(countPieces(result?.board ?? [])).toEqual({ player: 4, ai: 1 });
  });

  it("rejects invalid empty-cell moves without mutating the board", () => {
    const board = createInitialBoard();

    expect(applyMove(board, cellIndex(0, 0), "player")).toBeUndefined();
    expect(countPieces(board)).toEqual({ player: 2, ai: 2 });
  });

  it("chooses a legal ai response", () => {
    const afterPlayer = applyMove(createInitialBoard(), cellIndex(0, 1), "player")?.board;
    const move = chooseAiMove(afterPlayer ?? []);

    expect(move).toBeTypeOf("number");
    expect(validMoves(afterPlayer ?? [], "ai")).toContain(move);
  });

  it("declares the piece majority as winner", () => {
    expect(findWinner(["player", "player", "ai", "", "", "", "", "", "", "", "", "", "", "", "", ""])).toBe("player");
    expect(findWinner(["player", "ai", "", "", "", "", "", "", "", "", "", "", "", "", "", ""])).toBe("draw");
  });
});
