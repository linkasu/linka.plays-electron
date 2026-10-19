import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import {
  createDayRoutineBoard,
  dayRoutineAudioCues,
  dayRoutineItems,
  dayRoutinePeriods,
  dayRoutineQuestion,
  dayRoutineQuestionCueId,
  dayRoutineVisibleChoices,
  findDayRoutinePeriod,
} from "./model";

function createSequenceRandom(values: number[]) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

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
      "evening",
    ]);
  });

  it("keeps choices as the same cards as the ordered sequence", () => {
    const board = createDayRoutineBoard(8);

    expect(new Set(board.choices.map((item) => item.id))).toEqual(
      new Set(board.items.map((item) => item.id)),
    );
    expect(board.choices).toHaveLength(board.items.length);
  });

  it("supports injected random for deterministic choices", () => {
    const values = [0.11, 0.72, 0.34, 0.55, 0.93, 0.21, 0.48];
    const first = createDayRoutineBoard(8, createSequenceRandom(values));
    const second = createDayRoutineBoard(8, createSequenceRandom(values));

    expect(first.choices.map((item) => item.id)).toEqual(second.choices.map((item) => item.id));
  });

  it("keeps stable period order and helpers", () => {
    expect(dayRoutinePeriods.map((period) => period.id)).toEqual(["morning", "day", "evening"]);
    expect(findDayRoutinePeriod("morning")?.helper).toContain("Сначала");
  });

  it("uses the correct forms in period questions", () => {
    expect(dayRoutinePeriods.map(dayRoutineQuestion)).toEqual([
      "Что бывает утром?",
      "Что бывает днём?",
      "Что бывает вечером?",
    ]);
  });

  it("keeps runtime audio cues paired with their screen text", () => {
    const assetTextById = new Map(
      ttsAssets
        .filter((asset) => asset.game === "day-routine")
        .map((asset) => [asset.id, asset.text]),
    );

    expect(Object.values(dayRoutineAudioCues).map((cue) => cue.id)).toEqual([
      "day-routine.prompt",
      "day-routine.correct",
      "day-routine.mistake",
      "day-routine.complete",
    ]);
    for (const cue of Object.values(dayRoutineAudioCues))
      expect(assetTextById.get(cue.id)).toBe(cue.text);

    for (const period of dayRoutinePeriods)
      expect(assetTextById.get(dayRoutineQuestionCueId(period))).toBe(dayRoutineQuestion(period));
  });

  it("has enough unique vocabulary cards for the configured session", () => {
    expect(dayRoutineItems).toHaveLength(8);
    expect(new Set(dayRoutineItems.map((item) => item.id)).size).toBe(8);
    expect(
      dayRoutineItems.every(
        (item) => item.label && item.hint && findDayRoutinePeriod(item.periodId),
      ),
    ).toBe(true);
    expect(dayRoutineItems.map((item) => item.imageId)).toEqual([
      "clock",
      "soap",
      "porridge",
      "toy",
      "tree",
      "soup",
      "plate",
      "bed",
    ]);
  });
});

describe("dayRoutineVisibleChoices", () => {
  const board = createDayRoutineBoard(8);
  const ids = (items: { id: string }[]) => items.map((item) => item.id);

  it("shows one row of four cards with every remaining card of the current period", () => {
    const shown = dayRoutineVisibleChoices(board.choices, [], "morning");
    const morning = board.items.filter((item) => item.periodId === "morning");

    expect(shown).toHaveLength(4);
    expect(ids(shown)).toEqual(expect.arrayContaining(ids(morning)));
  });

  it("keeps the shuffled order and hides placed cards", () => {
    const placed = [board.items[0].id];
    const shown = dayRoutineVisibleChoices(board.choices, placed, "morning");
    const order = ids(board.choices);

    expect(ids(shown)).not.toContain(placed[0]);
    expect(ids(shown).map((id) => order.indexOf(id))).toEqual(
      ids(shown)
        .map((id) => order.indexOf(id))
        .sort((a, b) => a - b),
    );
  });

  it("can always finish: the last cards of a period stay visible", () => {
    const placed = ids(board.items.slice(0, 6));
    const shown = dayRoutineVisibleChoices(board.choices, placed, "evening");

    expect(ids(shown).sort()).toEqual(ids(board.items.slice(6)).sort());
  });
});
