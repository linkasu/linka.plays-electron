import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import {
  checkersPuzzleLevels,
  checkersPuzzleSize,
  checkersPuzzleTask,
  checkersPuzzleTaskAssetId,
  createCheckersPuzzle,
  isPuzzleDarkCell,
  movesToCapture,
  puzzleCaptureLanding,
  puzzleSteps,
} from "./puzzles";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const at = (row: number, column: number) => row * checkersPuzzleSize + column;

describe("checkers puzzles", () => {
  it("steps forward along the diagonals and takes by jumping over", () => {
    expect(puzzleSteps(at(4, 1), undefined).sort((a, b) => a - b)).toEqual([at(3, 0), at(3, 2)]);
    expect(puzzleSteps(at(4, 1), at(3, 2))).toEqual([at(3, 0)]);
    expect(puzzleCaptureLanding(at(4, 1), at(3, 2))).toBe(at(2, 3));
    // A take backwards, as in Russian checkers.
    expect(puzzleCaptureLanding(at(2, 3), at(3, 2))).toBe(at(4, 1));
    // No square behind the blue checker: no take.
    expect(puzzleCaptureLanding(at(1, 4), at(0, 5))).toBeUndefined();
  });

  it("puts the blue checker exactly as many moves away as the task says", () => {
    for (let index = 0; index < checkersPuzzleLevels.length * 3; index += 1) {
      const puzzle = createCheckersPuzzle(index, seededRandom(index + 7));
      expect(isPuzzleDarkCell(puzzle.start)).toBe(true);
      expect(isPuzzleDarkCell(puzzle.target)).toBe(true);
      expect(movesToCapture(puzzle.start, puzzle.target)).toBe(puzzle.moves);
    }
  });

  it("says the task in the testers' words, and every task is recorded", () => {
    expect(checkersPuzzleTask(3)).toBe("Съешь синюю шашку за три хода.");
    const byId = new Map(ttsAssets.map((asset) => [asset.id, asset.text]));
    for (const moves of new Set(checkersPuzzleLevels))
      expect(byId.get(checkersPuzzleTaskAssetId(moves))).toBe(checkersPuzzleTask(moves));
    expect(byId.has("checkers-light.puzzle-done")).toBe(true);
    expect(byId.has("checkers-light.puzzle-retry")).toBe(true);
    expect(byId.has("checkers-light.mode")).toBe(true);
  });
});
