import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import {
  beatSeconds,
  joinTime,
  loopOffset,
  loopSeconds,
  nextStyleIndex,
  ponyMusicPath,
  ponyRoles,
  ponyStyles,
} from "./model";

// The rendered loops in public/: only the file names are needed, nothing is loaded.
const musicFiles = new Set(
  Object.keys(import.meta.glob("../../../../public/audio/music/pony-band/*/*.ogg")).map((path) =>
    path.replace(/^.*public\//, ""),
  ),
);

describe("pony band", () => {
  it("brings a pony in on the next beat of the music already playing", () => {
    const beat = 0.5;
    // The song started at 10 s; a pony chosen at 12.31 s comes in on the beat at 12.5 s.
    expect(joinTime(10, 12.31, beat)).toBeCloseTo(12.5);
    // Too close to a beat to schedule it in time: it waits for the next one.
    expect(joinTime(10, 12.48, beat)).toBeCloseTo(13);
    expect(joinTime(10, 12.46, beat)).toBeCloseTo(12.5);
    // Never waits longer than a beat (plus the scheduling lead).
    for (let now = 10; now < 30; now += 0.137) {
      const at = joinTime(10, now, beat);
      expect(at).toBeGreaterThanOrEqual(now);
      expect(at - now).toBeLessThanOrEqual(beat + 0.03 + 1e-9);
    }
  });

  it("starts a joining pony at the same place in the song as the others", () => {
    const style = ponyStyles[0];
    const loop = loopSeconds(style);
    expect(loopOffset(3.5, loop)).toBeCloseTo(3.5);
    expect(loopOffset(loop + 2, loop)).toBeCloseTo(2);
    expect(loopOffset(5 * loop, loop)).toBeCloseTo(0);
  });

  it("matches the rendered loops: same length for all six parts of a style", () => {
    const expected: Record<string, number> = {
      pop: 16,
      rock: 15.36,
      classic: 19.2,
      jazz: 16,
      lullaby: 18,
      disco: 16,
    };
    for (const style of ponyStyles) {
      expect(loopSeconds(style)).toBeCloseTo(expected[style.id]);
      expect(beatSeconds(style)).toBeGreaterThan(0);
      for (const role of ponyRoles) {
        expect(musicFiles.has(ponyMusicPath(style.id, role)), `${style.id}/${role}`).toBe(true);
      }
    }
  });

  it("the conductor goes through all styles and back to the first", () => {
    let index = 0;
    const seen = new Set<string>();
    for (let i = 0; i < ponyStyles.length; i += 1) {
      seen.add(ponyStyles[index].id);
      index = nextStyleIndex(index);
    }
    expect(seen.size).toBe(ponyStyles.length);
    expect(index).toBe(0);
  });

  it("has the voiced task and rules", () => {
    const ids = new Set(ttsAssets.map((asset) => asset.id));
    expect(ids.has("pony-band.prompt")).toBe(true);
    expect(ids.has("pony-band.rules")).toBe(true);
  });
});
