import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { calendarRelativeDays, generateCalendarRound, getRelativeWeekday, wrapWeekdayIndex } from "./model";

describe("generateCalendarRound", () => {
  it("wraps weekdays through the start and end of the week", () => {
    expect(wrapWeekdayIndex(-1)).toBe(6);
    expect(wrapWeekdayIndex(7)).toBe(0);
    expect(getRelativeWeekday("monday", "yesterday")?.id).toBe("sunday");
    expect(getRelativeWeekday("sunday", "tomorrow")?.id).toBe("monday");
  });

  it("creates weekday-choice rounds with the correct weekday in the choices", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 8; index += 2) {
      const round = generateCalendarRound(settings, index, () => 0);

      expect(round.taskKind).toBe("weekday");
      expect(round.choices).toHaveLength(4);
      expect(round.choices.map((choice) => choice.id)).toContain(round.correctChoiceId);
      expect(round.correctIndex).toBe(round.choices.findIndex((choice) => choice.id === round.correctChoiceId));
      expect(round.correctChoiceId).toBe(`weekday:${round.targetDay.id}`);
      expect(round.promptId).toBe(`${round.taskKind}.${round.today.id}.${round.targetRelative.id}`);
    }
  });

  it("creates relative rounds with yesterday today and tomorrow cards", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 2; index <= 8; index += 2) {
      const round = generateCalendarRound(settings, index, () => 0);

      expect(round.taskKind).toBe("relative");
      expect(round.choices.map((choice) => choice.relativeId).sort()).toEqual(calendarRelativeDays.map((day) => day.id).sort());
      expect(round.correctChoiceId).toBe(`relative:${round.targetRelative.id}`);
      expect(round.correctIndex).toBe(round.choices.findIndex((choice) => choice.id === round.correctChoiceId));
      expect(round.choices.every((choice) => choice.sublabel)).toBe(true);
    }
  });

  it("keeps gentle weekday rounds to three large cards", () => {
    const settings = settingsFromPreset("gentle");
    const round = generateCalendarRound(settings, 1, () => 0);

    expect(round.taskKind).toBe("weekday");
    expect(round.choices).toHaveLength(3);
    expect(new Set(round.choices.map((choice) => choice.id)).size).toBe(3);
    expect(round.choices.map((choice) => choice.id)).toContain(round.correctChoiceId);
  });

  it("cycles prompts without repeating early rounds", () => {
    const settings = settingsFromPreset("standard");
    const promptIds = Array.from({ length: 8 }, (_, index) => generateCalendarRound(settings, index + 1, () => 0).promptId);

    expect(new Set(promptIds).size).toBe(promptIds.length);
  });
});
