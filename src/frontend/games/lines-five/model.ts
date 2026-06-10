export type LinesFiveColor = "sky" | "sun" | "leaf" | "berry";
export type LinesFiveCell = LinesFiveColor | "";
export type LinesFiveBoard = LinesFiveCell[];

export type LinesFiveMoveResult = {
  board: LinesFiveBoard;
  placedIndex: number;
  cleared: number[];
  completedLines: number[][];
};

export type LinesFiveOutcome = "playing" | "loss";

export const linesFiveSize = 5;
export const linesFiveCellCount = linesFiveSize * linesFiveSize;
export const linesFiveColors: LinesFiveColor[] = ["sky", "sun", "leaf", "berry"];

const directions = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
] as const;

export function createEmptyLinesFiveBoard(): LinesFiveBoard {
  return Array<LinesFiveCell>(linesFiveCellCount).fill("");
}

export function createInitialLinesFiveBoard(): LinesFiveBoard {
  const board = createEmptyLinesFiveBoard();
  board[cellIndex(0, 0)] = "sky";
  board[cellIndex(0, 1)] = "sky";
  board[cellIndex(1, 1)] = "sun";
  board[cellIndex(2, 1)] = "sun";
  board[cellIndex(3, 3)] = "leaf";
  board[cellIndex(4, 4)] = "berry";
  return board;
}

export function cellIndex(row: number, column: number) {
  return row * linesFiveSize + column;
}

export function rowOf(index: number) {
  return Math.floor(index / linesFiveSize);
}

export function columnOf(index: number) {
  return index % linesFiveSize;
}

export function nextColorForStep(step: number): LinesFiveColor {
  return linesFiveColors[step % linesFiveColors.length];
}

export function emptyCellIndexes(board: LinesFiveBoard) {
  return board.reduce<number[]>((indexes, cell, index) => {
    if (!cell) indexes.push(index);
    return indexes;
  }, []);
}

export function isBoardFull(board: LinesFiveBoard) {
  return emptyCellIndexes(board).length === 0;
}

export function linesFiveOutcome(board: LinesFiveBoard): LinesFiveOutcome {
  return isBoardFull(board) ? "loss" : "playing";
}

export function countColors(board: LinesFiveBoard) {
  return board.reduce<Record<LinesFiveColor, number>>((counts, cell) => {
    if (cell) counts[cell] += 1;
    return counts;
  }, { sky: 0, sun: 0, leaf: 0, berry: 0 });
}

export function placeBall(board: LinesFiveBoard, index: number, color: LinesFiveColor): LinesFiveMoveResult | undefined {
  if (index < 0 || index >= linesFiveCellCount || board[index]) return undefined;

  const nextBoard = [...board];
  nextBoard[index] = color;
  const completedLines = completedLinesThrough(nextBoard, index);
  const cleared = uniqueLineIndexes(completedLines);

  for (const clearedIndex of cleared) nextBoard[clearedIndex] = "";
  return { board: nextBoard, placedIndex: index, cleared, completedLines };
}

export function suggestedMoveIndexes(board: LinesFiveBoard, color: LinesFiveColor) {
  const emptyIndexes = emptyCellIndexes(board);
  const clearingMoves = emptyIndexes.filter((index) => {
    const nextBoard = [...board];
    nextBoard[index] = color;
    return completedLinesThrough(nextBoard, index).length > 0;
  });

  return clearingMoves.length ? clearingMoves : emptyIndexes.slice(0, 5);
}

export function completedLinesThrough(board: LinesFiveBoard, index: number) {
  const color = board[index];
  if (!color) return [];

  return directions.reduce<number[][]>((lines, [rowStep, columnStep]) => {
    const line = lineThrough(board, index, color, rowStep, columnStep);
    if (line.length >= 3) lines.push(line);
    return lines;
  }, []);
}

function lineThrough(board: LinesFiveBoard, index: number, color: LinesFiveColor, rowStep: number, columnStep: number) {
  const row = rowOf(index);
  const column = columnOf(index);
  const before = collectDirection(board, row, column, color, -rowStep, -columnStep).reverse();
  const after = collectDirection(board, row, column, color, rowStep, columnStep);
  return [...before, index, ...after];
}

function collectDirection(board: LinesFiveBoard, row: number, column: number, color: LinesFiveColor, rowStep: number, columnStep: number) {
  const indexes: number[] = [];
  let nextRow = row + rowStep;
  let nextColumn = column + columnStep;

  while (isInside(nextRow, nextColumn) && board[cellIndex(nextRow, nextColumn)] === color) {
    indexes.push(cellIndex(nextRow, nextColumn));
    nextRow += rowStep;
    nextColumn += columnStep;
  }

  return indexes;
}

function uniqueLineIndexes(lines: number[][]) {
  return [...new Set(lines.flat())].sort((left, right) => left - right);
}

function isInside(row: number, column: number) {
  return row >= 0 && row < linesFiveSize && column >= 0 && column < linesFiveSize;
}
