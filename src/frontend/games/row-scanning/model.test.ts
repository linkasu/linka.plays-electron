import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateRowScanningRound } from "./model";

describe("row-scanning model", () => {
  it("uses a short row in gentle mode", () => {
    const round = generateRowScanningRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(4);
  });

  it("uses the longest supported row in challenge mode", () => {
    const round = generateRowScanningRound(settingsFromPreset("challenge"));

    expect(round.choices).toHaveLength(7);
  });

  it("keeps standard rows between four and seven objects", () => {
    for (let index = 1; index <= 12; index += 1) {
      const round = generateRowScanningRound(settingsFromPreset("standard"), index);

      expect(round.choices.length).toBeGreaterThanOrEqual(4);
      expect(round.choices.length).toBeLessThanOrEqual(7);
    }
  });

  it("includes the target once and points correctIndex to it", () => {
    const round = generateRowScanningRound(settingsFromPreset("standard"), 5);
    const ids = round.choices.map((choice) => choice.id);
    const targetMatches = ids.filter((id) => id === round.target.id);

    expect(round.roundId).toBe("row-scanning:round:5");
    expect(round.prompt).toBe(`Найди: ${round.target.label}`);
    expect(targetMatches).toHaveLength(1);
    expect(new Set(ids).size).toBe(round.choices.length);
    expect(round.choices[round.correctIndex]).toBe(round.target);
  });
});
