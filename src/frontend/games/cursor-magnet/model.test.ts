import { describe, expect, it } from "vitest";
import {
  createMagneticLabState,
  currentLevel,
  cycleMagnet,
  magneticForce,
  magneticLevels,
  magnetModeOrder,
  nextLevel,
  pointInWall,
  startSimulation,
  stepSimulation,
  stopSimulation,
  type MagneticLabState,
  type MagnetMode,
} from "./model";

function run(state: MagneticLabState, seconds: number) {
  let current = startSimulation(state);
  for (let elapsed = 0; elapsed < seconds && current.mode === "running"; elapsed += 0.02) {
    current = stepSimulation(current, 0.02).state;
  }
  return current;
}

function configuredLevel(levelIndex: number, modes: MagnetMode[]) {
  const state = createMagneticLabState(levelIndex);
  return {
    ...state,
    magnets: state.magnets.map((magnet, index) => ({ ...magnet, mode: modes[index] })),
  };
}

/** Every setting of a level's magnets. */
function allSettings(count: number): MagnetMode[][] {
  if (count === 0) return [[]];
  return allSettings(count - 1).flatMap((rest) => magnetModeOrder.map((mode) => [...rest, mode]));
}

const solutions: MagnetMode[][] = [
  ["pull"],
  ["push", "pull"],
  ["off", "off", "pull"],
  ["off", "off", "pull"],
  ["push", "pull", "off"],
  ["off", "off", "pull"],
  ["off", "off", "pull"],
  ["push", "off", "off", "pull"],
];

describe("magnetic lab model", () => {
  it("creates an editable level with the ball at its start", () => {
    const state = createMagneticLabState();

    expect(state.mode).toBe("editing");
    expect(state.magnets.length).toBeGreaterThan(0);
    expect(state.capsule).toMatchObject({ ...magneticLevels[0].start, vx: 0, vy: 0 });
  });

  it("a pulling magnet pulls the ball, a pushing one pushes it, an off one does nothing", () => {
    const ball = { x: 0.2, y: 0.5, vx: 0, vy: 0 };
    const magnet = { id: "m", x: 0.8, y: 0.5, strength: 2 as const };

    expect(magneticForce(ball, [{ ...magnet, mode: "pull" }]).x).toBeGreaterThan(0);
    expect(magneticForce(ball, [{ ...magnet, mode: "push" }]).x).toBeLessThan(0);
    expect(magneticForce(ball, [{ ...magnet, mode: "off" }])).toEqual({ x: 0, y: 0 });
  });

  it("looking at a magnet switches only that magnet: тянет → толкает → выключен", () => {
    let state = configuredLevel(1, ["pull", "pull"]);
    state = cycleMagnet(state, "beta");
    expect(state.magnets.map((magnet) => magnet.mode)).toEqual(["pull", "push"]);
    state = cycleMagnet(state, "beta");
    expect(state.magnets.map((magnet) => magnet.mode)).toEqual(["pull", "off"]);
    state = cycleMagnet(state, "beta");
    expect(state.magnets.map((magnet) => magnet.mode)).toEqual(["pull", "pull"]);
  });

  it("does not switch magnets while the ball rolls, and a switch after a try puts it back", () => {
    const running = startSimulation(createMagneticLabState(0));
    expect(cycleMagnet(running, "alpha")).toBe(running);

    const failed = run(createMagneticLabState(0), 10);
    expect(failed.mode).toBe("failed");
    const changed = cycleMagnet(failed, "alpha");
    expect(changed.mode).toBe("editing");
    expect(changed.capsule).toMatchObject(magneticLevels[0].start);
  });

  it("does not solve levels by only pressing start", () => {
    magneticLevels.forEach((level, index) => {
      const result = run(createMagneticLabState(index), 18);

      expect(result.mode, `level ${index + 1} ${level.id}`).not.toBe("success");
    });
  });

  it("has exactly one way to switch the magnets for every level, and the ball gets there soon", () => {
    expect(solutions).toHaveLength(magneticLevels.length);
    magneticLevels.forEach((level, index) => {
      const winning = allSettings(level.magnets.length).filter(
        (modes) => run(configuredLevel(index, modes), 18).mode === "success",
      );
      expect(winning, `level ${index + 1} ${level.id}`).toEqual([solutions[index]]);
      expect(run(configuredLevel(index, solutions[index]), 18).elapsedSeconds).toBeLessThan(9);
    });
  });

  it("fails when a pushing magnet throws the ball out of the field", () => {
    const result = run(configuredLevel(0, ["push"]), 10);

    expect(result.mode).toBe("failed");
    expect(result.failureReason).toBe("bounds");
  });

  it("stops a ball that does not move instead of waiting long", () => {
    const result = run(configuredLevel(0, ["off"]), 10);

    expect(result.mode).toBe("failed");
    expect(result.failureReason).toBe("stalled");
    expect(result.elapsedSeconds).toBeLessThan(4);
  });

  it("stops a running simulation back to editable start", () => {
    const running = stepSimulation(startSimulation(createMagneticLabState(0)), 0.2).state;
    const stopped = stopSimulation(running);

    expect(stopped.mode).toBe("editing");
    expect(stopped.capsule.vx).toBe(0);
    expect(stopped.capsule.x).toBe(createMagneticLabState(0).capsule.x);
  });

  it("wraps to another level and detects walls", () => {
    const next = nextLevel(createMagneticLabState(0));
    const level = currentLevel(nextLevel(next));

    expect(next.levelIndex).toBe(1);
    expect(pointInWall({ x: 0.45, y: 0.25 }, level.walls[0])).toBe(true);
  });
});
