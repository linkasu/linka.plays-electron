import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateTangramRound, tangramFigures } from "./model";

describe("tangram model", () => {
  it("uses three large choices in gentle mode", () => {
    const round = generateTangramRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices outside gentle mode", () => {
    const round = generateTangramRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the silhouette target", () => {
    const round = generateTangramRound(settingsFromPreset("challenge"), 5);

    expect(round.roundId).toBe("tangram:round:5");
    expect(round.prompt).toBe("Какая фигура подходит к силуэту?");
    expect(round.choices[round.correctIndex]).toBe(round.target);
  });

  it("provides complete seven-piece tangram figures", () => {
    tangramFigures.forEach((figure) => {
      expect(figure.pieces).toHaveLength(7);
      expect(figure.hint.length).toBeGreaterThan(0);
      expect(figure.category.length).toBeGreaterThan(0);
    });
  });

  it("varies silhouettes across the eight-step session", () => {
    const targetIds = Array.from({ length: 8 }, (_, index) => generateTangramRound(settingsFromPreset("standard"), index + 1).target.id);

    expect(new Set(targetIds).size).toBe(8);
  });
});
