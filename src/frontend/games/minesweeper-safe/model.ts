import type { SessionSettings } from "../../core/settings";

export type MinesweeperSafeCell = {
  index: number;
  row: number;
  col: number;
  mine: boolean;
  adjacentMines: number;
};

export type MinesweeperSafeCellState = "hidden" | "revealed" | "flagged";
export type MinesweeperSafeChoiceOutcome = "safe" | "mine" | "ignored";

export type MinesweeperSafeBoard = {
  roundId: string;
  size: number;
  mineCount: number;
  cells: MinesweeperSafeCell[];
  initialRevealed: number[];
};

export type BoardShape = {
  size: number;
  mines: number;
  initialClues: number;
};

const boardShapes: Record<Exclude<SessionSettings["preset"], "custom">, BoardShape> = {
  gentle: { size: 4, mines: 3, initialClues: 3 },
  standard: { size: 5, mines: 5, initialClues: 4 },
  challenge: { size: 5, mines: 7, initialClues: 4 }
};

export function boardShapeFor(settings: SessionSettings): BoardShape {
  if (settings.preset === "gentle" || settings.preset === "challenge") return boardShapes[settings.preset];
  return boardShapes.standard;
}

export function adjacentIndexes(index: number, size: number) {
  const row = Math.floor(index / size);
  const col = index % size;
  const indexes: number[] = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nextRow = row + dy;
      const nextCol = col + dx;
      if (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size) indexes.push(nextRow * size + nextCol);
    }
  }

  return indexes;
}

export function createInitialCellStates(board: MinesweeperSafeBoard): MinesweeperSafeCellState[] {
  return board.cells.map((cell) => board.initialRevealed.includes(cell.index) ? "revealed" : "hidden");
}

export function findSuggestedSafeIndex(cells: MinesweeperSafeCell[], states: MinesweeperSafeCellState[]) {
  const revealed = new Set(cells.filter((cell) => states[cell.index] === "revealed").map((cell) => cell.index));
  const hiddenSafe = cells.filter((cell) => !cell.mine && states[cell.index] === "hidden");

  return hiddenSafe
    .map((cell) => ({
      cell,
      revealedNeighbors: adjacentIndexes(cell.index, Math.trunc(Math.sqrt(cells.length))).filter((index) => revealed.has(index)).length
    }))
    .sort((a, b) => b.revealedNeighbors - a.revealedNeighbors || a.cell.adjacentMines - b.cell.adjacentMines || a.cell.index - b.cell.index)[0]?.cell.index;
}

export function minesweeperSafeChoiceOutcome(cell: MinesweeperSafeCell, state: MinesweeperSafeCellState): MinesweeperSafeChoiceOutcome {
  if (state !== "hidden") return "ignored";
  return cell.mine ? "mine" : "safe";
}

export function generateMinesweeperSafeBoard(settings: SessionSettings, roundIndex = 1): MinesweeperSafeBoard {
  const shape = boardShapeFor(settings);
  const totalCells = shape.size * shape.size;
  const center = Math.floor(totalCells / 2);
  const reserved = new Set([center, center - 1, center + 1, center - shape.size, center + shape.size].filter((index) => index >= 0 && index < totalCells));
  const mineIndexes = new Set(shuffleIndexes(totalCells, roundIndex, shape.size).filter((index) => !reserved.has(index)).slice(0, shape.mines));
  const cells = Array.from({ length: totalCells }, (_, index) => {
    const row = Math.floor(index / shape.size);
    const col = index % shape.size;
    const mine = mineIndexes.has(index);
    const adjacentMines = adjacentIndexes(index, shape.size).filter((neighbor) => mineIndexes.has(neighbor)).length;

    return { index, row, col, mine, adjacentMines };
  });
  const initialRevealed = cells
    .filter((cell) => !cell.mine)
    .sort((a, b) => {
      const centerDistanceA = Math.abs(a.row - Math.floor(shape.size / 2)) + Math.abs(a.col - Math.floor(shape.size / 2));
      const centerDistanceB = Math.abs(b.row - Math.floor(shape.size / 2)) + Math.abs(b.col - Math.floor(shape.size / 2));
      return b.adjacentMines - a.adjacentMines || centerDistanceA - centerDistanceB || a.index - b.index;
    })
    .slice(0, shape.initialClues)
    .map((cell) => cell.index)
    .sort((a, b) => a - b);

  return {
    roundId: `minesweeper-safe:round:${roundIndex}`,
    size: shape.size,
    mineCount: shape.mines,
    cells,
    initialRevealed
  };
}

function shuffleIndexes(totalCells: number, roundIndex: number, size: number) {
  const indexes = Array.from({ length: totalCells }, (_, index) => index);
  let seed = 5821 + roundIndex * 7919 + size * 131;

  function random() {
    seed = seed * 1664525 + 1013904223 >>> 0;
    return seed / 0x100000000;
  }

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  return indexes;
}
