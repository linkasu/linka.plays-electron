import { describe, expect, it } from "vitest";
import { applyBattleshipLightShot, battleshipLightOutcome, battleshipLightSize, cellIndex, coordinateLabel, countShots, createBattleshipLightBoard, totalShipCells, type BattleshipLightShots } from "./model";

describe("battleship light model", () => {
  it("creates a fixed large 5 by 5 board", () => {
    const board = createBattleshipLightBoard();

    expect(board).toHaveLength(25);
    expect(battleshipLightSize).toBe(5);
    expect(totalShipCells(board)).toBe(8);
    expect(board[cellIndex(0, 1)]).toMatchObject({ row: 0, column: 1, hasShip: true, shipId: "north-boat" });
    expect(board[cellIndex(4, 4)]).toMatchObject({ row: 4, column: 4, hasShip: false });
  });

  it("labels cells with calm sea coordinates", () => {
    expect(coordinateLabel(cellIndex(0, 0))).toBe("А1");
    expect(coordinateLabel(cellIndex(4, 4))).toBe("Д5");
  });

  it("records a hit without mutating previous shots", () => {
    const board = createBattleshipLightBoard();
    const shots: BattleshipLightShots = {};
    const result = applyBattleshipLightShot(board, shots, cellIndex(0, 2));

    expect(result.result).toBe("hit");
    expect(result.hitCount).toBe(1);
    expect(result.waterCount).toBe(0);
    expect(result.shotCount).toBe(1);
    expect(shots).toEqual({});
  });

  it("records water as a gentle miss", () => {
    const board = createBattleshipLightBoard();
    const result = applyBattleshipLightShot(board, {}, cellIndex(2, 2));

    expect(result.result).toBe("water");
    expect(result.hitCount).toBe(0);
    expect(result.waterCount).toBe(1);
    expect(countShots(result.shots, "water")).toBe(1);
  });

  it("detects when all ship cells are found", () => {
    const board = createBattleshipLightBoard();
    const shipIndexes = board.filter((cell) => cell.hasShip).map((cell) => cell.index);
    const final = shipIndexes.reduce((shots, index) => applyBattleshipLightShot(board, shots, index).shots, {} as BattleshipLightShots);

    expect(countShots(final, "hit")).toBe(totalShipCells(board));
    expect(applyBattleshipLightShot(board, final, shipIndexes[0]).allShipsFound).toBe(true);
  });

  it("reports win or loss by shot budget", () => {
    const board = createBattleshipLightBoard();
    const shipIndexes = board.filter((cell) => cell.hasShip).map((cell) => cell.index);
    const waterIndexes = board.filter((cell) => !cell.hasShip).map((cell) => cell.index);
    const winningShots = shipIndexes.reduce((shots, index) => applyBattleshipLightShot(board, shots, index).shots, {} as BattleshipLightShots);
    const losingResult = waterIndexes.slice(0, 10).reduce(
      (_, index, shotIndex) => applyBattleshipLightShot(board, waterIndexes.slice(0, shotIndex).reduce((shots, previousIndex) => applyBattleshipLightShot(board, shots, previousIndex).shots, {} as BattleshipLightShots), index),
      applyBattleshipLightShot(board, {}, waterIndexes[0])
    );

    expect(battleshipLightOutcome(applyBattleshipLightShot(board, winningShots, shipIndexes[0]), 10)).toBe("win");
    expect(battleshipLightOutcome(losingResult, 10)).toBe("loss");
  });

  it("throws for an invalid cell index", () => {
    const board = createBattleshipLightBoard();

    expect(() => applyBattleshipLightShot(board, {}, 99)).toThrow(RangeError);
  });
});
