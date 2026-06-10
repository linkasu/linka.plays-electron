import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateActionWhoRound } from "./model";

function expectValidRound(round: ReturnType<typeof generateActionWhoRound>) {
  const actionIds = round.choices.map((choice) => choice.action.id);
  const characterIds = round.choices.map((choice) => choice.character.id);

  expect(round.choices[round.correctIndex]).toBe(round.target);
  expect(round.target.action.id).toBe(round.targetAction.id);
  expect(round.prompt).toBe(round.targetAction.question);
  expect(actionIds).toContain(round.targetAction.id);
  expect(new Set(actionIds).size).toBe(round.choices.length);
  expect(new Set(characterIds).size).toBe(round.choices.length);
}

describe("generateActionWhoRound", () => {
  it("creates gentle rounds with two action choices", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 1; index <= 24; index += 1) {
      const round = generateActionWhoRound(settings, index);

      expectValidRound(round);
      expect(round.choices).toHaveLength(2);
    }
  });

  it("creates standard rounds with three action choices", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 24; index += 1) {
      const round = generateActionWhoRound(settings, index);

      expectValidRound(round);
      expect(round.choices).toHaveLength(3);
    }
  });

  it("creates challenge rounds with four action choices", () => {
    const settings = settingsFromPreset("challenge");

    for (let index = 1; index <= 24; index += 1) {
      const round = generateActionWhoRound(settings, index);

      expectValidRound(round);
      expect(round.choices).toHaveLength(4);
    }
  });

  it("keeps round ids stable for telemetry", () => {
    const round = generateActionWhoRound(settingsFromPreset("standard"), 8);

    expect(round.roundId).toBe("action-who:round:8");
  });
});
