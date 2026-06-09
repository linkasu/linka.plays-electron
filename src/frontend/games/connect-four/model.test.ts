import { describe, expect, it } from "vitest";
import { cellIndex, chooseDeepQMove, createEmptyBoard, dropDisc, findWinner } from "./model";

describe("connect-four model", () => {
  it("detects a horizontal win", () => {
    const board = createEmptyBoard();
    for (const column of [0, 1, 2, 3]) dropDisc(board, column, "R");
    expect(findWinner(board)).toBe("R");
  });

  it("detects a vertical win", () => {
    const board = createEmptyBoard();
    for (let index = 0; index < 4; index++) dropDisc(board, 2, "Y");
    expect(findWinner(board)).toBe("Y");
  });

  it("detects a diagonal win", () => {
    const board = createEmptyBoard();
    board[cellIndex(5, 0)] = "R";
    board[cellIndex(4, 1)] = "R";
    board[cellIndex(3, 2)] = "R";
    board[cellIndex(2, 3)] = "R";
    expect(findWinner(board)).toBe("R");
  });

  it("lets deep-q take an immediate win", () => {
    const board = createEmptyBoard();
    for (const column of [1, 2, 3]) dropDisc(board, column, "Y");
    expect(chooseDeepQMove(board)).toBe(0);
  });

  it("lets deep-q block an immediate player win", () => {
    const board = createEmptyBoard();
    for (const column of [0, 1, 2]) dropDisc(board, column, "R");
    expect(chooseDeepQMove(board)).toBe(3);
  });
});
