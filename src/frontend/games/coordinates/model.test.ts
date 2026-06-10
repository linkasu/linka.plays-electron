import { describe, expect, it } from "vitest";
import { coordinateColumns, coordinateRows, generateCoordinatesRound } from "./model";

describe("coordinates model", () => {
  it("creates a fixed 3x3 grid with A-C columns and 1-3 rows", () => {
    const round = generateCoordinatesRound(1);

    expect(coordinateColumns).toEqual(["A", "B", "C"]);
    expect(coordinateRows).toEqual([1, 2, 3]);
    expect(round.cells).toHaveLength(9);
    expect(round.cells.map((cell) => cell.coordinate)).toEqual(["A1", "B1", "C1", "A2", "B2", "C2", "A3", "B3", "C3"]);
  });

  it("marks exactly one target cell and points correctIndex to it", () => {
    const round = generateCoordinatesRound(2);
    const targetCells = round.cells.filter((cell) => cell.isTarget);

    expect(round.roundId).toBe("coordinates:round:2");
    expect(round.target).toBe("B2");
    expect(round.prompt).toBe("Найди клетку B2");
    expect(targetCells).toHaveLength(1);
    expect(round.cells[round.correctIndex]).toBe(targetCells[0]);
    expect(round.cells[round.correctIndex].coordinate).toBe(round.target);
  });

  it("cycles through all coordinates without leaving the grid", () => {
    const seen = new Set<string>();

    for (let index = 1; index <= 18; index += 1) {
      const round = generateCoordinatesRound(index);
      seen.add(round.target);

      expect(round.correctIndex).toBeGreaterThanOrEqual(0);
      expect(round.correctIndex).toBeLessThan(9);
      expect(round.cells[round.correctIndex].isTarget).toBe(true);
    }

    expect(seen).toEqual(new Set(["A1", "B2", "C3", "A2", "B3", "C1", "A3", "B1", "C2"]));
  });
});
