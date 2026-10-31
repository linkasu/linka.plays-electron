import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { games, gameCategoryOrder } from "../../src/frontend/data/games";
import {
  gameMenuCovers,
  categoryMenuCovers,
  modeMenuCovers,
  menuCoverFor,
} from "../../src/frontend/data/menuCovers";

const paths = (cover) =>
  cover.kind === "layered" ? cover.layers.map((layer) => layer.path) : cover.paths;

describe("illustrated menu coverage", () => {
  it("covers every registry game and category explicitly", () => {
    expect(Object.keys(gameMenuCovers).sort()).toEqual(games.map((game) => game.id).sort());
    expect(Object.keys(categoryMenuCovers).sort()).toEqual([...gameCategoryOrder].sort());
    for (const game of games)
      expect(menuCoverFor({ gameId: game.id })).toBe(gameMenuCovers[game.id]);
  });
  it("ships every referenced illustration, including JPG and WebP", () => {
    const all = [
      ...Object.values(gameMenuCovers),
      ...Object.values(categoryMenuCovers),
      ...Object.values(modeMenuCovers),
    ];
    for (const cover of all)
      for (const image of paths(cover)) {
        expect(existsSync(resolve("public/images", image)), image).toBe(true);
      }
  });
  it("keeps an illustrated fallback for unknown future games", () => {
    for (const gameId of ["not-in-registry", "__proto__"])
      expect(paths(menuCoverFor({ gameId }))).toEqual(["words/book.png"]);
  });
});
