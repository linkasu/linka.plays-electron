import { describe, expect, it } from "vitest";
import { notesToLoadForMajorMelodies, softMajorMelodies } from "./majorMelodies";

describe("major melodies", () => {
  it("contains globally reusable soft major melodies", () => {
    expect(softMajorMelodies.length).toBeGreaterThanOrEqual(4);
    expect(new Set(softMajorMelodies.map((melody) => melody.id)).size).toBe(softMajorMelodies.length);
  });

  it("keeps sampled and fallback melody shapes aligned", () => {
    for (const melody of softMajorMelodies) {
      expect(melody.sampled.length).toBe(melody.fallback.length);
      expect(melody.lengthSeconds).toBeGreaterThan(0);
    }
  });

  it("computes the shared preload note set", () => {
    expect(notesToLoadForMajorMelodies()).toContain(60);
    expect(notesToLoadForMajorMelodies()).toContain(72);
  });
});
