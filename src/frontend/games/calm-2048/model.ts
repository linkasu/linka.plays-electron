export type Calm2048Direction = "up" | "down" | "left" | "right";
export type Calm2048Board = number[];
export type Calm2048Random = () => number;

export type Calm2048MoveResult = {
  board: Calm2048Board;
  moved: boolean;
  merged: boolean;
  scoreGain: number;
};

export type Calm2048SpawnResult = {
  board: Calm2048Board;
  spawnedIndex?: number;
  value?: number;
};

export type Calm2048Outcome = "playing" | "loss";

export const calm2048BoardSize = 4;
export const calm2048CellCount = calm2048BoardSize * calm2048BoardSize;

export function createEmptyBoard(): Calm2048Board {
  return Array(calm2048CellCount).fill(0);
}

export function createInitialBoard(random: Calm2048Random = Math.random): Calm2048Board {
  return spawnTile(spawnTile(createEmptyBoard(), random).board, random).board;
}

export function emptyCellIndexes(board: Calm2048Board) {
  return board.reduce<number[]>((indexes, value, index) => {
    if (value === 0) indexes.push(index);
    return indexes;
  }, []);
}

export function spawnTile(board: Calm2048Board, random: Calm2048Random = Math.random): Calm2048SpawnResult {
  const emptyIndexes = emptyCellIndexes(board);
  if (!emptyIndexes.length) return { board: [...board] };

  const spawnedIndex = emptyIndexes[Math.min(emptyIndexes.length - 1, Math.floor(random() * emptyIndexes.length))];
  const value = random() < 0.9 ? 2 : 4;
  const nextBoard = [...board];
  nextBoard[spawnedIndex] = value;

  return { board: nextBoard, spawnedIndex, value };
}

export function moveBoard(board: Calm2048Board, direction: Calm2048Direction): Calm2048MoveResult {
  const lines = linesForDirection(direction);
  const nextBoard = createEmptyBoard();
  let scoreGain = 0;
  let moved = false;
  let merged = false;

  for (const line of lines) {
    const values = line.map((index) => board[index]);
    const result = mergeLine(values);
    scoreGain += result.scoreGain;
    merged = merged || result.merged;

    for (const [offset, index] of line.entries()) {
      nextBoard[index] = result.values[offset];
      if (nextBoard[index] !== board[index]) moved = true;
    }
  }

  return { board: nextBoard, moved, merged, scoreGain };
}

export function canMove(board: Calm2048Board, direction?: Calm2048Direction) {
  if (direction) return moveBoard(board, direction).moved;
  if (emptyCellIndexes(board).length > 0) return true;

  for (let row = 0; row < calm2048BoardSize; row += 1) {
    for (let col = 0; col < calm2048BoardSize; col += 1) {
      const value = board[cellIndex(row, col)];
      if (col < calm2048BoardSize - 1 && value === board[cellIndex(row, col + 1)]) return true;
      if (row < calm2048BoardSize - 1 && value === board[cellIndex(row + 1, col)]) return true;
    }
  }

  return false;
}

export function calm2048Outcome(board: Calm2048Board): Calm2048Outcome {
  return canMove(board) ? "playing" : "loss";
}

export function highestTile(board: Calm2048Board) {
  return Math.max(0, ...board);
}

function mergeLine(values: number[]) {
  const compact = values.filter((value) => value > 0);
  const mergedValues: number[] = [];
  let scoreGain = 0;
  let merged = false;

  for (let index = 0; index < compact.length; index += 1) {
    const value = compact[index];
    if (value === compact[index + 1]) {
      const nextValue = value * 2;
      mergedValues.push(nextValue);
      scoreGain += nextValue;
      merged = true;
      index += 1;
    } else {
      mergedValues.push(value);
    }
  }

  while (mergedValues.length < calm2048BoardSize) mergedValues.push(0);
  return { values: mergedValues, merged, scoreGain };
}

function linesForDirection(direction: Calm2048Direction) {
  const lines: number[][] = [];

  if (direction === "left" || direction === "right") {
    for (let row = 0; row < calm2048BoardSize; row += 1) {
      const line = Array.from({ length: calm2048BoardSize }, (_, col) => cellIndex(row, col));
      lines.push(direction === "left" ? line : line.reverse());
    }
    return lines;
  }

  for (let col = 0; col < calm2048BoardSize; col += 1) {
    const line = Array.from({ length: calm2048BoardSize }, (_, row) => cellIndex(row, col));
    lines.push(direction === "up" ? line : line.reverse());
  }

  return lines;
}

function cellIndex(row: number, col: number) {
  return row * calm2048BoardSize + col;
}
