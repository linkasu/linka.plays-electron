import { describe, expect, it } from "vitest";
import { chooseEmotionFaces } from "../games/choose-emotion/model";
import { dayRoutineItems } from "../games/day-routine/model";
import { itemsByAnswer } from "../games/eat-or-not-eat/model";
import { findAnimalArtId, findAnimalDrawnIds } from "../games/find-animal/model";
import { findEmotionOptions } from "../games/find-emotion/model";
import { sandwichChoices } from "../games/sandwich/model";
import { dailyScheduleSteps } from "../games/schedule/model";
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
