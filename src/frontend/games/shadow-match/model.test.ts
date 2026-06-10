import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateShadowMatchRound } from "./model";

describe("shadow-match model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateShadowMatchRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in standard mode", () => {
    const round = generateShadowMatchRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the shadow target", () => {
    const round = generateShadowMatchRound(settingsFromPreset("challenge"), 6);

    expect(round.roundId).toBe("shadow-match:round:6");
    expect(round.choices[round.correctIndex]).toBe(round.target);
  });

  it("keeps the same icon for target and silhouette", () => {
    const round = generateShadowMatchRound(settingsFromPreset("standard"), 3);

    expect(round.target.icon).toBe(round.choices[round.correctIndex].icon);
    expect(round.target.hint.length).toBeGreaterThan(0);
  });

  it("varies targets across the eight-step session", () => {
    const targetIds = Array.from({ length: 8 }, (_, index) => generateShadowMatchRound(settingsFromPreset("standard"), index + 1).target.id);

    expect(new Set(targetIds).size).toBe(8);
  });
});
