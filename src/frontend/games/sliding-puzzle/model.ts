export type SlidingPuzzleBoard = number[];

export type SlidingPuzzleMoveResult = {
  board: SlidingPuzzleBoard;
  moved: boolean;
  emptyIndex: number;
  movedTile?: number;
  fromIndex?: number;
  toIndex?: number;
};

export const slidingPuzzleSize = 3;
export const slidingPuzzleCellCount = slidingPuzzleSize * slidingPuzzleSize;

const solvedBoard = [1, 2, 3, 4, 5, 6, 7, 8, 0];
const gentleShuffleTileIndexes = [7, 4, 3, 6, 7, 4, 5, 2, 1, 4];

export function createSolvedBoard(): SlidingPuzzleBoard {
  return [...solvedBoard];
}

export function createInitialBoard(): SlidingPuzzleBoard {
  return gentleShuffleTileIndexes.reduce((board, tileIndex) => moveTile(board, tileIndex).board, createSolvedBoard());
}

export function findEmptyIndex(board: SlidingPuzzleBoard) {
  return board.indexOf(0);
}

export function movableTileIndexes(board: SlidingPuzzleBoard) {
  const emptyIndex = findEmptyIndex(board);
  if (emptyIndex < 0) return [];

  return board.reduce<number[]>((indexes, tile, index) => {
    if (tile !== 0 && areAdjacent(index, emptyIndex)) indexes.push(index);
    return indexes;
  }, []);
}

export function moveTile(board: SlidingPuzzleBoard, tileIndex: number): SlidingPuzzleMoveResult {
  const emptyIndex = findEmptyIndex(board);
  const nextBoard = [...board];

  if (emptyIndex < 0 || tileIndex < 0 || tileIndex >= board.length || board[tileIndex] === 0 || !areAdjacent(tileIndex, emptyIndex)) {
    return { board: nextBoard, moved: false, emptyIndex };
  }

  const movedTile = board[tileIndex];
  nextBoard[emptyIndex] = movedTile;
  nextBoard[tileIndex] = 0;

  return {
    board: nextBoard,
    moved: true,
    emptyIndex: tileIndex,
    movedTile,
    fromIndex: tileIndex,
    toIndex: emptyIndex
  };
}

export function isSolved(board: SlidingPuzzleBoard) {
  return board.length === solvedBoard.length && board.every((tile, index) => tile === solvedBoard[index]);
}

export function rowForIndex(index: number) {
  return Math.floor(index / slidingPuzzleSize);
}

export function colForIndex(index: number) {
  return index % slidingPuzzleSize;
}

export function areAdjacent(firstIndex: number, secondIndex: number) {
  return Math.abs(rowForIndex(firstIndex) - rowForIndex(secondIndex)) + Math.abs(colForIndex(firstIndex) - colForIndex(secondIndex)) === 1;
}
