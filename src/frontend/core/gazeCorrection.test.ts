import { describe, expect, it } from "vitest";
import {
  applyGazeCorrection,
  correctionFitsWindow,
  fitGazeCorrection,
  type GazeCorrectionPoint,
} from "./gazeCorrection";

const viewport = { width: 1920, height: 991 };
const fractions = [0.12, 0.5, 0.88];
const targets = fractions.flatMap((fy) =>
  fractions.map((fx) => ({ x: fx * viewport.width, y: fy * viewport.height })),
);

// Like our Tobii 5 after calibration: drifts right towards the right edge
// (about 4 % of the width) and sits about 25 px above the point looked at.
function trackerMiss(point: { x: number; y: number }) {
  return { x: point.x * 1.04 + 5, y: point.y - 25 };
}

function measure(miss: (point: { x: number; y: number }) => { x: number; y: number }) {
  return targets.map((target): GazeCorrectionPoint => ({ target, measured: miss(target) }));
}

describe("gaze correction", () => {
  it("undoes a tracker that drifts right and up", () => {
    const fit = fitGazeCorrection(measure(trackerMiss), viewport);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    expect(fit.correction.errorBeforePx).toBeGreaterThan(40);
    expect(fit.correction.errorAfterPx).toBeLessThan(1);

    const lookedAt = { x: 1500, y: 300 };
    const corrected = applyGazeCorrection(fit.correction, trackerMiss(lookedAt), viewport);
    expect(corrected.x).toBeCloseTo(lookedAt.x, 3);
    expect(corrected.y).toBeCloseTo(lookedAt.y, 3);
  });

  it("keeps working when the window is resized", () => {
    const fit = fitGazeCorrection(
      measure((p) => ({ x: p.x + 40, y: p.y })),
      viewport,
    );
    if (!fit.ok) throw new Error(fit.reason);
    const small = { width: 1280, height: 720 };
    // 40 px in a 1920 px window is the same share of a 1280 px window.
    const corrected = applyGazeCorrection(
      fit.correction,
      { x: 640 + 40 * (1280 / 1920), y: 360 },
      small,
    );
    expect(corrected.x).toBeCloseTo(640, 3);
  });

  it("refuses to fit on too few points", () => {
    const fit = fitGazeCorrection(measure(trackerMiss).slice(0, 4), viewport);
    expect(fit.ok).toBe(false);
  });

  it("refuses a correction that would flip or jump the gaze", () => {
    const fit = fitGazeCorrection(
      measure((p) => ({ x: viewport.width - p.x, y: p.y })),
      viewport,
    );
    expect(fit.ok).toBe(false);
  });

  it("refuses a correction that does not help", () => {
    const fit = fitGazeCorrection(
      measure((p) => p),
      viewport,
    );
    expect(fit.ok).toBe(false);
  });

  it("leaves the point alone without a correction", () => {
    expect(applyGazeCorrection(undefined, { x: 10, y: 20 }, viewport)).toEqual({ x: 10, y: 20 });
  });
});

describe("gaze correction window", () => {
  const measured = { x: 0, y: 0, width: 1920, height: 991 };

  it("holds in the window it was measured in", () => {
    expect(correctionFitsWindow(measured, { ...measured, x: 1 })).toBe(true);
  });

  it("stops holding after the window is resized or moved", () => {
    expect(correctionFitsWindow(measured, { ...measured, width: 1280 })).toBe(false);
    expect(correctionFitsWindow(measured, { ...measured, x: 300 })).toBe(false);
  });

  it("keeps an older correction without a window", () => {
    expect(correctionFitsWindow(undefined, measured)).toBe(true);
  });
});
