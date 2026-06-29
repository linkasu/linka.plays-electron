import { describe, expect, it } from "vitest";
import {
  arcLength,
  beatProgress,
  createOrchestraArcPoints,
  nextReachedBeat,
  orchestraConductorMaxBeats,
  pointAtArcProgress,
  projectPointToArc,
  sampleQuadraticArc
} from "./model";

describe("orchestra-conductor model", () => {
  it("creates a left-to-right conductor arc inside the viewport", () => {
    const points = createOrchestraArcPoints(1000, 700);
    const first = points[0];
    const middle = pointAtArcProgress(points, 0.5);
    const last = points[points.length - 1];

    expect(points.length).toBeGreaterThan(16);
    expect(first.x).toBeLessThan(middle.x);
    expect(last.x).toBeGreaterThan(middle.x);
    expect(middle.y).toBeLessThan(first.y);
    expect(middle.y).toBeLessThan(last.y);
    expect(arcLength(points)).toBeGreaterThan(800);
  });

  it("samples quadratic arc endpoints exactly", () => {
    const points = sampleQuadraticArc({ x: 10, y: 90 }, { x: 50, y: 10 }, { x: 90, y: 90 }, 8);

    expect(points[0]).toEqual({ x: 10, y: 90 });
    expect(points[points.length - 1]).toEqual({ x: 90, y: 90 });
  });

  it("projects points to monotonic arc progress", () => {
    const points = createOrchestraArcPoints(900, 600);
    const early = pointAtArcProgress(points, 0.25);
    const late = pointAtArcProgress(points, 0.75);

    expect(projectPointToArc(early, points).ratio).toBeCloseTo(0.25, 2);
    expect(projectPointToArc(late, points).ratio).toBeCloseTo(0.75, 2);
    expect(projectPointToArc(late, points).ratio).toBeGreaterThan(projectPointToArc(early, points).ratio);
  });

  it("maps beat thresholds evenly along the arc", () => {
    expect(orchestraConductorMaxBeats).toBe(8);
    expect(beatProgress(1)).toBeCloseTo(0.125);
    expect(beatProgress(4)).toBeCloseTo(0.5);
    expect(beatProgress(8)).toBe(1);
  });

  it("detects only the next reached beat", () => {
    expect(nextReachedBeat(0.1, 1)).toBeUndefined();
    expect(nextReachedBeat(0.125, 1)).toBe(1);
    expect(nextReachedBeat(0.49, 4)).toBe(4);
    expect(nextReachedBeat(1, 9)).toBeUndefined();
  });

  it("keeps the conductor arc usable in a compact viewport", () => {
    const points = createOrchestraArcPoints(800, 600);
    const first = points[0];
    const middle = pointAtArcProgress(points, 0.5);
    const last = points[points.length - 1];

    expect(first.x).toBeGreaterThanOrEqual(54);
    expect(last.x).toBeLessThanOrEqual(746);
    expect(middle.y).toBeGreaterThanOrEqual(132);
    expect(first.y).toBeLessThanOrEqual(488);
  });
});
