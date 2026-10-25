import { describe, expect, it } from "vitest";
import { buildRobotArtIds } from "../games/build-robot/model";
import { butterflyArtIds } from "../games/butterfly/art";
import { chooseEmotionFaces } from "../games/choose-emotion/model";
import { dayRoutineItems } from "../games/day-routine/model";
import { itemsByAnswer } from "../games/eat-or-not-eat/model";
import { feedAnimalArtIds } from "../games/feed-animal/model";
import { findAnimalArtId, findAnimalDrawnIds } from "../games/find-animal/model";
import { findEmotionOptions } from "../games/find-emotion/model";
import { minesweeperSafeArtIds } from "../games/minesweeper-safe/model";
import { sandwichChoices } from "../games/sandwich/model";
import { robotVacuumArtIds } from "../games/robot-vacuum/art";
import { dailyScheduleSteps } from "../games/schedule/model";
import { trainSequenceArtIds } from "../games/train-sequence/model";
import { oppositesArtIds } from "../games/opposites/model";
import { soupRecipeArtIds } from "../games/soup-recipe/model";
import { gameArtSrc } from "./gameArt";

describe("gameArtSrc", () => {
  it("builds a per-game asset path and keeps the folder separator", () => {
    expect(gameArtSrc("sandwich/bread", "./", "file:///app/dist/index.html")).toBe(
      "file:///app/dist/images/sandwich/bread.png",
    );
  });

  it("encodes unsafe characters inside a path segment", () => {
    expect(gameArtSrc("game/a b", "./", "https://example.test/index.html")).toBe(
      "https://example.test/images/game/a%20b.png",
    );
  });

  it("has a file for every art id the games refer to", () => {
    const artIds = [
      ...sandwichChoices,
      ...dailyScheduleSteps,
      ...dayRoutineItems,
      ...findEmotionOptions,
      ...chooseEmotionFaces,
      ...itemsByAnswer.food,
      ...itemsByAnswer.thing,
      ...findAnimalDrawnIds.map((id) => ({ artId: findAnimalArtId(id) })),
      { artId: "eat-or-not-eat/icon-edible" },
      { artId: "eat-or-not-eat/icon-not-edible" },
      ...buildRobotArtIds.map((artId) => ({ artId })),
      ...trainSequenceArtIds.map((artId) => ({ artId })),
      ...butterflyArtIds.map((artId) => ({ artId })),
      ...robotVacuumArtIds.map((artId) => ({ artId })),
      ...minesweeperSafeArtIds.map((artId) => ({ artId })),
      ...feedAnimalArtIds.map((artId) => ({ artId })),
      ...soupRecipeArtIds.map((artId) => ({ artId })),
      ...oppositesArtIds.map((artId) => ({ artId })),
    ]
      .map((item) => item.artId)
      .filter((artId): artId is string => Boolean(artId));

    expect(artIds.length).toBeGreaterThan(0);
    const files = new Set(
      Object.keys(import.meta.glob("../../../public/images/*/*.png")).map((path) =>
        path.replace("../../../public/images/", "").replace(/\.png$/, ""),
      ),
    );
    const missing = artIds.filter((artId) => !files.has(artId));
    expect(missing).toEqual([]);
  });
});
