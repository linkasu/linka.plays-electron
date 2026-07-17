import { describe, expect, it } from "vitest";
import {
  advanceLeavesWindTarget,
  isLeavesWindGazeInput,
  isLeavesWindTargetHit,
  leavesWindMotionPoint,
  leavesWindSceneBounds,
  leavesWindTargetBounds,
  leavesWindTargetPoint,
  leavesWindTargetRadius
} from "./model";

describe("leaves wind model", () => {
  it.each([
    [800, 600],
    [1600, 900]
  ])("keeps every scaled target fully inside the playable scene at %ix%i", (width, height) => {
    const scene = leavesWindSceneBounds(width, height);

    for (const targetScale of [0.8, 1.5, 2]) {
      const radius = leavesWindTargetRadius(width, height, targetScale);
      const bounds = leavesWindTargetBounds(width, height, radius);
      expect(radius * 2).toBeGreaterThanOrEqual(180);
      for (let sequence = 0; sequence < 16; sequence += 1) {
        const point = leavesWindTargetPoint(bounds, sequence);
        expect(point.x - radius).toBeGreaterThanOrEqual(scene.left);
        expect(point.x + radius).toBeLessThanOrEqual(scene.right);
        expect(point.y - radius).toBeGreaterThanOrEqual(scene.top);
        expect(point.y + radius).toBeLessThanOrEqual(scene.bottom);
      }
    }
  });

  it("scales the effective target and contracts its center bounds", () => {
    const smallRadius = leavesWindTargetRadius(800, 600, 0.8);
    const largeRadius = leavesWindTargetRadius(800, 600, 2);
    const smallBounds = leavesWindTargetBounds(800, 600, smallRadius);
    const largeBounds = leavesWindTargetBounds(800, 600, largeRadius);

    expect(largeRadius).toBeGreaterThan(smallRadius);
    expect(largeBounds.left).toBeGreaterThan(smallBounds.left);
    expect(largeBounds.top).toBeGreaterThan(smallBounds.top);
    expect(largeBounds.right).toBeLessThan(smallBounds.right);
    expect(largeBounds.bottom).toBeLessThan(smallBounds.bottom);
  });

  it("moves toward the destination at the configured speed without leaving bounds", () => {
    const bounds = { left: 100, top: 100, right: 700, bottom: 500 };
    const slow = advanceLeavesWindTarget({
      current: { x: 200, y: 200 },
      destination: { x: 900, y: 700 },
      bounds,
      deltaSeconds: 1,
      motionSpeed: 0.5,
      reduceMotion: false
    });
    const fast = advanceLeavesWindTarget({
      current: { x: 200, y: 200 },
      destination: { x: 900, y: 700 },
      bounds,
      deltaSeconds: 1,
      motionSpeed: 1,
      reduceMotion: false
    });

    expect(Math.hypot(fast.x - 200, fast.y - 200)).toBeGreaterThan(Math.hypot(slow.x - 200, slow.y - 200));
    expect(fast.x).toBeGreaterThanOrEqual(bounds.left);
    expect(fast.x).toBeLessThanOrEqual(bounds.right);
    expect(fast.y).toBeGreaterThanOrEqual(bounds.top);
    expect(fast.y).toBeLessThanOrEqual(bounds.bottom);
  });

  it("keeps gentle pursuit motion inside scaled target bounds", () => {
    const radius = leavesWindTargetRadius(800, 600, 2);
    const bounds = leavesWindTargetBounds(800, 600, radius);
    const anchor = leavesWindTargetPoint(bounds, 1);

    for (let elapsedSeconds = 0; elapsedSeconds <= 120; elapsedSeconds += 0.5) {
      const point = leavesWindMotionPoint(anchor, bounds, elapsedSeconds, 1);
      expect(point.x).toBeGreaterThanOrEqual(bounds.left);
      expect(point.x).toBeLessThanOrEqual(bounds.right);
      expect(point.y).toBeGreaterThanOrEqual(bounds.top);
      expect(point.y).toBeLessThanOrEqual(bounds.bottom);
    }
  });

  it.each([
    [800, 600],
    [1600, 900]
  ])("moves the next target away from a stationary previous gaze at %ix%i", (width, height) => {
    const radius = leavesWindTargetRadius(width, height, 2);
    const bounds = leavesWindTargetBounds(width, height, radius);

    for (let sequence = 0; sequence < 7; sequence += 1) {
      const previous = leavesWindTargetPoint(bounds, sequence);
      const next = leavesWindTargetPoint(bounds, sequence + 1);
      expect(isLeavesWindTargetHit(previous, next, radius)).toBe(false);
    }
  });

  it("snaps between stable targets instead of animating in reduced-motion mode", () => {
    const bounds = { left: 100, top: 100, right: 700, bottom: 500 };
    expect(advanceLeavesWindTarget({
      current: { x: 200, y: 200 },
      destination: { x: 600, y: 400 },
      bounds,
      deltaSeconds: 0.016,
      motionSpeed: 0.4,
      reduceMotion: true
    })).toEqual({ x: 600, y: 400 });
  });

  it("accepts only points inside the single flow target", () => {
    const target = { x: 400, y: 300 };
    expect(isLeavesWindTargetHit({ x: 490, y: 300 }, target, 90)).toBe(true);
    expect(isLeavesWindTargetHit({ x: 491, y: 300 }, target, 90)).toBe(false);
  });

  it("uses Tobii samples for dwell and leaves mouse input to the click fallback", () => {
    expect(isLeavesWindGazeInput({ valid: true, source: "tobii" })).toBe(true);
    expect(isLeavesWindGazeInput({ valid: true, source: "mouse" })).toBe(false);
    expect(isLeavesWindGazeInput({ valid: false, source: "tobii" })).toBe(false);
  });
});
