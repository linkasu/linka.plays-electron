import { describe, expect, it } from "vitest";
import { findGame, groupGamesByCategory, resolveGameStabilityStatus } from "./games";

describe("game registry", () => {
  it.each([
    ["bubble-pop", "/games/bubble-pop"],
    ["who-is-this", "/games/who-is-this"]
  ])("keeps archived compatibility entry %s routable but hidden from menus", (gameId, route) => {
    const game = findGame(gameId);

    expect(game?.route).toBe(route);
    expect(game && resolveGameStabilityStatus(game)).toBe("archived");
    expect(game?.tags).toContain("hidden-from-menu");
    expect(groupGamesByCategory().flatMap((group) => group.games)).not.toContainEqual(game);
  });

  it("keeps reading and action-task copy aligned with the games", () => {
    const choosePicture = findGame("choose-picture");
    const objectAction = findGame("object-action");

    expect(choosePicture?.description).toContain("Прочитай слово");
    expect(choosePicture?.description).toContain("название цели не озвучивается");
    expect(choosePicture?.description).not.toContain("Слушай");
    expect(choosePicture?.skills).toEqual(["vocabulary", "choice", "visual-search"]);
    expect(objectAction).toMatchObject({
      title: "Покажи действие",
      selfDescription: "Покажи названное действие."
    });
  });

  it("describes functional AAC choices as valid communication", () => {
    const miniDialog = findGame("mini-dialog");
    const socialPhrases = findGame("social-phrases");

    expect(miniDialog?.description).toContain("любая реплика считается коммуникацией");
    expect(miniDialog?.description).toContain("отказывайся");
    expect(socialPhrases?.description).toContain("функциональную AAC-фразу");
    expect(socialPhrases?.description).toContain("тоже считаются коммуникацией");
  });

  it("records TypeWord as a guided choice between large letter buttons", () => {
    expect(findGame("type-word")).toMatchObject({
      description: "Собирай короткие слова по одной букве, каждый раз выбирая следующую из 2–4 крупных кнопок.",
      minTargetSizePx: 120
    });
  });

  it("keeps WhoIsThis copy aligned with its MatchSame compatibility target", () => {
    const matchSame = findGame("match-same");
    const whoIsThis = findGame("who-is-this");

    expect(whoIsThis).toMatchObject({
      title: matchSame?.title,
      description: matchSame?.description,
      selfDescription: matchSame?.selfDescription,
      category: matchSame?.category,
      icon: matchSame?.icon,
      skills: matchSame?.skills,
      status: matchSame?.status,
      recommendedSessionSeconds: matchSame?.recommendedSessionSeconds,
      minTargetSizePx: matchSame?.minTargetSizePx,
      defaultDwellMs: matchSame?.defaultDwellMs
    });
  });
});
