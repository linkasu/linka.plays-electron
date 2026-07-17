import { describe, expect, it } from "vitest";
import { findGame, groupGamesByCategory, resolveGameStabilityStatus } from "./games";

describe("game registry", () => {
  it("keeps archived BubblePop routable but hides it from menus", () => {
    const bubblePop = findGame("bubble-pop");

    expect(bubblePop?.route).toBe("/games/bubble-pop");
    expect(bubblePop && resolveGameStabilityStatus(bubblePop)).toBe("archived");
    expect(bubblePop?.tags).toContain("hidden-from-menu");
    expect(groupGamesByCategory().flatMap((group) => group.games)).not.toContainEqual(bubblePop);
  });
});
