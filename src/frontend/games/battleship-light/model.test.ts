import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import {
  allShipsSunk,
  battleshipLayouts,
  createBattleshipBoard,
  neighbourCells,
  placeBattleshipFleet,
  shootBattleship,
} from "./model";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("battleship", () => {
  it("uses small fields with few ships", () => {
    expect(battleshipLayouts.standard).toEqual({ size: 5, ships: [3, 2, 1] });
    expect(battleshipLayouts.gentle.size).toBe(4);
    expect(battleshipLayouts.challenge.size).toBe(6);
  });

  it("places ships inside the field without touching, even by a corner", () => {
    for (const layout of Object.values(battleshipLayouts)) {
      for (let seed = 1; seed <= 60; seed += 1) {
        const ships = placeBattleshipFleet(layout, seededRandom(seed));
        expect(ships.map((ship) => ship.length)).toEqual(layout.ships);
        for (const ship of ships) {
          expect(ship.cells.every((cell) => cell >= 0 && cell < layout.size ** 2)).toBe(true);
          const around = neighbourCells(layout.size, ship.cells);
          for (const other of ships) {
            if (other === ship) continue;
            expect(other.cells.some((cell) => around.has(cell) || ship.cells.includes(cell))).toBe(
              false,
            );
          }
        }
      }
    }
  });

  it("reports miss, hit and sunk; a sunk ship clears the squares around it", () => {
    const board = createBattleshipBoard(battleshipLayouts.standard, seededRandom(7));
    const big = board.ships.find((ship) => ship.length === 3)!;
    const empty = Array.from({ length: 25 }, (_, i) => i).find(
      (i) => !board.ships.some((ship) => ship.cells.includes(i)),
    )!;
    expect(shootBattleship(board, empty)?.result).toBe("miss");
    expect(shootBattleship(board, empty)).toBeUndefined();
    expect(shootBattleship(board, big.cells[0])?.result).toBe("hit");
    expect(shootBattleship(board, big.cells[1])?.result).toBe("hit");
    expect(shootBattleship(board, big.cells[2])?.result).toBe("sunk");
    for (const cell of neighbourCells(5, big.cells)) {
      expect(board.cleared.has(cell) || board.shots.has(cell)).toBe(true);
    }
  });

  it("ends when every ship is sunk", () => {
    const board = createBattleshipBoard(battleshipLayouts.gentle, seededRandom(9));
    for (const ship of board.ships) for (const cell of ship.cells) shootBattleship(board, cell);
    expect(allShipsSunk(board)).toBe(true);
  });

  it("has a recording for every phrase", () => {
    const ids = new Set(ttsAssets.map((asset) => asset.id));
    for (const id of ["prompt", "miss", "hit", "sunk", "complete"]) {
      expect(ids.has(`battleship-light.${id}`)).toBe(true);
    }
  });
});
