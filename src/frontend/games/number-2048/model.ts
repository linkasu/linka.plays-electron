export type Number2048Direction = "up" | "down" | "left" | "right";
export type Number2048Board = number[];
export type Number2048Random = () => number;

export type Number2048MoveResult = {
  board: Number2048Board;
  moved: boolean;
  merged: boolean;
  scoreGain: number;
};

export type Number2048SpawnResult = {
  board: Number2048Board;
  spawnedIndex?: number;
  value?: number;
};

export type Number2048Outcome = "playing" | "loss";

export const number2048BoardSize = 4;
export const number2048CellCount = number2048BoardSize * number2048BoardSize;

export function createEmptyBoard(): Number2048Board {
  return Array(number2048CellCount).fill(0);
}

export function createInitialBoard(random: Number2048Random = Math.random): Number2048Board {
  return spawnTile(spawnTile(createEmptyBoard(), random).board, random).board;
}

export function emptyCellIndexes(board: Number2048Board) {
  return board.reduce<number[]>((indexes, value, index) => {
    if (value === 0) indexes.push(index);
    return indexes;
  }, []);
}

export function spawnTile(board: Number2048Board, random: Number2048Random = Math.random): Number2048SpawnResult {
  const emptyIndexes = emptyCellIndexes(board);
  if (!emptyIndexes.length) return { board: [...board] };

  const spawnedIndex = emptyIndexes[Math.min(emptyIndexes.length - 1, Math.floor(random() * emptyIndexes.length))];
  const value = random() < 0.9 ? 2 : 4;
  const nextBoard = [...board];
  nextBoard[spawnedIndex] = value;

  return { board: nextBoard, spawnedIndex, value };
}

export function moveBoard(board: Number2048Board, direction: Number2048Direction): Number2048MoveResult {
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

export function canMove(board: Number2048Board, direction?: Number2048Direction) {
  if (direction) return moveBoard(board, direction).moved;
  if (emptyCellIndexes(board).length > 0) return true;

  for (let row = 0; row < number2048BoardSize; row += 1) {
    for (let col = 0; col < number2048BoardSize; col += 1) {
      const value = board[cellIndex(row, col)];
      if (col < number2048BoardSize - 1 && value === board[cellIndex(row, col + 1)]) return true;
      if (row < number2048BoardSize - 1 && value === board[cellIndex(row + 1, col)]) return true;
    }
  }

  return false;
}

export function number2048Outcome(board: Number2048Board): Number2048Outcome {
  return canMove(board) ? "playing" : "loss";
}

export function highestTile(board: Number2048Board) {
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

  while (mergedValues.length < number2048BoardSize) mergedValues.push(0);
  return { values: mergedValues, merged, scoreGain };
}

function linesForDirection(direction: Number2048Direction) {
  const lines: number[][] = [];

  if (direction === "left" || direction === "right") {
    for (let row = 0; row < number2048BoardSize; row += 1) {
      const line = Array.from({ length: number2048BoardSize }, (_, col) => cellIndex(row, col));
      lines.push(direction === "left" ? line : line.reverse());
    }
    return lines;
  }

  for (let col = 0; col < number2048BoardSize; col += 1) {
    const line = Array.from({ length: number2048BoardSize }, (_, row) => cellIndex(row, col));
    lines.push(direction === "up" ? line : line.reverse());
  }

  return lines;
}

function cellIndex(row: number, col: number) {
  return row * number2048BoardSize + col;
}
