import { describe, expect, it } from "vitest";
import { allShipsSunk, autoPlaceFleet, battleshipCellCount, battleshipShips, battleshipSize, canPlaceShip, cellIndex, chooseAiShot, coordinateLabel, countShots, fireAt, getSectorCells, isShipSunk, placeShip, shipCells, type BattleshipShots } from "./model";

describe("battleship-light model", () => {
  it("uses a full 10 by 10 board with classic fleet", () => {
    expect(battleshipSize).toBe(10);
    expect(battleshipCellCount).toBe(100);
    expect(battleshipShips.map((ship) => ship.length)).toEqual([4, 3, 3, 2, 2, 2, 1, 1, 1, 1]);
    expect(coordinateLabel(cellIndex(0, 0))).toBe("А1");
    expect(coordinateLabel(cellIndex(9, 9))).toBe("К10");
  });

  it("splits the board into gaze-friendly sectors", () => {
    expect(getSectorCells("nw")).toHaveLength(25);
    expect(getSectorCells("nw")[0]).toBe(cellIndex(0, 0));
    expect(getSectorCells("se")[24]).toBe(cellIndex(9, 9));
  });

  it("places ships only inside the board", () => {
    const ship = battleshipShips[0];

    expect(shipCells(cellIndex(0, 0), ship.length, "horizontal")).toEqual([0, 1, 2, 3]);
    expect(canPlaceShip([], ship, cellIndex(0, 7), "horizontal")).toBe(false);
    expect(canPlaceShip([], ship, cellIndex(7, 0), "vertical")).toBe(false);
  });

  it("forbids ships touching sides or corners", () => {
    const first = placeShip([], battleshipShips[0], cellIndex(0, 0), "horizontal")!;

    expect(canPlaceShip(first, battleshipShips[1], cellIndex(1, 4), "vertical")).toBe(false);
    expect(canPlaceShip(first, battleshipShips[1], cellIndex(2, 0), "horizontal")).toBe(true);
  });

  it("auto-places a deterministic valid fleet", () => {
    const first = autoPlaceFleet(123);
    const second = autoPlaceFleet(123);

    expect(first.fleet).toEqual(second.fleet);
    expect(first.fleet).toHaveLength(battleshipShips.length);
    expect(first.fleet.flatMap((ship) => ship.cells)).toHaveLength(20);
  });

  it("records miss, hit and sunk shots", () => {
    const fleet = placeShip([], battleshipShips[6], cellIndex(4, 4), "horizontal")!;
    const miss = fireAt(fleet, {}, cellIndex(0, 0), "player");
    const sunk = fireAt(fleet, miss.shots, cellIndex(4, 4), "player");

    expect(miss).toMatchObject({ ok: true, result: "miss" });
    expect(sunk).toMatchObject({ ok: true, result: "sunk", winner: undefined });
    expect(sunk.shots[cellIndex(4, 4)]).toBe("sunk");
    expect(countShots(sunk.shots, "miss")).toBe(1);
  });

  it("detects full victory when all ships are sunk", () => {
    const { fleet } = autoPlaceFleet(321);
    const shots = fleet.flatMap((ship) => ship.cells).reduce((nextShots, index) => fireAt(fleet, nextShots, index, "player").shots, {} as BattleshipShots);

    expect(allShipsSunk(fleet, shots)).toBe(true);
    expect(fleet.every((ship) => isShipSunk(ship, shots))).toBe(true);
  });

  it("AI targets neighbours after an unsunk hit", () => {
    const fleet = placeShip([], battleshipShips[3], cellIndex(5, 5), "horizontal")!;
    const shots = fireAt(fleet, {}, cellIndex(5, 5), "ai").shots;
    const choice = chooseAiShot(fleet, shots, 9);

    expect(choice.mode).toBe("target");
    expect([cellIndex(4, 5), cellIndex(6, 5), cellIndex(5, 4), cellIndex(5, 6)]).toContain(choice.index);
  });
});
