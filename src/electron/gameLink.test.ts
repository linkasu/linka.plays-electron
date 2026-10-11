import { describe, expect, it } from "vitest";
import { gameIdFromArguments } from "./gameLink";

describe("gameIdFromArguments", () => {
  it("accepts only one game ID from the application protocol", () => {
    expect(gameIdFromArguments(["Linka Play.exe", "linka-play://game/space-orbit"])).toBe(
      "space-orbit",
    );
    for (const value of [
      "https://example.com/games/space-orbit",
      "linka-play://game/../settings",
      "linka-play://game/space-orbit/other",
      "linka-play://game/space%2Forbit",
      "linka-play://game/space-orbit?from=web",
      "linka-play://evil/space-orbit",
    ]) {
      expect(gameIdFromArguments(["Linka Play.exe", value])).toBeUndefined();
    }
  });
});
