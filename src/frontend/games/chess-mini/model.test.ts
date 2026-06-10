import { describe, expect, it } from "vitest";
import { cellIndex, chessMiniCellCount, createChessMiniTasks, isLegalMove, legalMoves, squareLabel } from "./model";

describe("chess-mini model", () => {
  it("creates eight 4x4 mini tasks with legal targets", () => {
    const tasks = createChessMiniTasks();

    expect(tasks).toHaveLength(8);
    for (const task of tasks) {
      const moves = legalMoves(task);
      expect(task.from).toBeGreaterThanOrEqual(0);
      expect(task.from).toBeLessThan(chessMiniCellCount);
      expect(moves.length).toBeGreaterThan(0);
      expect(moves).not.toContain(task.from);
      expect(moves.some((move) => task.blockers.includes(move))).toBe(false);
    }
  });

  it("keeps rook moves on clear ranks and files only", () => {
    const rookTask = createChessMiniTasks()[0];

    expect(legalMoves(rookTask).sort((a, b) => a - b)).toEqual([
      cellIndex(0, 1),
      cellIndex(1, 0),
      cellIndex(1, 2),
      cellIndex(2, 1)
    ]);
    expect(isLegalMove(rookTask, cellIndex(1, 3))).toBe(false);
    expect(isLegalMove(rookTask, cellIndex(0, 0))).toBe(false);
  });

  it("lets bishops move diagonally until a blocker", () => {
    const bishopTask = createChessMiniTasks()[1];

    expect(legalMoves(bishopTask).sort((a, b) => a - b)).toEqual([cellIndex(1, 1), cellIndex(1, 3)]);
    expect(isLegalMove(bishopTask, cellIndex(2, 0))).toBe(false);
    expect(isLegalMove(bishopTask, cellIndex(0, 3))).toBe(false);
  });

  it("lets knights jump in an L shape but not land on blockers", () => {
    const knightTask = createChessMiniTasks()[2];

    expect(legalMoves(knightTask)).toEqual([cellIndex(2, 1)]);
    expect(isLegalMove(knightTask, cellIndex(1, 2))).toBe(false);
    expect(isLegalMove(knightTask, cellIndex(2, 2))).toBe(false);
  });

  it("formats board labels from A4 to D1", () => {
    expect(squareLabel(cellIndex(0, 0))).toBe("A4");
    expect(squareLabel(cellIndex(3, 3))).toBe("D1");
  });
});
