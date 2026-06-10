import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { formatClockHour, generateClockRound, normalizeClockHour } from "./model";

describe("generateClockRound", () => {
  it("keeps all hours on the 12-hour clock", () => {
    expect(normalizeClockHour(0)).toBe(12);
    expect(normalizeClockHour(13)).toBe(1);
    expect(formatClockHour(15)).toBe("3:00");
  });

  it("keeps gentle rounds to two clock choices", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateClockRound(settings, index + 1);

      expect(round.choices).toHaveLength(2);
      expect(round.choices).toContain(round.targetHour);
      expect(round.correctIndex).toBe(round.choices.indexOf(round.targetHour));
      expect(round.choices.every((hour) => hour >= 1 && hour <= 12)).toBe(true);
    }
  });

  it("keeps standard rounds to four unique clock choices", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateClockRound(settings, index + 1);

      expect(round.choices).toHaveLength(4);
      expect(new Set(round.choices).size).toBe(4);
      expect(round.choices).toContain(round.targetHour);
      expect(round.correctIndex).toBe(round.choices.indexOf(round.targetHour));
      expect(round.prompt).toBe(`Выбери ${formatClockHour(round.targetHour)}`);
    }
  });
});
