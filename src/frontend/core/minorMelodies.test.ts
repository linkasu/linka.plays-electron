import { describe, expect, it } from "vitest";
import { notesToLoadForMinorMelodies, softMinorMelodies } from "./minorMelodies";

describe("minor melodies", () => {
  it("contains globally reusable soft minor melodies", () => {
    expect(softMinorMelodies.length).toBeGreaterThanOrEqual(4);
    expect(new Set(softMinorMelodies.map((melody) => melody.id)).size).toBe(softMinorMelodies.length);
  });

  it("keeps sampled and fallback melody shapes aligned", () => {
    for (const melody of softMinorMelodies) {
      expect(melody.sampled.length).toBe(melody.fallback.length);
      expect(melody.lengthSeconds).toBeGreaterThan(0);
    }
  });

  it("computes the shared preload note set", () => {
    expect(notesToLoadForMinorMelodies()).toContain(57);
    expect(notesToLoadForMinorMelodies()).toContain(58);
  });
});
