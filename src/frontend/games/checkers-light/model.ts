export type CheckersLightPieceSide = "gold" | "blue";

export type CheckersLightPiece = {
  id: string;
  side: CheckersLightPieceSide;
};

export type CheckersLightCell = CheckersLightPiece | undefined;
export type CheckersLightBoard = CheckersLightCell[];

export const checkersLightSize = 4;
export const checkersLightCells = checkersLightSize * checkersLightSize;

const moveDirections = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
] as const;

const initialPieces: Array<{ index: number; piece: CheckersLightPiece }> = [
  { index: 1, piece: { id: "blue-1", side: "blue" } },
  { index: 3, piece: { id: "blue-2", side: "blue" } },
  { index: 12, piece: { id: "gold-1", side: "gold" } },
  { index: 14, piece: { id: "gold-2", side: "gold" } }
];

export function cellIndex(row: number, column: number) {
  return row * checkersLightSize + column;
}

export function cellPosition(index: number) {
  return {
    row: Math.floor(index / checkersLightSize),
    column: index % checkersLightSize
  };
}

export function isDarkCell(index: number) {
  const { row, column } = cellPosition(index);
  return (row + column) % 2 === 1;
}

export function createInitialCheckersLightBoard(): CheckersLightBoard {
  const board = Array<CheckersLightCell>(checkersLightCells).fill(undefined);
  for (const { index, piece } of initialPieces) board[index] = piece;
  return board;
}

export function getMoveTargets(board: CheckersLightBoard, fromIndex: number) {
  const piece = board[fromIndex];
  if (!piece) return [];

  const { row, column } = cellPosition(fromIndex);
  return moveDirections
    .map(([rowOffset, columnOffset]) => [row + rowOffset, column + columnOffset] as const)
    .filter(([nextRow, nextColumn]) => isInside(nextRow, nextColumn))
    .map(([nextRow, nextColumn]) => cellIndex(nextRow, nextColumn))
    .filter((nextIndex) => isDarkCell(nextIndex) && !board[nextIndex]);
}

export function getMovablePieceIndexes(board: CheckersLightBoard) {
  return board
    .map((piece, index) => piece && getMoveTargets(board, index).length ? index : undefined)
    .filter((index): index is number => index !== undefined);
}

export function applyCheckersLightMove(board: CheckersLightBoard, fromIndex: number, toIndex: number) {
  if (!getMoveTargets(board, fromIndex).includes(toIndex)) return undefined;

  const nextBoard = [...board];
  nextBoard[toIndex] = nextBoard[fromIndex];
  nextBoard[fromIndex] = undefined;
  return nextBoard;
}

function isInside(row: number, column: number) {
  return row >= 0 && row < checkersLightSize && column >= 0 && column < checkersLightSize;
}
