import { describe, expect, it } from "vitest";
import { number2048Outcome, canMove, createEmptyBoard, createInitialBoard, highestTile, moveBoard, spawnTile, type Number2048Random } from "./model";

function randomFrom(values: number[]): Number2048Random {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("calm 2048 model", () => {
  it("creates an empty 4x4 board", () => {
    expect(createEmptyBoard()).toEqual(Array(16).fill(0));
  });

  it("spawns deterministic tiles without mutating the source board", () => {
    const board = createEmptyBoard();
    const result = spawnTile(board, randomFrom([0.5, 0.95]));

    expect(board).toEqual(Array(16).fill(0));
    expect(result.spawnedIndex).toBe(8);
    expect(result.value).toBe(4);
    expect(result.board[8]).toBe(4);
  });

  it("creates an initial board with two deterministic tiles", () => {
    const board = createInitialBoard(randomFrom([0, 0.1, 0, 0.95]));

    expect(board.filter(Boolean)).toEqual([2, 4]);
    expect(board[0]).toBe(2);
    expect(board[1]).toBe(4);
  });

  it("returns a copied full board when no tile can spawn", () => {
    const board = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    const result = spawnTile(board, randomFrom([0, 0]));

    expect(result.board).toEqual(board);
    expect(result.board).not.toBe(board);
    expect(result.spawnedIndex).toBeUndefined();
    expect(result.value).toBeUndefined();
  });

  it("moves and merges left once per tile", () => {
    const result = moveBoard([2, 0, 2, 2, 4, 4, 4, 4, 2, 2, 2, 2, 0, 0, 0, 2], "left");

    expect(result.board).toEqual([4, 2, 0, 0, 8, 8, 0, 0, 4, 4, 0, 0, 2, 0, 0, 0]);
    expect(result.moved).toBe(true);
    expect(result.merged).toBe(true);
    expect(result.scoreGain).toBe(28);
  });

  it("moves and merges right", () => {
    const result = moveBoard([2, 0, 2, 2, 0, 4, 0, 4, 2, 2, 2, 0, 0, 0, 0, 0], "right");

    expect(result.board).toEqual([0, 0, 2, 4, 0, 0, 0, 8, 0, 0, 2, 4, 0, 0, 0, 0]);
    expect(result.scoreGain).toBe(16);
  });

  it("moves and merges vertically", () => {
    const up = moveBoard([2, 0, 2, 4, 2, 0, 2, 4, 4, 0, 0, 4, 4, 2, 0, 0], "up");
    const down = moveBoard([2, 0, 2, 4, 2, 0, 2, 4, 4, 0, 0, 4, 4, 2, 0, 0], "down");

    expect(up.board).toEqual([4, 2, 4, 8, 8, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(down.board).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 4, 8, 2, 4, 8]);
  });

  it("detects available moves", () => {
    const locked = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    const mergeable = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 2, 4];

    expect(canMove(locked)).toBe(false);
    expect(canMove(mergeable)).toBe(true);
    expect(canMove([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "left")).toBe(false);
    expect(canMove([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "right")).toBe(true);
  });

  it("reports the highest tile", () => {
    expect(highestTile([2, 4, 0, 16, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(16);
  });

  it("reports a loss when the board has no legal moves", () => {
    expect(number2048Outcome([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])).toBe("loss");
    expect(number2048Outcome([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 2, 4])).toBe("playing");
  });
});
