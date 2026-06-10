import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { adjacentIndexes, createInitialCellStates, findSuggestedSafeIndex, generateMinesweeperSafeBoard } from "./model";

describe("minesweeper-safe model", () => {
  it("creates a standard board with five mines and safe opening clues", () => {
    const board = generateMinesweeperSafeBoard(settingsFromPreset("standard"), 2);

    expect(board.roundId).toBe("minesweeper-safe:round:2");
    expect(board.size).toBe(5);
    expect(board.cells).toHaveLength(25);
    expect(board.cells.filter((cell) => cell.mine)).toHaveLength(5);
    expect(board.initialRevealed).toHaveLength(4);
    expect(board.initialRevealed.every((index) => !board.cells[index].mine)).toBe(true);
  });

  it("changes board density by preset", () => {
    const gentle = generateMinesweeperSafeBoard(settingsFromPreset("gentle"));
    const challenge = generateMinesweeperSafeBoard(settingsFromPreset("challenge"));

    expect(gentle.size).toBe(4);
    expect(gentle.mineCount).toBe(3);
    expect(challenge.size).toBe(5);
    expect(challenge.mineCount).toBe(7);
  });

  it("stores correct adjacent mine counts", () => {
    const board = generateMinesweeperSafeBoard(settingsFromPreset("standard"), 5);
    const mines = new Set(board.cells.filter((cell) => cell.mine).map((cell) => cell.index));

    for (const cell of board.cells) {
      expect(cell.adjacentMines).toBe(adjacentIndexes(cell.index, board.size).filter((index) => mines.has(index)).length);
    }
  });

  it("suggests a hidden safe cell", () => {
    const board = generateMinesweeperSafeBoard(settingsFromPreset("standard"), 7);
    const states = createInitialCellStates(board);
    const suggestion = findSuggestedSafeIndex(board.cells, states);

    expect(suggestion).toBeTypeOf("number");
    expect(board.cells[suggestion ?? -1].mine).toBe(false);
    expect(states[suggestion ?? -1]).toBe("hidden");
  });
});
