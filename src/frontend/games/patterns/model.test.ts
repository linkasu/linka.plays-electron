import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generatePatternRound, type PatternRound } from "./model";

function completedIds(round: PatternRound) {
  return [...round.sequence, round.answer].map((item) => item.id);
}

function expectAnswerContinuesPattern(round: PatternRound) {
  const ids = completedIds(round);

  if (round.patternKind === "ABAB") {
    expect(ids).toHaveLength(4);
    expect(ids[0]).toBe(ids[2]);
    expect(ids[1]).toBe(ids[3]);
    expect(ids[0]).not.toBe(ids[1]);
    return;
  }

  if (round.patternKind === "ABCABC") {
    expect(ids).toHaveLength(6);
    expect(ids[0]).toBe(ids[3]);
    expect(ids[1]).toBe(ids[4]);
    expect(ids[2]).toBe(ids[5]);
    expect(new Set(ids.slice(0, 3)).size).toBe(3);
    return;
  }

  expect(ids).toHaveLength(6);
  expect(ids[0]).toBe(ids[1]);
  expect(ids[0]).toBe(ids[3]);
  expect(ids[0]).toBe(ids[4]);
  expect(ids[2]).toBe(ids[5]);
  expect(ids[0]).not.toBe(ids[2]);
}

describe("generatePatternRound", () => {
  it("uses ABAB rounds with three unique choices in gentle mode", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generatePatternRound(settings, index + 1);
      const choiceIds = round.choices.map((choice) => choice.id);

      expect(round.patternKind).toBe("ABAB");
      expectAnswerContinuesPattern(round);
      expect(round.choices).toHaveLength(3);
      expect(new Set(choiceIds).size).toBe(3);
      expect(choiceIds).toContain(round.answer.id);
      expect(round.choices[round.correctIndex]).toBe(round.answer);
    }
  });

  it("uses standard patterns with four unique choices and includes the target", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generatePatternRound(settings, index + 1);
      const choiceIds = round.choices.map((choice) => choice.id);

      expect(["ABCABC", "AAB"]).toContain(round.patternKind);
      expectAnswerContinuesPattern(round);
      expect(round.choices).toHaveLength(4);
      expect(new Set(choiceIds).size).toBe(4);
      expect(choiceIds).toContain(round.answer.id);
      expect(round.choices[round.correctIndex]).toBe(round.answer);
    }
  });

  it("keeps the round id stable for telemetry", () => {
    const round = generatePatternRound(settingsFromPreset("standard"), 5);

    expect(round.roundId).toBe("patterns:round:5");
  });
});
