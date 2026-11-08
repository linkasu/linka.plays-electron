import { shuffleItems } from "../../core/random";

// Testers: «сделать задачки по шахматам — например, дойди до ягодки за два хода слоном,
// дойди до гриба за три хода конём. Это позволит сделать поле крупное, чтобы нажимать на ячейки».
// One white piece on a small empty board; the goal is reached in exactly the given number of
// moves at the least. No engine: the moves of one piece on an empty board are simple.

export type PuzzlePiece = "R" | "B" | "N" | "Q" | "K";
export type PuzzleGoal = "berry" | "mushroom";

export type PuzzleLevel = { piece: PuzzlePiece; moves: number; size: number };

export type ChessPuzzle = {
  id: string;
  piece: PuzzlePiece;
  size: number;
  moves: number;
  start: number;
  target: number;
  goal: PuzzleGoal;
};

export const puzzlePieceNames: Record<PuzzlePiece, { name: string; instrumental: string }> = {
  R: { name: "ладья", instrumental: "ладьёй" },
  B: { name: "слон", instrumental: "слоном" },
  N: { name: "конь", instrumental: "конём" },
  Q: { name: "ферзь", instrumental: "ферзём" },
  K: { name: "король", instrumental: "королём" },
};

export const puzzleGoals: Record<PuzzleGoal, { genitive: string; wordId: string }> = {
  berry: { genitive: "ягодки", wordId: "strawberry" },
  mushroom: { genitive: "гриба", wordId: "mushroom" },
};

/** From easy to harder: one move with each piece, then two and three moves. */
export const puzzleLevels: PuzzleLevel[] = [
  { piece: "R", moves: 1, size: 5 },
  { piece: "B", moves: 1, size: 5 },
  { piece: "N", moves: 1, size: 5 },
  { piece: "K", moves: 2, size: 5 },
  { piece: "B", moves: 2, size: 5 },
  { piece: "N", moves: 2, size: 5 },
  { piece: "Q", moves: 2, size: 5 },
  { piece: "N", moves: 3, size: 6 },
];

const movesWords: Record<number, string> = { 1: "один ход", 2: "два хода", 3: "три хода" };

export function puzzleTask(piece: PuzzlePiece, goal: PuzzleGoal, moves: number) {
  return `Дойди ${puzzlePieceNames[piece].instrumental} до ${puzzleGoals[goal].genitive} за ${movesWords[moves]}.`;
}

export function puzzleTaskAssetId(piece: PuzzlePiece, goal: PuzzleGoal, moves: number) {
  return `chess-mini.puzzle.${piece.toLowerCase()}-${goal}-${moves}`;
}

function rowColumn(size: number, index: number) {
  return { row: Math.floor(index / size), column: index % size };
}

/** Squares a piece can go to from `from` on an empty board. */
export function pieceMoves(piece: PuzzlePiece, size: number, from: number): number[] {
  const { row, column } = rowColumn(size, from);
  const result: number[] = [];
  const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < size && c < size;
  const slide = (dirs: number[][]) => {
    for (const [dr, dc] of dirs) {
      let r = row + dr;
      let c = column + dc;
      while (inside(r, c)) {
        result.push(r * size + c);
        r += dr;
        c += dc;
      }
    }
  };
  const step = (dirs: number[][]) => {
    for (const [dr, dc] of dirs)
      if (inside(row + dr, column + dc)) result.push((row + dr) * size + column + dc);
  };
  const straight = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const diagonal = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  if (piece === "R") slide(straight);
  if (piece === "B") slide(diagonal);
  if (piece === "Q") slide([...straight, ...diagonal]);
  if (piece === "K") step([...straight, ...diagonal]);
  if (piece === "N")
    step([
      [1, 2],
      [2, 1],
      [-1, 2],
      [-2, 1],
      [1, -2],
      [2, -1],
      [-1, -2],
      [-2, -1],
    ]);
  return result;
}

/** The least number of moves from `from` to every square (Infinity when unreachable). */
export function moveDistances(piece: PuzzlePiece, size: number, from: number) {
  const distances = Array<number>(size * size).fill(Infinity);
  distances[from] = 0;
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift() as number;
    for (const next of pieceMoves(piece, size, current)) {
      if (distances[next] === Infinity) {
        distances[next] = distances[current] + 1;
        queue.push(next);
      }
    }
  }
  return distances;
}

export function createChessPuzzle(index: number, random = Math.random): ChessPuzzle {
  const level = puzzleLevels[index % puzzleLevels.length];
  const goal: PuzzleGoal = index % 2 === 0 ? "berry" : "mushroom";
  const squares = Array.from({ length: level.size * level.size }, (_, i) => i);
  for (const start of shuffleItems(squares, random)) {
    const distances = moveDistances(level.piece, level.size, start);
    const targets = squares.filter((square) => distances[square] === level.moves);
    if (targets.length > 0) {
      return {
        id: `chess-puzzle:${index}`,
        piece: level.piece,
        size: level.size,
        moves: level.moves,
        start,
        target: shuffleItems(targets, random)[0],
        goal,
      };
    }
  }
  throw new Error("Не удалось составить задачку.");
}
