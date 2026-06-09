import { describe, expect, it } from "vitest";
import { softMajorMelodies } from "./majorMelodies";
import { softMinorMelodies } from "./minorMelodies";
import { notesToLoadForSoftTherapeuticMelodies, softTherapeuticMelodies } from "./softMelodies";

describe("soft therapeutic melodies", () => {
  it("combines major and minor melodies for gameplay rotation", () => {
    expect(softTherapeuticMelodies).toHaveLength(softMajorMelodies.length + softMinorMelodies.length);
    expect(softTherapeuticMelodies.some((melody) => melody.id.includes("minor"))).toBe(true);
  });

  it("keeps combined melody ids unique", () => {
    expect(new Set(softTherapeuticMelodies.map((melody) => melody.id)).size).toBe(softTherapeuticMelodies.length);
  });

  it("computes combined preload notes", () => {
    expect(notesToLoadForSoftTherapeuticMelodies()).toContain(58);
    expect(notesToLoadForSoftTherapeuticMelodies()).toContain(72);
  });
});
