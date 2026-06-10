import { describe, expect, it } from "vitest";
import { createDayRoutineBoard, dayRoutineItems, dayRoutinePeriods, findDayRoutinePeriod } from "./model";

describe("createDayRoutineBoard", () => {
  it("creates an eight-step day sequence ordered from morning to evening", () => {
    const board = createDayRoutineBoard(8);

    expect(board.items).toHaveLength(8);
    expect(board.items.map((item) => item.periodId)).toEqual([
      "morning",
      "morning",
      "morning",
      "day",
      "day",
      "day",
      "evening",
      "evening"
    ]);
  });

  it("keeps choices as the same cards as the ordered sequence", () => {
    const board = createDayRoutineBoard(8);

    expect(new Set(board.choices.map((item) => item.id))).toEqual(new Set(board.items.map((item) => item.id)));
    expect(board.choices).toHaveLength(board.items.length);
  });

  it("keeps stable period order and helpers", () => {
    expect(dayRoutinePeriods.map((period) => period.id)).toEqual(["morning", "day", "evening"]);
    expect(findDayRoutinePeriod("morning")?.helper).toContain("Сначала");
  });

  it("has enough unique vocabulary cards for the configured session", () => {
    expect(dayRoutineItems).toHaveLength(8);
    expect(new Set(dayRoutineItems.map((item) => item.id)).size).toBe(8);
    expect(dayRoutineItems.every((item) => item.label && item.hint && findDayRoutinePeriod(item.periodId))).toBe(true);
  });
});
