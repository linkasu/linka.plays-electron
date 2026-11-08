import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import {
  createChessPuzzle,
  moveDistances,
  pieceMoves,
  puzzleLevels,
  puzzleTask,
  puzzleTaskAssetId,
  type PuzzleGoal,
} from "./puzzles";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("chess puzzles", () => {
  it("moves pieces as in chess on an empty board", () => {
    // 5×5, centre square 12
    expect(pieceMoves("R", 5, 12).sort((a, b) => a - b)).toEqual([2, 7, 10, 11, 13, 14, 17, 22]);
    expect(pieceMoves("B", 5, 12).sort((a, b) => a - b)).toEqual([0, 4, 6, 8, 16, 18, 20, 24]);
    expect(pieceMoves("N", 5, 12).sort((a, b) => a - b)).toEqual([1, 3, 5, 9, 15, 19, 21, 23]);
    expect(pieceMoves("K", 5, 0).sort((a, b) => a - b)).toEqual([1, 5, 6]);
  });

  it("puts the goal exactly as many moves away as the task says", () => {
    for (let index = 0; index < puzzleLevels.length * 3; index += 1) {
      const puzzle = createChessPuzzle(index, seededRandom(index + 1));
      expect(moveDistances(puzzle.piece, puzzle.size, puzzle.start)[puzzle.target]).toBe(
        puzzle.moves,
      );
    }
  });

  it("says the task in the testers' words, and every task is recorded", () => {
    expect(puzzleTask("B", "berry", 2)).toBe("Дойди слоном до ягодки за два хода.");
    expect(puzzleTask("N", "mushroom", 3)).toBe("Дойди конём до гриба за три хода.");
    const byId = new Map(ttsAssets.map((asset) => [asset.id, asset.text]));
    for (const level of puzzleLevels) {
      for (const goal of ["berry", "mushroom"] as PuzzleGoal[]) {
        expect(byId.get(puzzleTaskAssetId(level.piece, goal, level.moves))).toBe(
          puzzleTask(level.piece, goal, level.moves),
        );
      }
    }
  });
});
