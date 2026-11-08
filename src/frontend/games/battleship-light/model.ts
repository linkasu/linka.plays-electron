import type { DifficultyPreset } from "../../core/settings";
import { shuffleItems } from "../../core/random";

// Testers: «убрать, играть в таком виде никак нельзя» (10×10, ten ships, own fleet to place).
// Agreed redesign (2026-11-08): a small field with large squares, the child only looks for
// the computer's ships, three ships on 5×5, a shot is a look at a square, a miss is not a mistake.

export type BattleshipLayout = {
  /** Squares on one side of the field. */
  size: number;
  /** Ship lengths, longest first. */
  ships: number[];
};

export type BattleshipOrientation = "horizontal" | "vertical";

export type BattleshipShip = {
  id: string;
  length: number;
  orientation: BattleshipOrientation;
  /** Square indexes, from the bow-less end (left or top) on. */
  cells: number[];
};

export type BattleshipShotResult = "miss" | "hit" | "sunk";

export type BattleshipBoard = {
  size: number;
  ships: BattleshipShip[];
  /** Shot squares. */
  shots: Set<number>;
  /** Squares around sunk ships: ships never touch, so they are empty for sure. */
  cleared: Set<number>;
};

export const battleshipLayouts: Record<Exclude<DifficultyPreset, "custom">, BattleshipLayout> = {
  gentle: { size: 4, ships: [2, 1] },
  standard: { size: 5, ships: [3, 2, 1] },
  challenge: { size: 6, ships: [3, 2, 2, 1] },
};

export function battleshipLayoutFor(preset: DifficultyPreset): BattleshipLayout {
  return preset === "custom" ? battleshipLayouts.standard : battleshipLayouts[preset];
}

export function cellIndex(size: number, row: number, column: number) {
  return row * size + column;
}

export function cellRowColumn(size: number, index: number) {
  return { row: Math.floor(index / size), column: index % size };
}

/** The squares around a set of squares (diagonals too), inside the field. */
export function neighbourCells(size: number, cells: number[]) {
  const own = new Set(cells);
  const around = new Set<number>();
  for (const index of cells) {
    const { row, column } = cellRowColumn(size, index);
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const r = row + dr;
        const c = column + dc;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        const next = cellIndex(size, r, c);
        if (!own.has(next)) around.add(next);
      }
    }
  }
  return around;
}

function shipCellsAt(
  size: number,
  row: number,
  column: number,
  length: number,
  orientation: BattleshipOrientation,
) {
  const cells: number[] = [];
  for (let offset = 0; offset < length; offset += 1) {
    const r = orientation === "vertical" ? row + offset : row;
    const c = orientation === "horizontal" ? column + offset : column;
    if (r >= size || c >= size) return undefined;
    cells.push(cellIndex(size, r, c));
  }
  return cells;
}

/**
 * Places the ships at random. Ships never touch each other, not even by a corner,
 * as in the real game, so a sunk ship tells which squares around it are empty.
 */
export function placeBattleshipFleet(
  layout: BattleshipLayout,
  random = Math.random,
): BattleshipShip[] {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const ships: BattleshipShip[] = [];
    const blocked = new Set<number>();
    let ok = true;
    for (const [shipIndex, length] of layout.ships.entries()) {
      const options: BattleshipShip[] = [];
      for (const orientation of ["horizontal", "vertical"] as const) {
        if (length === 1 && orientation === "vertical") continue;
        for (let row = 0; row < layout.size; row += 1) {
          for (let column = 0; column < layout.size; column += 1) {
            const cells = shipCellsAt(layout.size, row, column, length, orientation);
            if (cells && cells.every((cell) => !blocked.has(cell))) {
              options.push({ id: `ship-${shipIndex + 1}`, length, orientation, cells });
            }
          }
        }
      }
      if (options.length === 0) {
        ok = false;
        break;
      }
      const ship = shuffleItems(options, random)[0];
      ships.push(ship);
      for (const cell of ship.cells) blocked.add(cell);
      for (const cell of neighbourCells(layout.size, ship.cells)) blocked.add(cell);
    }
    if (ok) return ships;
  }
  throw new Error("Не удалось расставить корабли.");
}

export function createBattleshipBoard(
  layout: BattleshipLayout,
  random = Math.random,
): BattleshipBoard {
  return {
    size: layout.size,
    ships: placeBattleshipFleet(layout, random),
    shots: new Set(),
    cleared: new Set(),
  };
}

export function shipAt(board: BattleshipBoard, index: number) {
  return board.ships.find((ship) => ship.cells.includes(index));
}

export function isShipSunk(board: BattleshipBoard, ship: BattleshipShip) {
  return ship.cells.every((cell) => board.shots.has(cell));
}

export function isCellOpen(board: BattleshipBoard, index: number) {
  return !board.shots.has(index) && !board.cleared.has(index);
}

/** Shoots a square; returns the result, or undefined when the square was already open. */
export function shootBattleship(
  board: BattleshipBoard,
  index: number,
): { result: BattleshipShotResult; ship?: BattleshipShip } | undefined {
  if (!isCellOpen(board, index)) return undefined;
  board.shots.add(index);
  const ship = shipAt(board, index);
  if (!ship) return { result: "miss" };
  if (!isShipSunk(board, ship)) return { result: "hit", ship };
  for (const cell of neighbourCells(board.size, ship.cells)) {
    if (!board.shots.has(cell)) board.cleared.add(cell);
  }
  return { result: "sunk", ship };
}

export function allShipsSunk(board: BattleshipBoard) {
  return board.ships.every((ship) => isShipSunk(board, ship));
}

/** Letters beside the field, as in the Russian game. */
export const battleshipColumnLetters = ["А", "Б", "В", "Г", "Д", "Е"];

// --- Battle with the computer (2026-11-08, user: «добавить игру с компьютером, когда игрок
// сам выставляет свои корабли и ходы осуществляются по очереди»).

/** The squares a ship would take with its first square at `index`, or undefined off the field. */
export function shipCellsFrom(
  size: number,
  index: number,
  length: number,
  orientation: BattleshipOrientation,
) {
  const { row, column } = cellRowColumn(size, index);
  return shipCellsAt(size, row, column, length, orientation);
}

/** Can a ship stand here: inside the field, not on and not next to another ship. */
export function canPlaceShip(size: number, ships: BattleshipShip[], cells: number[] | undefined) {
  if (!cells) return false;
  const taken = new Set<number>();
  for (const ship of ships) {
    for (const cell of ship.cells) taken.add(cell);
    for (const cell of neighbourCells(size, ship.cells)) taken.add(cell);
  }
  return cells.every((cell) => !taken.has(cell));
}

/** A board whose ships the child placed. */
export function createBattleshipBoardFromShips(
  size: number,
  ships: BattleshipShip[],
): BattleshipBoard {
  return { size, ships, shots: new Set(), cleared: new Set() };
}

/**
 * The computer's shot: finish a hit ship along its line first, otherwise a random open square.
 */
export function chooseComputerShot(board: BattleshipBoard, random = Math.random) {
  const open = (index: number) => isCellOpen(board, index);
  const wounded = board.ships.filter(
    (ship) => !isShipSunk(board, ship) && ship.cells.some((cell) => board.shots.has(cell)),
  );
  if (wounded.length > 0) {
    const ship = wounded[0];
    const hits = ship.cells.filter((cell) => board.shots.has(cell));
    const positions = hits.map((cell) => cellRowColumn(board.size, cell));
    const candidates: number[] = [];
    const add = (row: number, column: number) => {
      if (row < 0 || column < 0 || row >= board.size || column >= board.size) return;
      const index = cellIndex(board.size, row, column);
      if (open(index)) candidates.push(index);
    };
    if (hits.length > 1) {
      // The line is known: try both ends.
      const sameRow = positions.every((position) => position.row === positions[0].row);
      if (sameRow) {
        const columns = positions.map((position) => position.column);
        add(positions[0].row, Math.min(...columns) - 1);
        add(positions[0].row, Math.max(...columns) + 1);
      } else {
        const rows = positions.map((position) => position.row);
        add(Math.min(...rows) - 1, positions[0].column);
        add(Math.max(...rows) + 1, positions[0].column);
      }
    } else {
      const { row, column } = positions[0];
      add(row - 1, column);
      add(row + 1, column);
      add(row, column - 1);
      add(row, column + 1);
    }
    if (candidates.length > 0) return shuffleItems(candidates, random)[0];
  }
  const all = Array.from({ length: board.size * board.size }, (_, index) => index).filter(open);
  return shuffleItems(all, random)[0];
}
