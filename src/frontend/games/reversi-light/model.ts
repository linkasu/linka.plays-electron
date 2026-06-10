export type ReversiLightMark = "player" | "ai";
export type ReversiLightCell = ReversiLightMark | "";
export type ReversiLightBoard = ReversiLightCell[];
export type ReversiLightWinner = ReversiLightMark | "draw";

export type ReversiLightMoveResult = {
  board: ReversiLightBoard;
  flipped: number[];
};

export const reversiLightSize = 4;
export const reversiLightCellCount = reversiLightSize * reversiLightSize;

const directions = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1]
] as const;

export function createInitialBoard(): ReversiLightBoard {
  const board = createEmptyBoard();
  board[cellIndex(1, 1)] = "ai";
  board[cellIndex(1, 2)] = "player";
  board[cellIndex(2, 1)] = "player";
  board[cellIndex(2, 2)] = "ai";
  return board;
}

export function createEmptyBoard(): ReversiLightBoard {
  return Array<ReversiLightCell>(reversiLightCellCount).fill("");
}

export function cellIndex(row: number, column: number) {
  return row * reversiLightSize + column;
}

export function rowOf(index: number) {
  return Math.floor(index / reversiLightSize);
}

export function columnOf(index: number) {
  return index % reversiLightSize;
}

export function opponent(mark: ReversiLightMark): ReversiLightMark {
  return mark === "player" ? "ai" : "player";
}

export function validMoves(board: ReversiLightBoard, mark: ReversiLightMark) {
  return board.reduce<number[]>((moves, cell, index) => {
    if (!cell && flippedForMove(board, index, mark).length) moves.push(index);
    return moves;
  }, []);
}

export function isValidMove(board: ReversiLightBoard, index: number, mark: ReversiLightMark) {
  return flippedForMove(board, index, mark).length > 0;
}

export function applyMove(board: ReversiLightBoard, index: number, mark: ReversiLightMark): ReversiLightMoveResult | undefined {
  const flipped = flippedForMove(board, index, mark);
  if (!flipped.length) return undefined;

  const nextBoard = [...board];
  nextBoard[index] = mark;
  for (const flippedIndex of flipped) nextBoard[flippedIndex] = mark;
  return { board: nextBoard, flipped };
}

export function chooseAiMove(board: ReversiLightBoard) {
  const moves = validMoves(board, "ai");
  if (!moves.length) return undefined;

  return moves.reduce((bestMove, move) => {
    const bestScore = moveScore(board, bestMove, "ai");
    const nextScore = moveScore(board, move, "ai");
    return nextScore > bestScore ? move : bestMove;
  }, moves[0]);
}

export function countPieces(board: ReversiLightBoard) {
  return board.reduce<Record<ReversiLightMark, number>>((counts, cell) => {
    if (cell) counts[cell] += 1;
    return counts;
  }, { player: 0, ai: 0 });
}

export function hasAnyMove(board: ReversiLightBoard) {
  return validMoves(board, "player").length > 0 || validMoves(board, "ai").length > 0;
}

export function findWinner(board: ReversiLightBoard): ReversiLightWinner {
  const counts = countPieces(board);
  if (counts.player > counts.ai) return "player";
  if (counts.ai > counts.player) return "ai";
  return "draw";
}

function flippedForMove(board: ReversiLightBoard, index: number, mark: ReversiLightMark) {
  if (index < 0 || index >= reversiLightCellCount || board[index]) return [];

  const row = rowOf(index);
  const column = columnOf(index);
  const other = opponent(mark);
  const flipped: number[] = [];

  for (const [rowDirection, columnDirection] of directions) {
    const line: number[] = [];
    let nextRow = row + rowDirection;
    let nextColumn = column + columnDirection;

    while (isInside(nextRow, nextColumn) && board[cellIndex(nextRow, nextColumn)] === other) {
      line.push(cellIndex(nextRow, nextColumn));
      nextRow += rowDirection;
      nextColumn += columnDirection;
    }

    if (line.length && isInside(nextRow, nextColumn) && board[cellIndex(nextRow, nextColumn)] === mark) {
      flipped.push(...line);
    }
  }

  return flipped;
}

function moveScore(board: ReversiLightBoard, move: number, mark: ReversiLightMark) {
  const result = applyMove(board, move, mark);
  if (!result) return Number.NEGATIVE_INFINITY;

  const cornerBonus = [0, 3, 12, 15].includes(move) ? 8 : 0;
  const edgeBonus = rowOf(move) === 0 || rowOf(move) === reversiLightSize - 1 || columnOf(move) === 0 || columnOf(move) === reversiLightSize - 1 ? 2 : 0;
  const playerReplies = validMoves(result.board, "player").length;
  return result.flipped.length * 3 + cornerBonus + edgeBonus - playerReplies;
}

function isInside(row: number, column: number) {
  return row >= 0 && row < reversiLightSize && column >= 0 && column < reversiLightSize;
}
