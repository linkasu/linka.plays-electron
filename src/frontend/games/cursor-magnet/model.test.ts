import { describe, expect, it } from "vitest";
import { createMagneticLabState, currentLevel, cycleSelectedStrength, magneticForce, magneticLevels, nextLevel, pointInWall, selectMagnet, setSelectedPole, startSimulation, stepSimulation, stopSimulation, type MagneticLabState, type MagneticPole } from "./model";

function run(state: MagneticLabState, seconds: number) {
  let current = startSimulation(state);
  for (let elapsed = 0; elapsed < seconds && current.mode === "running"; elapsed += 0.02) {
    current = stepSimulation(current, 0.02).state;
  }
  return current;
}

function configuredLevel(levelIndex: number, config: { pole: MagneticPole; strength: 0 | 1 | 2 }[]) {
  const state = createMagneticLabState(levelIndex);
  return {
   ...state,
    magnets: state.magnets.map((magnet, index) => ({ ...magnet, ...config[index] }))
  };
}

describe("magnetic lab model", () => {
  it("creates an editable level with a selected magnet", () => {
    const state = createMagneticLabState();

    expect(state.mode).toBe("editing");
    expect(state.magnets.length).toBeGreaterThan(0);
    expect(state.selectedMagnetId).toBe(state.magnets[0].id);
    expect(state.capsule.vx).toBe(0);
  });

  it("attracts the positive capsule to a negative charge", () => {
    const force = magneticForce({ x: 0.2, y: 0.5, vx: 0, vy: 0, pole: "positive" }, [{ id: "m", label: "M", x: 0.8, y: 0.5, pole: "negative", strength: 2 }]);

    expect(force.x).toBeGreaterThan(0);
    expect(Math.abs(force.y)).toBeLessThan(0.001);
  });

  it("repels the positive capsule from a positive charge", () => {
    const force = magneticForce({ x: 0.2, y: 0.5, vx: 0, vy: 0, pole: "positive" }, [{ id: "m", label: "M", x: 0.8, y: 0.5, pole: "positive", strength: 2 }]);

    expect(force.x).toBeLessThan(0);
  });

  it("changes only the selected magnet", () => {
    const selected = selectMagnet(createMagneticLabState(1), "beta");
    const changed = setSelectedPole(selected, "positive");
    const cycled = cycleSelectedStrength(changed);

    expect(changed.magnets.find((magnet) => magnet.id === "beta")?.pole).toBe("positive");
    expect(cycled.magnets.find((magnet) => magnet.id === "beta")?.strength).toBe(0);
    expect(cycled.magnets.find((magnet) => magnet.id === "alpha")?.pole).toBe("negative");
  });

  it("can complete the first level with a configured negative charge", () => {
    const result = run(configuredLevel(0, [{ pole: "negative", strength: 2 }]), 10);

    expect(result.mode).toBe("success");
  });

  it("does not solve levels by only pressing start", () => {
    magneticLevels.forEach((level, index) => {
      const result = run(createMagneticLabState(index), 18);

      expect(result.mode, `level ${index + 1} ${level.id}`).not.toBe("success");
    });
  });

  it("has a playable solution for every lab contour", () => {
    const solutions = [
      [{ pole: "negative", strength: 2 }],
      [{ pole: "positive", strength: 2 }, { pole: "negative", strength: 2 }],
      [{ pole: "positive", strength: 0 }, { pole: "positive", strength: 0 }, { pole: "negative", strength: 2 }],
      [{ pole: "positive", strength: 0 }, { pole: "positive", strength: 0 }, { pole: "negative", strength: 2 }],
      [{ pole: "positive", strength: 2 }, { pole: "negative", strength: 2 }, { pole: "positive", strength: 0 }],
      [{ pole: "positive", strength: 0 }, { pole: "positive", strength: 0 }, { pole: "negative", strength: 2 }],
      [{ pole: "positive", strength: 0 }, { pole: "positive", strength: 0 }, { pole: "negative", strength: 2 }],
      [{ pole: "positive", strength: 2 }, { pole: "positive", strength: 0 }, { pole: "negative", strength: 1 }, { pole: "negative", strength: 2 }]
    ] satisfies { pole: MagneticPole; strength: 0 | 1 | 2 }[][];

    expect(solutions).toHaveLength(magneticLevels.length);
    solutions.forEach((solution, index) => {
      const result = run(configuredLevel(index, solution), 18);

      expect(result.mode, `level ${index + 1} ${magneticLevels[index].id}`).toBe("success");
    });
  });

  it("fails when a strong wrong pole pushes the capsule out of bounds", () => {
    const state = setSelectedPole(createMagneticLabState(0), "positive");
    const result = run(state, 10);

    expect(result.mode).toBe("failed");
    expect(result.failureReason).toBe("bounds");
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
