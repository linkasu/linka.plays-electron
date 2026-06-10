export const battleshipLightSize = 5;

export type BattleshipLightCell = {
  index: number;
  row: number;
  column: number;
  hasShip: boolean;
  shipId?: string;
};

export type BattleshipLightShot = "hit" | "water";

export type BattleshipLightShots = Partial<Record<number, BattleshipLightShot>>;

export type BattleshipLightShotResult = {
  result: BattleshipLightShot;
  shots: BattleshipLightShots;
  shotCount: number;
  hitCount: number;
  waterCount: number;
  allShipsFound: boolean;
};

const shipCells = new Map<number, string>([
  [cellIndex(0, 1), "north-boat"],
  [cellIndex(0, 2), "north-boat"],
  [cellIndex(0, 3), "north-boat"],
  [cellIndex(1, 4), "east-cutter"],
  [cellIndex(2, 0), "west-boat"],
  [cellIndex(3, 0), "west-boat"],
  [cellIndex(3, 3), "south-boat"],
  [cellIndex(4, 3), "south-boat"]
]);

const coordinateColumns = ["А", "Б", "В", "Г", "Д"];

export function cellIndex(row: number, column: number) {
  return row * battleshipLightSize + column;
}

export function createBattleshipLightBoard(): BattleshipLightCell[] {
  return Array.from({ length: battleshipLightSize * battleshipLightSize }, (_, index) => {
    const row = Math.floor(index / battleshipLightSize);
    const column = index % battleshipLightSize;
    const shipId = shipCells.get(index);

    return {
      index,
      row,
      column,
      hasShip: Boolean(shipId),
      shipId
    };
  });
}

export function coordinateLabel(index: number) {
  const row = Math.floor(index / battleshipLightSize);
  const column = index % battleshipLightSize;
  return `${coordinateColumns[column]}${row + 1}`;
}

export function totalShipCells(board: BattleshipLightCell[]) {
  return board.filter((cell) => cell.hasShip).length;
}

export function countShots(shots: BattleshipLightShots, result?: BattleshipLightShot) {
  return Object.values(shots).filter((shot) => !result || shot === result).length;
}

export function applyBattleshipLightShot(board: BattleshipLightCell[], shots: BattleshipLightShots, index: number): BattleshipLightShotResult {
  const cell = board[index];
  if (!cell) throw new RangeError(`Unknown battleship cell: ${index}`);
  if (shots[index]) {
    return buildShotResult(board, shots, shots[index]);
  }

  const result: BattleshipLightShot = cell.hasShip ? "hit" : "water";
  return buildShotResult(board, { ...shots, [index]: result }, result);
}

function buildShotResult(board: BattleshipLightCell[], shots: BattleshipLightShots, result: BattleshipLightShot): BattleshipLightShotResult {
  const hitCount = countShots(shots, "hit");
  const waterCount = countShots(shots, "water");

  return {
    result,
    shots,
    shotCount: hitCount + waterCount,
    hitCount,
    waterCount,
    allShipsFound: hitCount >= totalShipCells(board)
  };
}
