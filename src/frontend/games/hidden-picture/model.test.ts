import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateHiddenPictureRound, hiddenPictureThemes } from "./model";

describe("hidden-picture model", () => {
  const settings = { ...settingsFromPreset("standard"), maxSteps: 8 };

  it("keeps one picture theme through an eight-step session", () => {
    const themeIds = Array.from({ length: 8 }, (_, index) => generateHiddenPictureRound(settings, index + 1).theme.id);

    expect(new Set(themeIds)).toEqual(new Set([hiddenPictureThemes[0].id]));
  });

  it("cycles target zones while keeping exactly one expected zone", () => {
    const rounds = Array.from({ length: 8 }, (_, index) => generateHiddenPictureRound(settings, index + 1));
    const zoneIds = rounds.map((round) => round.targetZone.id);

    expect(zoneIds.slice(0, 4)).toEqual(hiddenPictureThemes[0].zones.map((zone) => zone.id));
    expect(zoneIds.slice(4, 8)).toEqual(hiddenPictureThemes[0].zones.map((zone) => zone.id));
    for (const round of rounds) {
      expect(round.zones[round.correctIndex]).toBe(round.targetZone);
    }
  });

  it("moves to the next picture after the configured session length", () => {
    const nextRound = generateHiddenPictureRound(settings, 9);

    expect(nextRound.theme.id).toBe(hiddenPictureThemes[1].id);
    expect(nextRound.roundId).toBe("hidden-picture:round:9");
  });
});
