import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateFindAnimalRound } from "./model";

function expectValidRound(round: ReturnType<typeof generateFindAnimalRound>) {
  const choiceIds = round.choices.map((choice) => choice.id);

  expect(round.target.category).toBe("animal");
  expect(round.choices[round.correctIndex]).toBe(round.target);
  expect(choiceIds).toContain(round.target.id);
  expect(new Set(choiceIds).size).toBe(round.choices.length);
  expect(round.choices.every((choice) => choice.category === "animal")).toBe(true);
  expect(round.prompt).toContain(round.target.word);
}

describe("generateFindAnimalRound", () => {
  it("creates gentle rounds with two or three animal choices", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 1; index <= 40; index += 1) {
      const round = generateFindAnimalRound(settings, index);

      expectValidRound(round);
      expect(round.choices.length).toBeGreaterThanOrEqual(2);
      expect(round.choices.length).toBeLessThanOrEqual(3);
    }
  });

  it("creates standard rounds with three to five animal choices", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 40; index += 1) {
      const round = generateFindAnimalRound(settings, index);

      expectValidRound(round);
      expect(round.choices.length).toBeGreaterThanOrEqual(3);
      expect(round.choices.length).toBeLessThanOrEqual(5);
    }
  });

  it("creates challenge rounds with four or five animal choices", () => {
    const settings = settingsFromPreset("challenge");

    for (let index = 1; index <= 40; index += 1) {
      const round = generateFindAnimalRound(settings, index);

      expectValidRound(round);
      expect(round.choices.length).toBeGreaterThanOrEqual(4);
      expect(round.choices.length).toBeLessThanOrEqual(5);
    }
  });

  it("keeps round ids stable for telemetry", () => {
    const round = generateFindAnimalRound(settingsFromPreset("standard"), 8);

    expect(round.roundId).toBe("find-animal:round:8");
  });
});
