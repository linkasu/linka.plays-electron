import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import ttsAssets from "../../data/ttsAssets.json";
import {
  clockSpokenHour,
  formatClockHour,
  formatClockHourSpeech,
  generateClockRound,
  normalizeClockHour,
} from "./model";

describe("generateClockRound", () => {
  it("keeps all hours on the 12-hour clock", () => {
    expect(normalizeClockHour(0)).toBe(12);
    expect(normalizeClockHour(13)).toBe(1);
    expect(formatClockHour(15)).toBe("3:00");
    expect(formatClockHourSpeech(1)).toBe("один час");
    expect(formatClockHourSpeech(3)).toBe("3 часа");
    expect(formatClockHourSpeech(8)).toBe("8 часов");
  });

  it("keeps gentle rounds to two clock choices", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateClockRound(settings, index + 1, () => index / 100);

      expect(round.choices).toHaveLength(2);
      expect(round.choices).toContain(round.targetHour);
      expect(round.correctIndex).toBe(round.choices.indexOf(round.targetHour));
      expect(round.choices.every((hour) => hour >= 1 && hour <= 12)).toBe(true);
    }
  });

  it("keeps standard rounds to four unique clock choices", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateClockRound(settings, index + 1, () => index / 100);

      expect(round.choices).toHaveLength(4);
      expect(new Set(round.choices).size).toBe(4);
      expect(round.choices).toContain(round.targetHour);
      expect(round.correctIndex).toBe(round.choices.indexOf(round.targetHour));
      expect(round.prompt).toBe(`Выбери ${round.spokenHour}:00`);
      expect(formatClockHour(round.spokenHour)).toBe(formatClockHour(round.targetHour));
    }
  });

  it("uses random source for target hour and choice order", () => {
    const settings = settingsFromPreset("standard");
    const lowRandomRound = generateClockRound(settings, 1, () => 0);
    const highRandomRound = generateClockRound(settings, 1, () => 0.99);

    expect(lowRandomRound.targetHour).toBe(1);
    expect(highRandomRound.targetHour).toBe(12);
    expect(lowRandomRound.choices).not.toEqual(highRandomRound.choices);
  });
});

describe("afternoon hours", () => {
  it("names 13–23 for the same face in about half of the rounds", () => {
    expect(clockSpokenHour(2, true)).toBe(14);
    expect(clockSpokenHour(2, false)).toBe(2);
    expect(clockSpokenHour(12, true)).toBe(12);

    const settings = settingsFromPreset("standard");
    const spoken = Array.from(
      { length: 200 },
      (_, index) => generateClockRound(settings, index + 1).spokenHour,
    );
    expect(spoken.some((hour) => hour > 12)).toBe(true);
    expect(spoken.some((hour) => hour <= 12)).toBe(true);
    expect(spoken.every((hour) => hour >= 1 && hour <= 23)).toBe(true);
  });

  it("has a recorded task and answer for every hour from 1 to 23", () => {
    const ids = new Set(ttsAssets.map((asset) => asset.id));
    for (let hour = 1; hour <= 23; hour += 1) {
      expect(ids.has(`clock.prompt.${hour}`), `prompt ${hour}`).toBe(true);
      expect(ids.has(`clock.correct.${hour}`), `correct ${hour}`).toBe(true);
    }
  });
});
