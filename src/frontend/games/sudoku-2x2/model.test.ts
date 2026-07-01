import { describe, expect, it } from "vitest";
import { generateSudoku2x2Round, type Sudoku2x2Cell } from "./model";

function expectedValues(size: number) {
  return Array.from({ length: size }, (_, index) => index + 1);
}

function valuesAt(cells: Sudoku2x2Cell[], size: number, selector: (cell: Sudoku2x2Cell) => boolean) {
  return cells.filter(selector).map((cell) => cell.value).sort((a, b) => a - b);
}

describe("generateSudoku2x2Round", () => {
  it("progresses from 2x2 to 5x5 during the default eight-step session", () => {
    const sizes = Array.from({ length: 8 }, (_, index) => generateSudoku2x2Round(index + 1).size);

    expect(sizes).toEqual([2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it("creates exactly one hidden cell on every board size", () => {
    for (let index = 1; index <= 8; index += 1) {
      const round = generateSudoku2x2Round(index);

      expect(round.roundId).toBe(`sudoku-2x2:round:${index}`);
      expect(round.board).toHaveLength(round.size * round.size);
      expect(round.board.filter((cell) => cell.hidden)).toEqual([round.missingCell]);
    }
  });

  it("keeps every completed row and column as 1..N", () => {
    for (let index = 1; index <= 8; index += 1) {
      const round = generateSudoku2x2Round(index);
      const expected = expectedValues(round.size);

      for (let row = 0; row < round.size; row += 1) {
        expect(valuesAt(round.board, round.size, (cell) => cell.row === row)).toEqual(expected);
      }

      for (let col = 0; col < round.size; col += 1) {
        expect(valuesAt(round.board, round.size, (cell) => cell.col === col)).toEqual(expected);
      }
    }
  });

  it("offers one choice per value in the current board size", () => {
    for (let index = 1; index <= 8; index += 1) {
      const round = generateSudoku2x2Round(index);

      expect(round.choices).toHaveLength(round.size);
      expect(round.choices.map((choice) => choice.value).sort((a, b) => a - b)).toEqual(expectedValues(round.size));
      expect(round.choices).toContain(round.correctChoice);
      expect(round.correctChoice.value).toBe(round.missingCell.value);
      expect(round.choices[round.correctIndex]).toBe(round.correctChoice);
    }
  });
});
