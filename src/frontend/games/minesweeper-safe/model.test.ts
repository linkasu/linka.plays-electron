import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { adjacentIndexes, areAllMinesFlagged, createInitialCellStates, findSuggestedSafeIndex, generateMinesweeperSafeBoard, minesweeperSafeChoiceOutcome } from "./model";

describe("minesweeper-safe model", () => {
  const deterministicRandom = () => 0.42;

  it("creates a standard board with five mines and safe opening clues", () => {
    const board = generateMinesweeperSafeBoard(settingsFromPreset("standard"), 2, deterministicRandom);

    expect(board.roundId).toBe("minesweeper-safe:round:2");
    expect(board.size).toBe(5);
    expect(board.cells).toHaveLength(25);
    expect(board.cells.filter((cell) => cell.mine)).toHaveLength(5);
    expect(board.initialRevealed).toHaveLength(4);
    expect(board.initialRevealed.every((index) => !board.cells[index].mine)).toBe(true);
  });

  it("changes board density by preset", () => {
    const gentle = generateMinesweeperSafeBoard(settingsFromPreset("gentle"), 1, deterministicRandom);
    const challenge = generateMinesweeperSafeBoard(settingsFromPreset("challenge"), 1, deterministicRandom);

    expect(gentle.size).toBe(4);
    expect(gentle.mineCount).toBe(3);
    expect(challenge.size).toBe(5);
    expect(challenge.mineCount).toBe(7);
  });

  it("stores correct adjacent mine counts", () => {
    const board = generateMinesweeperSafeBoard(settingsFromPreset("standard"), 5, deterministicRandom);
    const mines = new Set(board.cells.filter((cell) => cell.mine).map((cell) => cell.index));

    for (const cell of board.cells) {
      expect(cell.adjacentMines).toBe(adjacentIndexes(cell.index, board.size).filter((index) => mines.has(index)).length);
    }
  });

  it("suggests a hidden safe cell", () => {
    const board = generateMinesweeperSafeBoard(settingsFromPreset("standard"), 7, deterministicRandom);
    const states = createInitialCellStates(board);
    const suggestion = findSuggestedSafeIndex(board.cells, states);

    expect(suggestion).toBeTypeOf("number");
    expect(board.cells[suggestion ?? -1].mine).toBe(false);
    expect(states[suggestion ?? -1]).toBe("hidden");
  });

  it("treats selecting a mine as a losing choice", () => {
    const board = generateMinesweeperSafeBoard(settingsFromPreset("standard"), 7, deterministicRandom);
    const states = createInitialCellStates(board);
    const mine = board.cells.find((cell) => cell.mine);
    const safe = board.cells.find((cell) => !cell.mine && states[cell.index] === "hidden");

    expect(mine).toBeDefined();
    expect(safe).toBeDefined();
    expect(minesweeperSafeChoiceOutcome(mine!, states[mine!.index])).toBe("mine");
    expect(minesweeperSafeChoiceOutcome(safe!, states[safe!.index])).toBe("safe");
    expect(minesweeperSafeChoiceOutcome(board.cells[board.initialRevealed[0]], "revealed")).toBe("ignored");
  });

  it("detects victory when all mines are flagged and no safe cell is flagged", () => {
    const board = generateMinesweeperSafeBoard(settingsFromPreset("standard"), 7, deterministicRandom);
    const states = createInitialCellStates(board);
    const mines = board.cells.filter((cell) => cell.mine);
    const safe = board.cells.find((cell) => !cell.mine && states[cell.index] === "hidden");

    for (const mine of mines) states[mine.index] = "flagged";
    expect(areAllMinesFlagged(board.cells, states)).toBe(true);

    if (safe) states[safe.index] = "flagged";
    expect(areAllMinesFlagged(board.cells, states)).toBe(false);
  });

  it("uses injected randomness for mine placement", () => {
    const settings = settingsFromPreset("standard");
    const first = generateMinesweeperSafeBoard(settings, 1, () => 0.1);
    const second = generateMinesweeperSafeBoard(settings, 1, () => 0.9);

    expect(first.cells.filter((cell) => cell.mine).map((cell) => cell.index)).not.toEqual(second.cells.filter((cell) => cell.mine).map((cell) => cell.index));
  });
});
