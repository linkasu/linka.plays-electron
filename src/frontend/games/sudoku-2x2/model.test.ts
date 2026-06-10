import { describe, expect, it } from "vitest";
import { generateSudoku2x2Round, type Sudoku2x2Cell, type Sudoku2x2Value } from "./model";

function filledValues(board: Sudoku2x2Cell[]) {
  return board.map((cell) => cell.value);
}

function expectPair(values: Sudoku2x2Value[]) {
  expect([...values].sort()).toEqual([1, 2]);
}

describe("generateSudoku2x2Round", () => {
  it("creates a 2x2 board with exactly one hidden cell", () => {
    const round = generateSudoku2x2Round(1);

    expect(round.roundId).toBe("sudoku-2x2:round:1");
    expect(round.board).toHaveLength(4);
    expect(round.board.filter((cell) => cell.hidden)).toEqual([round.missingCell]);
  });

  it("keeps every completed row and column as 1 and 2", () => {
    for (let index = 1; index <= 8; index += 1) {
      const values = filledValues(generateSudoku2x2Round(index).board);

      expectPair([values[0], values[1]]);
      expectPair([values[2], values[3]]);
      expectPair([values[0], values[2]]);
      expectPair([values[1], values[3]]);
    }
  });

  it("offers the correct missing card and points correctIndex to it", () => {
    const round = generateSudoku2x2Round(4);

    expect(round.choices).toHaveLength(2);
    expect(round.choices).toContain(round.correctChoice);
    expect(round.correctChoice.value).toBe(round.missingCell.value);
    expect(round.choices[round.correctIndex]).toBe(round.correctChoice);
  });

  it("cycles hidden cells during the default eight-step session", () => {
    const hiddenIds = Array.from({ length: 8 }, (_, index) => generateSudoku2x2Round(index + 1).missingCell.id);

    expect(new Set(hiddenIds)).toEqual(new Set(["cell-0", "cell-1", "cell-2", "cell-3"]));
  });
});
