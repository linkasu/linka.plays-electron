import { describe, expect, it } from "vitest";
import { cellIndex, countColors, createInitialLinesFiveBoard, linesFiveCellCount, linesFiveOutcome, nextColorForStep, placeBall, suggestedMoveIndexes } from "./model";

describe("lines-five model", () => {
  it("creates a 5x5 opening board with the first soft line setup", () => {
    const board = createInitialLinesFiveBoard();

    expect(board).toHaveLength(linesFiveCellCount);
    expect(countColors(board)).toEqual({ sky: 2, sun: 2, leaf: 1, berry: 1 });
    expect(suggestedMoveIndexes(board, "sky")).toContain(cellIndex(0, 2));
  });

  it("cycles ball colors by successful step", () => {
    expect([0, 1, 2, 3, 4].map(nextColorForStep)).toEqual(["sky", "sun", "leaf", "berry", "sky"]);
  });

  it("places a ball and clears a line of three", () => {
    const result = placeBall(createInitialLinesFiveBoard(), cellIndex(0, 2), "sky");

    expect(result?.completedLines).toEqual([[cellIndex(0, 0), cellIndex(0, 1), cellIndex(0, 2)]]);
    expect(result?.cleared).toEqual([cellIndex(0, 0), cellIndex(0, 1), cellIndex(0, 2)]);
    expect(result?.board[cellIndex(0, 0)]).toBe("");
    expect(result?.board[cellIndex(0, 2)]).toBe("");
  });

  it("rejects occupied cells without mutating the board", () => {
    const board = createInitialLinesFiveBoard();

    expect(placeBall(board, cellIndex(0, 0), "sky")).toBeUndefined();
    expect(countColors(board)).toEqual({ sky: 2, sun: 2, leaf: 1, berry: 1 });
  });

  it("clears diagonal lines up to five balls", () => {
    const board = Array(linesFiveCellCount).fill("");
    board[cellIndex(0, 0)] = "berry";
    board[cellIndex(1, 1)] = "berry";
    board[cellIndex(2, 2)] = "berry";
    board[cellIndex(3, 3)] = "berry";

    const result = placeBall(board, cellIndex(4, 4), "berry");

    expect(result?.cleared).toEqual([cellIndex(0, 0), cellIndex(1, 1), cellIndex(2, 2), cellIndex(3, 3), cellIndex(4, 4)]);
  });

  it("reports a loss when the board is full", () => {
    expect(linesFiveOutcome(Array(linesFiveCellCount).fill("sky"))).toBe("loss");
    expect(linesFiveOutcome(createInitialLinesFiveBoard())).toBe("playing");
  });
});
