import { describe, expect, it } from "vitest";
import {
  applyCheckersLightMove,
  cellIndex,
  checkersLightCells,
  checkersLightOutcome,
  chooseCheckersLightAiMove,
  countCheckersLightPieces,
  createInitialCheckersLightState,
  encodeCheckersLightBoard,
  getLegalMoves,
  getMovablePieceIndexes,
  getMoveTargets,
  isDarkCell,
  type CheckersLightBoard,
  type CheckersLightState
} from "./model";

function emptyState(board: CheckersLightBoard, turn: "gold" | "blue" = "gold"): CheckersLightState {
  return { board, turn, status: "playing", moveCount: 0 };
}

function emptyBoard(): CheckersLightBoard {
  return Array(checkersLightCells).fill(undefined);
}

describe("checkers-light model", () => {
  it("creates a full 8x8 Russian checkers opening", () => {
    const state = createInitialCheckersLightState();
    const pieceIndexes = state.board.map((piece, index) => piece ? index : undefined).filter((index): index is number => index !== undefined);

    expect(state.board).toHaveLength(64);
    expect(countCheckersLightPieces(state.board)).toEqual({ gold: 12, blue: 12 });
    expect(pieceIndexes.every(isDarkCell)).toBe(true);
    expect(state.turn).toBe("gold");
  });

  it("returns forward quiet moves for gold pieces", () => {
    const state = createInitialCheckersLightState();

    expect(getMoveTargets(state, cellIndex(5, 0))).toEqual([cellIndex(4, 1)]);
    expect(getMovablePieceIndexes(state)).toEqual([cellIndex(5, 0), cellIndex(5, 2), cellIndex(5, 4), cellIndex(5, 6)]);
  });

  it("enforces mandatory captures over quiet moves", () => {
    const board = emptyBoard();
    board[cellIndex(5, 0)] = { id: "gold", side: "gold", king: false };
    board[cellIndex(4, 1)] = { id: "blue", side: "blue", king: false };
    board[cellIndex(5, 4)] = { id: "gold-quiet", side: "gold", king: false };
    const state = emptyState(board);

    expect(getLegalMoves(state)).toEqual([{ fromIndex: cellIndex(5, 0), toIndex: cellIndex(3, 2), capturedIndex: cellIndex(4, 1), capture: true }]);
  });

  it("allows simple pieces to capture backwards", () => {
    const board = emptyBoard();
    board[cellIndex(3, 2)] = { id: "gold", side: "gold", king: false };
    board[cellIndex(4, 3)] = { id: "blue", side: "blue", king: false };
    const state = emptyState(board);

    expect(getLegalMoves(state)).toContainEqual({ fromIndex: cellIndex(3, 2), toIndex: cellIndex(5, 4), capturedIndex: cellIndex(4, 3), capture: true });
  });

  it("moves immutably and continues capture chains", () => {
    const board = emptyBoard();
    board[cellIndex(5, 0)] = { id: "gold", side: "gold", king: false };
    board[cellIndex(4, 1)] = { id: "blue-1", side: "blue", king: false };
    board[cellIndex(2, 3)] = { id: "blue-2", side: "blue", king: false };
    let state = emptyState(board);
    const first = applyCheckersLightMove(state, cellIndex(5, 0), cellIndex(3, 2));

    expect(first && !Array.isArray(first) && first.mustContinue).toBe(true);
    if (!first || Array.isArray(first)) throw new Error("expected move result");
    state = first.state;
    expect(state.turn).toBe("gold");
    expect(state.forcedFromIndex).toBe(cellIndex(3, 2));
    expect(state.board[cellIndex(4, 1)]).toBeUndefined();

    const second = applyCheckersLightMove(state, cellIndex(3, 2), cellIndex(1, 4));
    expect(second && !Array.isArray(second) && second.mustContinue).toBe(false);
    if (!second || Array.isArray(second)) throw new Error("expected move result");
    expect(second.state.turn).toBe("blue");
    expect(second.state.board[cellIndex(2, 3)]).toBeUndefined();
  });

  it("promotes pieces to kings", () => {
    const board = emptyBoard();
    board[cellIndex(1, 2)] = { id: "gold", side: "gold", king: false };
    const result = applyCheckersLightMove(emptyState(board), cellIndex(1, 2), cellIndex(0, 1));

    expect(result && !Array.isArray(result) && result.promoted).toBe(true);
    if (!result || Array.isArray(result)) throw new Error("expected move result");
    expect(result.state.board[cellIndex(0, 1)]?.king).toBe(true);
  });

  it("lets kings move and capture across diagonals", () => {
    const board = emptyBoard();
    board[cellIndex(5, 0)] = { id: "king", side: "gold", king: true };
    board[cellIndex(3, 2)] = { id: "blue", side: "blue", king: false };
    const state = emptyState(board);

    expect(getLegalMoves(state)).toContainEqual({ fromIndex: cellIndex(5, 0), toIndex: cellIndex(2, 3), capturedIndex: cellIndex(3, 2), capture: true });
    expect(getLegalMoves(state)).toContainEqual({ fromIndex: cellIndex(5, 0), toIndex: cellIndex(1, 4), capturedIndex: cellIndex(3, 2), capture: true });
  });

  it("reports wins and lets AI choose a legal capture", () => {
    const board = emptyBoard();
    board[cellIndex(2, 1)] = { id: "blue", side: "blue", king: false };
    board[cellIndex(3, 2)] = { id: "gold", side: "gold", king: false };
    const state = emptyState(board, "blue");
    const aiMove = chooseCheckersLightAiMove(state, 3);

    expect(checkersLightOutcome(emptyState(board, "blue"))).toBe("playing");
    expect(aiMove).toEqual({ fromIndex: cellIndex(2, 1), toIndex: cellIndex(4, 3), capturedIndex: cellIndex(3, 2), capture: true });
    expect(encodeCheckersLightBoard(board)).toHaveLength(64);
  });
});
