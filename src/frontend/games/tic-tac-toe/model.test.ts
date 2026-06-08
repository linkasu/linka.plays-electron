import { describe, expect, it } from "vitest";
import { chooseDeepQMove, createEmptyBoard, findWinner } from "./model";

describe("tic-tac-toe model", () => {
  it("detects a winner", () => {
    expect(findWinner(["X", "X", "X", "", "O", "", "", "", "O"])).toBe("X");
  });

  it("lets deep-q take an immediate win", () => {
    expect(chooseDeepQMove(["O", "O", "", "X", "", "", "X", "", ""])).toBe(2);
  });

  it("lets deep-q block an immediate player win", () => {
    expect(chooseDeepQMove(["X", "X", "", "O", "", "", "", "", ""])).toBe(2);
  });

  it("returns a legal opening move", () => {
    const board = createEmptyBoard();
    const move = chooseDeepQMove(board);
    expect(move).toBeTypeOf("number");
    expect(board[move ?? -1]).toBe("");
  });
});
