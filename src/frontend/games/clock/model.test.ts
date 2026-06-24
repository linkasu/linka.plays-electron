import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { formatClockHour, formatClockHourSpeech, generateClockRound, normalizeClockHour } from "./model";

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
      expect(round.prompt).toBe(`Выбери ${formatClockHour(round.targetHour)}`);
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
