export type ConnectFourMark = "R" | "Y";
export type ConnectFourCell = ConnectFourMark | "";
export type ConnectFourBoard = ConnectFourCell[];
export type ConnectFourWinner = ConnectFourMark | "draw" | undefined;

export const connectFourColumns = 7;
export const connectFourRows = 6;
export const connectFourCells = connectFourColumns * connectFourRows;

const directions = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
] as const;

export function createEmptyBoard(): ConnectFourBoard {
  return Array<ConnectFourCell>(connectFourCells).fill("");
}

export function cellIndex(row: number, column: number) {
  return row * connectFourColumns + column;
}

export function availableColumns(board: ConnectFourBoard) {
  return Array.from({ length: connectFourColumns }, (_, column) => column).filter((column) => !board[cellIndex(0, column)]);
}

export function dropDisc(board: ConnectFourBoard, column: number, mark: ConnectFourMark) {
  if (column < 0 || column >= connectFourColumns) return undefined;
  for (let row = connectFourRows - 1; row >= 0; row--) {
    const index = cellIndex(row, column);
    if (!board[index]) {
      board[index] = mark;
      return index;
    }
  }
  return undefined;
}

export function previewDropRow(board: ConnectFourBoard, column: number) {
  if (column < 0 || column >= connectFourColumns) return undefined;
  for (let row = connectFourRows - 1; row >= 0; row--) {
    if (!board[cellIndex(row, column)]) return row;
  }
  return undefined;
}

export function findWinner(board: ConnectFourBoard): ConnectFourWinner {
  const line = winningLine(board);
  if (line) return board[line[0]] as ConnectFourMark;
  return availableColumns(board).length ? undefined : "draw";
}

export function winningLine(board: ConnectFourBoard) {
  for (let row = 0; row < connectFourRows; row++) {
    for (let column = 0; column < connectFourColumns; column++) {
      const mark = board[cellIndex(row, column)];
      if (!mark) continue;
      for (const [dx, dy] of directions) {
        const line = Array.from({ length: 4 }, (_, offset) => [row + dy * offset, column + dx * offset] as const);
        if (line.every(([nextRow, nextColumn]) => isInside(nextRow, nextColumn) && board[cellIndex(nextRow, nextColumn)] === mark)) {
          return line.map(([nextRow, nextColumn]) => cellIndex(nextRow, nextColumn));
        }
      }
    }
  }
  return undefined;
}

export function chooseDeepQMove(board: ConnectFourBoard) {
  const columns = availableColumns(board);
  if (!columns.length) return undefined;

  const win = findImmediateColumn(board, "Y");
  if (win !== undefined) return win;

  const block = findImmediateColumn(board, "R");
  if (block !== undefined) return block;

  return columns.reduce((bestColumn, column) => {
    const bestValue = evaluateColumn(board, bestColumn, "Y") - evaluateColumn(board, bestColumn, "R") * 0.82;
    const nextValue = evaluateColumn(board, column, "Y") - evaluateColumn(board, column, "R") * 0.82;
    return nextValue > bestValue ? column : bestColumn;
  }, columns[0]);
}

function findImmediateColumn(board: ConnectFourBoard, mark: ConnectFourMark) {
  return availableColumns(board).find((column) => {
    const next = [...board];
    dropDisc(next, column, mark);
    return findWinner(next) === mark;
  });
}

function evaluateColumn(board: ConnectFourBoard, column: number, mark: ConnectFourMark) {
  const next = [...board];
  const droppedIndex = dropDisc(next, column, mark);
  if (droppedIndex === undefined) return Number.NEGATIVE_INFINITY;
  const row = Math.floor(droppedIndex / connectFourColumns);
  let score = 3 - Math.abs(3 - column);

  for (const [dx, dy] of directions) {
    const length = 1 + countDirection(next, row, column, dx, dy, mark) + countDirection(next, row, column, -dx, -dy, mark);
    if (length >= 4) score += 10000;
    else if (length === 3) score += 180;
    else if (length === 2) score += 28;
  }

  score += countOpenWindows(next, mark) * 10;
  return score;
}

function countDirection(board: ConnectFourBoard, row: number, column: number, dx: number, dy: number, mark: ConnectFourMark) {
  let count = 0;
  let nextRow = row + dy;
  let nextColumn = column + dx;
  while (isInside(nextRow, nextColumn) && board[cellIndex(nextRow, nextColumn)] === mark) {
    count += 1;
    nextRow += dy;
    nextColumn += dx;
  }
  return count;
}

function countOpenWindows(board: ConnectFourBoard, mark: ConnectFourMark) {
  const opponent = mark === "R" ? "Y" : "R";
  let count = 0;
  for (let row = 0; row < connectFourRows; row++) {
    for (let column = 0; column < connectFourColumns; column++) {
      for (const [dx, dy] of directions) {
        const cells = Array.from({ length: 4 }, (_, offset) => [row + dy * offset, column + dx * offset] as const);
        if (!cells.every(([nextRow, nextColumn]) => isInside(nextRow, nextColumn))) continue;
        const marks = cells.map(([nextRow, nextColumn]) => board[cellIndex(nextRow, nextColumn)]);
        if (marks.includes(opponent)) continue;
        const ownMarks = marks.filter((cell) => cell === mark).length;
        if (ownMarks >= 2) count += ownMarks;
      }
    }
  }
  return count;
}

function isInside(row: number, column: number) {
  return row >= 0 && row < connectFourRows && column >= 0 && column < connectFourColumns;
}
