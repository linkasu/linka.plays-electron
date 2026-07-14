import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DWELL_MS,
  MAX_DWELL_MS,
  MIN_DWELL_MS,
  normalizeDwellMs,
  persistDwellMs,
  resolveDwellMs,
  setDwellMs
} from "./dwellSettings";

describe("dwell settings", () => {
  beforeEach(() => {
    setDwellMs(DEFAULT_DWELL_MS);
  });

  it("normalizes values to the supported range and step", () => {
    expect(normalizeDwellMs(480)).toBe(MIN_DWELL_MS);
    expect(normalizeDwellMs(774)).toBe(750);
    expect(normalizeDwellMs(776)).toBe(800);
    expect(normalizeDwellMs(1600)).toBe(MAX_DWELL_MS);
    expect(normalizeDwellMs("invalid")).toBe(DEFAULT_DWELL_MS);
  });

  it("updates and persists the active dwell", () => {
    const values = new Map<string, string>();
    setDwellMs(925);
    persistDwellMs(resolveDwellMs(), { setItem: (key, value) => values.set(key, value) });

    expect(resolveDwellMs()).toBe(950);
    expect(values.get("linka-gaze-dwell-ms")).toBe("950");
  });
});
