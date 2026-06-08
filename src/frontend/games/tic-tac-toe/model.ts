export type TicTacToeMark = "X" | "O";
export type TicTacToeCell = TicTacToeMark | "";
export type TicTacToeBoard = TicTacToeCell[];
export type TicTacToeWinner = TicTacToeMark | "draw" | undefined;

const qTrainingGames = 12000;
const qLearningRate = 0.32;
const qDiscount = 0.92;
const emptyBoardKey = "---------";
const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
] as const;

const qTable = trainQTable();

export function createEmptyBoard(): TicTacToeBoard {
  return Array<TicTacToeCell>(9).fill("");
}

export function boardKey(board: TicTacToeBoard) {
  return board.map((cell) => cell || "-").join("");
}

export function availableMoves(board: TicTacToeBoard) {
  return board.reduce<number[]>((moves, cell, index) => {
    if (!cell) moves.push(index);
    return moves;
  }, []);
}

export function findWinner(board: TicTacToeBoard): TicTacToeWinner {
  for (const [a, b, c] of winningLines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return availableMoves(board).length ? undefined : "draw";
}

export function winningLine(board: TicTacToeBoard) {
  return winningLines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
}

export function chooseDeepQMove(board: TicTacToeBoard) {
  const moves = availableMoves(board);
  if (!moves.length) return undefined;

  const win = findImmediateMove(board, "O");
  if (win !== undefined) return win;

  const block = findImmediateMove(board, "X");
  if (block !== undefined) return block;

  const values = qTable.get(boardKey(board));
  return moves.reduce((bestMove, move) => {
    const bestValue = values?.[bestMove] ?? fallbackMoveValue(bestMove);
    const nextValue = values?.[move] ?? fallbackMoveValue(move);
    return nextValue > bestValue ? move : bestMove;
  }, moves[0]);
}

function findImmediateMove(board: TicTacToeBoard, mark: TicTacToeMark) {
  return availableMoves(board).find((move) => {
    const next = [...board];
    next[move] = mark;
    return findWinner(next) === mark;
  });
}

function fallbackMoveValue(move: number) {
  if (move === 4) return 0.16;
  if ([0, 2, 6, 8].includes(move)) return 0.1;
  return 0.04;
}

function trainQTable() {
  const table = new Map<string, number[]>();
  let seed = 73471;

  function random() {
    seed = seed * 1664525 + 1013904223 >>> 0;
    return seed / 0x100000000;
  }

  function valuesFor(key: string) {
    let values = table.get(key);
    if (!values) {
      values = Array(9).fill(0);
      table.set(key, values);
    }
    return values;
  }

  function chooseTrainingMove(board: TicTacToeBoard, epsilon: number) {
    const moves = availableMoves(board);
    if (random() < epsilon) return moves[Math.floor(random() * moves.length)];
    const values = valuesFor(boardKey(board));
    return moves.reduce((bestMove, move) => values[move] > values[bestMove] ? move : bestMove, moves[0]);
  }

  function update(previousKey: string, move: number, reward: number, nextBoard: TicTacToeBoard) {
    const values = valuesFor(previousKey);
    const nextMoves = availableMoves(nextBoard);
    const nextValues = valuesFor(boardKey(nextBoard));
    const nextBest = nextMoves.length ? Math.max(...nextMoves.map((nextMove) => nextValues[nextMove])) : 0;
    values[move] += qLearningRate * (reward + qDiscount * nextBest - values[move]);
  }

  for (let game = 0; game < qTrainingGames; game++) {
    const board = createEmptyBoard();
    const epsilon = Math.max(0.05, 0.62 * (1 - game / qTrainingGames));
    let lastKey = emptyBoardKey;
    let lastMove = -1;

    while (!findWinner(board)) {
      lastKey = boardKey(board);
      lastMove = chooseTrainingMove(board, epsilon);
      board[lastMove] = "O";

      const afterO = findWinner(board);
      if (afterO) {
        update(lastKey, lastMove, afterO === "O" ? 1 : 0.2, board);
        break;
      }

      const xMoves = availableMoves(board);
      const tacticalX = findImmediateMove(board, "X") ?? findImmediateMove(board, "O");
      board[tacticalX ?? xMoves[Math.floor(random() * xMoves.length)]] = "X";

      const afterX = findWinner(board);
      update(lastKey, lastMove, afterX === "X" ? -1 : afterX === "draw" ? 0.35 : -0.02, board);
    }
  }

  return table;
}
