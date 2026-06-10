import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateGridScanningRound, gridDimensionForRound } from "./model";

describe("grid-scanning model", () => {
  it("progresses standard rounds from 2x2 to 4x4", () => {
    const settings = settingsFromPreset("standard");

    expect(gridDimensionForRound(settings, 1)).toBe(2);
    expect(gridDimensionForRound(settings, 4)).toBe(3);
    expect(gridDimensionForRound(settings, 7)).toBe(4);
  });

  it("keeps generated grids between 2x2 and 4x4", () => {
    for (const preset of ["gentle", "standard", "challenge"] as const) {
      const settings = settingsFromPreset(preset);

      for (let roundIndex = 1; roundIndex <= 12; roundIndex += 1) {
        const dimension = gridDimensionForRound(settings, roundIndex);
        expect(dimension).toBeGreaterThanOrEqual(2);
        expect(dimension).toBeLessThanOrEqual(4);
      }
    }
  });

  it("creates a square grid with one target cell", () => {
    const round = generateGridScanningRound(settingsFromPreset("standard"), 7);
    const targetCells = round.cells.filter((cell) => cell.isTarget);

    expect(round.roundId).toBe("grid-scanning:round:7");
    expect(round.dimension).toBe(4);
    expect(round.cells).toHaveLength(16);
    expect(targetCells).toHaveLength(1);
    expect(round.cells[round.correctIndex]).toBe(targetCells[0]);
    expect(round.cells[round.correctIndex].item).toBe(round.target);
    expect(round.prompt).toBe(`Найди ${round.target.label}`);
  });

  it("uses unique symbols in each round", () => {
    const round = generateGridScanningRound(settingsFromPreset("challenge"), 5);
    const symbolIds = new Set(round.cells.map((cell) => cell.item.id));

    expect(round.cells).toHaveLength(16);
    expect(symbolIds.size).toBe(round.cells.length);
  });
});
