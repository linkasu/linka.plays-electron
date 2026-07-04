import { describe, expect, it } from "vitest";
import { carSize, createHighwayState, highwaySegments, laneCenter, highwayRoad, updateHighway, type HighwayState, type ViewportSize } from "./model";

const viewport: ViewportSize = { width: 1000, height: 700 };

function withGoalAtCar(state: HighwayState): HighwayState {
  const road = highwayRoad(viewport);
  return {
    ...state,
    car: { ...state.car, x: laneCenter(road, state.goal.lane), targetLane: state.goal.lane, lane: state.goal.lane },
    goal: { ...state.goal, y: state.car.y },
    obstacles: []
  };
}

function withObstacleAtCar(state: HighwayState): HighwayState {
  const road = highwayRoad(viewport);
  return {
    ...state,
    car: { ...state.car, x: laneCenter(road, 1), lane: 1, targetLane: 1 },
    obstacles: [{ id: "test-car", lane: 1, y: state.car.y, length: carSize(viewport), kind: "car" }]
  };
}

describe("smooth car highway model", () => {
  it("creates a four-lane running highway state", () => {
    const state = createHighwayState(viewport);

    expect(state.mode).toBe("running");
    expect(state.hull).toBe(3);
    expect(state.goal.id).toContain(highwaySegments[0].id);
    expect(state.obstacles.length).toBeGreaterThan(0);
  });

  it("selects a lane from horizontal input", () => {
    const road = highwayRoad(viewport);
    const result = updateHighway(createHighwayState(viewport), laneCenter(road, 3), 0.5, viewport);

    expect(result.state.car.targetLane).toBe(3);
    expect(result.state.car.x).toBeGreaterThan(laneCenter(road, 1));
  });

  it("records success when the car reaches the goal lane marker", () => {
    const result = updateHighway(withGoalAtCar(createHighwayState(viewport)), undefined, 0.02, viewport);

    expect(result.event.type).toBe("success");
    expect(result.state.segmentIndex).toBe(1);
  });

  it("damages the car on same-lane collision", () => {
    const result = updateHighway(withObstacleAtCar(createHighwayState(viewport)), undefined, 0.02, viewport);

    expect(result.event.type).toBe("damage");
    expect(result.state.hull).toBe(2);
  });

  it("crashes after repeated collisions", () => {
    let state = withObstacleAtCar(createHighwayState(viewport));
    for (let hit = 0; hit < 3; hit += 1) {
      const result = updateHighway({ ...state, invulnerableSeconds: 0 }, undefined, 0.02, viewport);
      state = withObstacleAtCar(result.state);
    }

    expect(state.mode).toBe("crashed");
    expect(state.hull).toBe(0);
  });
});
