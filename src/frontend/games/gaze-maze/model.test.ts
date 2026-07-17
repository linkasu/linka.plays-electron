import { describe, expect, it } from "vitest";
import { mazeNeighborIds, resolveAdjacentMazeTarget, type MazeLevel, type MazeNode } from "./model";

const level: MazeLevel = {
  id: "test",
  title: "Test",
  startId: "current",
  exitId: "far",
  nodes: [
    { id: "current", label: "Current", x: 0, y: 0 },
    { id: "left", label: "Left", x: 0, y: 0 },
    { id: "right", label: "Right", x: 0, y: 0 },
    { id: "far", label: "Far", x: 0, y: 0 }
  ],
  edges: [["current", "left"], ["current", "right"], ["left", "far"]]
};

function geometry(node: MazeNode) {
  const centers: Record<string, { x: number; y: number }> = {
    current: { x: 0, y: 0 },
    left: { x: 8, y: 0 },
    right: { x: 12, y: 0 },
    far: { x: 10, y: 0 }
  };
  return { center: centers[node.id], hitRadius: 20 };
}

describe("gaze-maze model", () => {
  it("treats graph edges as bidirectional", () => {
    expect(mazeNeighborIds(level, "current")).toEqual(["left", "right"]);
    expect(mazeNeighborIds(level, "left")).toEqual(["current", "far"]);
  });

  it("considers only neighbors of the current node", () => {
    expect(resolveAdjacentMazeTarget(level, "current", { x: 10, y: 0 }, geometry)?.id).toBe("left");
  });

  it("chooses the nearest adjacent target when hit areas overlap", () => {
    expect(resolveAdjacentMazeTarget(level, "current", { x: 11, y: 0 }, geometry)?.id).toBe("right");
  });

  it("returns no target outside adjacent hit areas", () => {
    expect(resolveAdjacentMazeTarget(level, "current", { x: 40, y: 0 }, geometry)).toBeUndefined();
  });
});
