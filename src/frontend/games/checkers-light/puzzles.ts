import { shuffleItems } from "../../core/random";

// Testers (recheck): «шашки сами-то классные, но играть всё равно очень тяжело, глазам капец.
// Предлагаю или убрать, или сделать поле крупнее, квадратиков меньше и сделать тренажёр —
// съешь шашку соперника в три хода». The owner chose the puzzles: a small board with large
// squares, one gold checker of the child and one blue checker standing still.
// A gold checker steps forward (up) along a diagonal; it takes a blue checker next to it on
// a diagonal, in any direction, by jumping over it onto the free square behind, as in
// Russian checkers. Taking the blue checker is the last move of the puzzle.

export const checkersPuzzleSize = 6;

export type CheckersPuzzle = {
  id: string;
  moves: number;
  start: number;
  target: number;
};

/** From easy to harder: take at once, then in two and in three moves. */
export const checkersPuzzleLevels = [1, 1, 2, 2, 2, 3, 3, 3];

const movesWords: Record<number, string> = { 1: "один ход", 2: "два хода", 3: "три хода" };

export function checkersPuzzleTask(moves: number) {
  return `Съешь синюю шашку за ${movesWords[moves]}.`;
}

export function checkersPuzzleTaskAssetId(moves: number) {
  return `checkers-light.puzzle.${moves}`;
}

function position(index: number) {
  return { row: Math.floor(index / checkersPuzzleSize), column: index % checkersPuzzleSize };
}

function inside(row: number, column: number) {
  return row >= 0 && column >= 0 && row < checkersPuzzleSize && column < checkersPuzzleSize;
}

export function isPuzzleDarkCell(index: number) {
  const { row, column } = position(index);
  return (row + column) % 2 === 1;
}

/** Where the gold checker can step without taking: forward diagonals onto free squares. */
export function puzzleSteps(from: number, blue: number | undefined) {
  const { row, column } = position(from);
  const result: number[] = [];
  for (const dc of [-1, 1]) {
    const r = row - 1;
    const c = column + dc;
    if (!inside(r, c)) continue;
    const next = r * checkersPuzzleSize + c;
    if (next !== blue) result.push(next);
  }
  return result;
}

/** The square the gold checker lands on when it takes the blue one, if it can. */
export function puzzleCaptureLanding(from: number, blue: number | undefined) {
  if (blue === undefined) return undefined;
  const a = position(from);
  const b = position(blue);
  const dr = b.row - a.row;
  const dc = b.column - a.column;
  if (Math.abs(dr) !== 1 || Math.abs(dc) !== 1) return undefined;
  const r = b.row + dr;
  const c = b.column + dc;
  return inside(r, c) ? r * checkersPuzzleSize + c : undefined;
}

/** The least number of moves to take the blue checker from `from` (Infinity when it cannot). */
export function movesToCapture(from: number, blue: number) {
  let frontier = [from];
  const seen = new Set(frontier);
  for (let moves = 1; moves <= checkersPuzzleSize * 2; moves += 1) {
    if (frontier.some((square) => puzzleCaptureLanding(square, blue) !== undefined)) return moves;
    const next: number[] = [];
    for (const square of frontier)
      for (const step of puzzleSteps(square, blue))
        if (!seen.has(step)) {
          seen.add(step);
          next.push(step);
        }
    if (next.length === 0) return Infinity;
    frontier = next;
  }
  return Infinity;
}

export function createCheckersPuzzle(index: number, random = Math.random): CheckersPuzzle {
  const moves = checkersPuzzleLevels[index % checkersPuzzleLevels.length];
  const dark = Array.from({ length: checkersPuzzleSize ** 2 }, (_, i) => i).filter(
    isPuzzleDarkCell,
  );
  // The gold checker starts in the two bottom rows, so there is room to go up.
  const starts = dark.filter((square) => position(square).row >= checkersPuzzleSize - 2);
  for (const start of shuffleItems(starts, random)) {
    const targets = dark.filter(
      (square) => square !== start && movesToCapture(start, square) === moves,
    );
    if (targets.length > 0) {
      return {
        id: `checkers-puzzle:${index}`,
        moves,
        start,
        target: shuffleItems(targets, random)[0],
      };
    }
  }
  throw new Error("Не удалось составить задачку.");
}
