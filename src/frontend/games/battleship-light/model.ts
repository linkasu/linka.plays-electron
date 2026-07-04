export const battleshipSize = 10;
export const battleshipCellCount = battleshipSize * battleshipSize;

export type BattleshipPhase = "setup" | "player-turn" | "ai-turn" | "finished";
export type BattleshipOrientation = "horizontal" | "vertical";
export type BattleshipShot = "hit" | "miss" | "sunk";
export type BattleshipShots = Partial<Record<number, BattleshipShot>>;
export type BattleshipWinner = "player" | "ai";
export type BattleshipSectorId = "nw" | "ne" | "sw" | "se";

export type BattleshipShipDefinition = {
  id: string;
  name: string;
  length: number;
};

export type BattleshipShip = BattleshipShipDefinition & {
  cells: number[];
};

export type BattleshipFireResult = {
  ok: boolean;
  result?: BattleshipShot;
  shots: BattleshipShots;
  shipId?: string;
  winner?: BattleshipWinner;
};

export type BattleshipAiChoice = {
  index: number;
  nextSeed: number;
  mode: "target" | "hunt";
};

export const battleshipShips: BattleshipShipDefinition[] = [
  { id: "ship-4", name: "Линкор", length: 4 },
  { id: "ship-3-a", name: "Крейсер", length: 3 },
  { id: "ship-3-b", name: "Крейсер", length: 3 },
  { id: "ship-2-a", name: "Эсминец", length: 2 },
  { id: "ship-2-b", name: "Эсминец", length: 2 },
  { id: "ship-2-c", name: "Эсминец", length: 2 },
  { id: "ship-1-a", name: "Катер", length: 1 },
  { id: "ship-1-b", name: "Катер", length: 1 },
  { id: "ship-1-c", name: "Катер", length: 1 },
  { id: "ship-1-d", name: "Катер", length: 1 }
];

export const battleshipSectors: { id: BattleshipSectorId; label: string; rowStart: number; columnStart: number }[] = [
  { id: "nw", label: "Левый верх", rowStart: 0, columnStart: 0 },
  { id: "ne", label: "Правый верх", rowStart: 0, columnStart: 5 },
  { id: "sw", label: "Левый низ", rowStart: 5, columnStart: 0 },
  { id: "se", label: "Правый низ", rowStart: 5, columnStart: 5 }
];

const coordinateColumns = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К"];

export function cellIndex(row: number, column: number) {
  return row * battleshipSize + column;
}

export function cellPosition(index: number) {
  return {
    row: Math.floor(index / battleshipSize),
    column: index % battleshipSize
  };
}

export function isInside(row: number, column: number) {
  return row >= 0 && row < battleshipSize && column >= 0 && column < battleshipSize;
}

export function coordinateLabel(index: number) {
  const { row, column } = cellPosition(index);
  return `${coordinateColumns[column]}${row + 1}`;
}

export function getSectorCells(sectorId: BattleshipSectorId) {
  const sector = battleshipSectors.find((candidate) => candidate.id === sectorId) ?? battleshipSectors[0];
  const cells: number[] = [];
  for (let row = sector.rowStart; row < sector.rowStart + 5; row += 1) {
    for (let column = sector.columnStart; column < sector.columnStart + 5; column += 1) {
      cells.push(cellIndex(row, column));
    }
  }
  return cells;
}

export function shipCells(anchorIndex: number, length: number, orientation: BattleshipOrientation) {
  const { row, column } = cellPosition(anchorIndex);
  return Array.from({ length }, (_, offset) => {
    const nextRow = orientation === "vertical" ? row + offset : row;
    const nextColumn = orientation === "horizontal" ? column + offset : column;
    return isInside(nextRow, nextColumn) ? cellIndex(nextRow, nextColumn) : -1;
  });
}

export function occupiedCells(fleet: BattleshipShip[]) {
  return new Set(fleet.flatMap((ship) => ship.cells));
}

export function canPlaceShip(fleet: BattleshipShip[], ship: BattleshipShipDefinition, anchorIndex: number, orientation: BattleshipOrientation) {
  const cells = shipCells(anchorIndex, ship.length, orientation);
  if (cells.some((index) => index < 0)) return false;

  const occupied = occupiedCells(fleet);
  for (const index of cells) {
    const { row, column } = cellPosition(index);
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (!isInside(nextRow, nextColumn)) continue;
        if (occupied.has(cellIndex(nextRow, nextColumn))) return false;
      }
    }
  }

  return true;
}

export function placeShip(fleet: BattleshipShip[], ship: BattleshipShipDefinition, anchorIndex: number, orientation: BattleshipOrientation) {
  if (!canPlaceShip(fleet, ship, anchorIndex, orientation)) return undefined;
  return [...fleet, { ...ship, cells: shipCells(anchorIndex, ship.length, orientation) }];
}

export function findShipAt(fleet: BattleshipShip[], index: number) {
  return fleet.find((ship) => ship.cells.includes(index));
}

export function isShipSunk(ship: BattleshipShip, shots: BattleshipShots) {
  return ship.cells.every((index) => shots[index] === "hit" || shots[index] === "sunk");
}

export function allShipsSunk(fleet: BattleshipShip[], shots: BattleshipShots) {
  return fleet.length === battleshipShips.length && fleet.every((ship) => isShipSunk(ship, shots));
}

export function fireAt(fleet: BattleshipShip[], shots: BattleshipShots, index: number, shooter: BattleshipWinner): BattleshipFireResult {
  if (index < 0 || index >= battleshipCellCount || shots[index]) return { ok: false, shots };

  const ship = findShipAt(fleet, index);
  if (!ship) return { ok: true, result: "miss", shots: { ...shots, [index]: "miss" } };

  const nextShots: BattleshipShots = { ...shots, [index]: "hit" };
  const sunk = isShipSunk(ship, nextShots);
  if (sunk) {
    for (const cell of ship.cells) nextShots[cell] = "sunk";
  }

  return {
    ok: true,
    result: sunk ? "sunk" : "hit",
    shots: nextShots,
    shipId: ship.id,
    winner: allShipsSunk(fleet, nextShots) ? shooter : undefined
  };
}

export function countShots(shots: BattleshipShots, result?: BattleshipShot) {
  return Object.values(shots).filter((shot) => !result || shot === result).length;
}

export function nextSeed(seed: number) {
  return (seed * 1664525 + 1013904223) >>> 0;
}

export function randomInt(seed: number, max: number) {
  const next = nextSeed(seed);
  return { value: next % max, seed: next };
}

export function autoPlaceFleet(seed = 42) {
  let fleet: BattleshipShip[] = [];
  let currentSeed = seed;

  for (const ship of battleshipShips) {
    let placed = false;
    for (let attempt = 0; attempt < 1000 && !placed; attempt += 1) {
      const rowRoll = randomInt(currentSeed, battleshipSize);
      currentSeed = rowRoll.seed;
      const columnRoll = randomInt(currentSeed, battleshipSize);
      currentSeed = columnRoll.seed;
      const orientationRoll = randomInt(currentSeed, 2);
      currentSeed = orientationRoll.seed;
      const anchorIndex = cellIndex(rowRoll.value, columnRoll.value);
      const orientation: BattleshipOrientation = orientationRoll.value === 0 ? "horizontal" : "vertical";
      const nextFleet = placeShip(fleet, ship, anchorIndex, orientation);
      if (nextFleet) {
        fleet = nextFleet;
        placed = true;
      }
    }
    if (!placed) throw new Error(`Cannot place ship ${ship.id}`);
  }

  return { fleet, seed: currentSeed };
}

export function chooseAiShot(fleet: BattleshipShip[], shots: BattleshipShots, seed = 7): BattleshipAiChoice {
  const openCells = Array.from({ length: battleshipCellCount }, (_, index) => index).filter((index) => !shots[index]);
  const targetCells = Object.entries(shots)
    .filter(([, shot]) => shot === "hit")
    .flatMap(([index]) => neighborCells(Number(index)))
    .filter((index) => !shots[index]);
  const uniqueTargets = Array.from(new Set(targetCells));
  const candidates = uniqueTargets.length > 0 ? uniqueTargets : openCells;
  const roll = randomInt(seed, candidates.length);

  return {
    index: candidates[roll.value],
    nextSeed: roll.seed,
    mode: uniqueTargets.length > 0 ? "target" : "hunt"
  };
}

export function neighborCells(index: number) {
  const { row, column } = cellPosition(index);
  return [
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1]
  ].filter(([nextRow, nextColumn]) => isInside(nextRow, nextColumn)).map(([nextRow, nextColumn]) => cellIndex(nextRow, nextColumn));
}

export function placementProgress(fleet: BattleshipShip[]) {
  return Math.min(fleet.length, battleshipShips.length);
}

export function nextShipToPlace(fleet: BattleshipShip[]) {
  return battleshipShips[placementProgress(fleet)];
}
