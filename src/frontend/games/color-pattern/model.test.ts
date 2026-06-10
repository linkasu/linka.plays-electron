import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateColorPatternRound, type ColorPatternRound } from "./model";

function completedIds(round: ColorPatternRound) {
  return [...round.sequence, round.answer].map((color) => color.id);
}

function expectPatternContinues(round: ColorPatternRound) {
  const ids = completedIds(round);

  if (round.patternKind === "AB") {
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe(ids[2]);
    expect(ids[1]).toBe(ids[3]);
    expect(ids[0]).not.toBe(ids[1]);
    return;
  }

  if (round.patternKind === "ABC") {
    expect(ids).toHaveLength(6);
    expect(ids[0]).toBe(ids[3]);
    expect(ids[1]).toBe(ids[4]);
    expect(ids[2]).toBe(ids[5]);
    expect(new Set(ids.slice(0, 3)).size).toBe(3);
    return;
  }

  expect(ids).toHaveLength(6);
  expect(ids[0]).toBe(ids[3]);
  expect(ids[1]).toBe(ids[2]);
  expect(ids[1]).toBe(ids[4]);
  expect(ids[1]).toBe(ids[5]);
  expect(ids[0]).not.toBe(ids[1]);
}

describe("generateColorPatternRound", () => {
  it("cycles AB, ABC and ABB patterns by round index", () => {
    const settings = settingsFromPreset("standard");

    expect(generateColorPatternRound(settings, 1).patternKind).toBe("AB");
    expect(generateColorPatternRound(settings, 2).patternKind).toBe("ABC");
    expect(generateColorPatternRound(settings, 3).patternKind).toBe("ABB");
    expect(generateColorPatternRound(settings, 4).patternKind).toBe("AB");
  });

  it("generates a valid continuation and unique choices", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 30; index += 1) {
      const round = generateColorPatternRound(settings, index);
      const choiceIds = round.choices.map((choice) => choice.id);

      expectPatternContinues(round);
      expect(round.choices).toHaveLength(4);
      expect(new Set(choiceIds).size).toBe(4);
      expect(choiceIds).toContain(round.answer.id);
      expect(round.choices[round.correctIndex]).toBe(round.answer);
    }
  });

  it("uses three choices in gentle preset", () => {
    const round = generateColorPatternRound(settingsFromPreset("gentle"), 2);
    const choiceIds = round.choices.map((choice) => choice.id);

    expect(round.choices).toHaveLength(3);
    expect(new Set(choiceIds).size).toBe(3);
    expect(choiceIds).toContain(round.answer.id);
  });

  it("keeps a stable round id for telemetry", () => {
    const round = generateColorPatternRound(settingsFromPreset("standard"), 8);

    expect(round.roundId).toBe("color-pattern:round:8");
  });
});
