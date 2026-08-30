import { describe, expect, it } from "vitest";
import {
  boatRouteSegments,
  createBoatGameState,
  updateBoatGame,
  type BoatGameState,
  type ViewportSize,
} from "./model";

const viewport: ViewportSize = { width: 1000, height: 700 };

function withPassedStones(state: BoatGameState): BoatGameState {
  const hazard = state.hazards[0];
  return {
    ...state,
    boat: { ...state.boat, y: hazard.gapY },
    gate: { ...state.gate, x: state.boat.x - hazard.width },
    hazards: [{ ...hazard, x: state.boat.x - hazard.width }],
  };
}

function withStonesAtBoat(state: BoatGameState, insideGap: boolean): BoatGameState {
  const hazard = state.hazards[0];
  return {
    ...state,
    boat: { ...state.boat, y: insideGap ? hazard.gapY : hazard.gapY - hazard.gapHeight / 2 - 40 },
    gate: { ...state.gate, x: state.boat.x, y: hazard.gapY },
    hazards: [{ ...hazard, x: state.boat.x }],
  };
}

describe("boat model", () => {
  it("creates a running flappy-like stone route with hull", () => {
    const state = createBoatGameState(viewport);

    expect(state.mode).toBe("running");
    expect(state.hull).toBe(3);
    expect(state.gate.id).toContain(boatRouteSegments[0].id);
    expect(state.hazards).toHaveLength(1);
    expect(state.hazards[0].gapHeight).toBeGreaterThan(0);
  });

  it("records success after the boat passes a stone gap", () => {
    const result = updateBoatGame(
      withPassedStones(createBoatGameState(viewport)),
      undefined,
      0.02,
      viewport,
    );

    expect(result.event.type).toBe("success");
    expect(result.state.routeIndex).toBe(1);
  });

  it("keeps the boat safe inside the stone gap", () => {
    const result = updateBoatGame(
      withStonesAtBoat(createBoatGameState(viewport), true),
      undefined,
      0.02,
      viewport,
    );

    expect(result.event.type).toBe("none");
    expect(result.state.hull).toBe(3);
  });

  it("damages the boat when it touches a stone gate", () => {
    const result = updateBoatGame(
      withStonesAtBoat(createBoatGameState(viewport), false),
      undefined,
      0.02,
      viewport,
    );

    expect(result.event.type).toBe("damage");
    expect(result.state.hull).toBe(2);
  });

  it("crashes after repeated stone hits", () => {
    let state = withStonesAtBoat(createBoatGameState(viewport), false);

    for (let hit = 0; hit < 3; hit += 1) {
      const result = updateBoatGame(
        { ...state, invulnerableSeconds: 0 },
        undefined,
        0.02,
        viewport,
      );
      state = withStonesAtBoat(result.state, false);
    }

    expect(state.mode).toBe("crashed");
    expect(state.hull).toBe(0);
  });

  it("keeps one hull point in assisted mode", () => {
    const state = withStonesAtBoat(
      { ...createBoatGameState(viewport), hull: 1, invulnerableSeconds: 0 },
      false,
    );
    const result = updateBoatGame(state, state.boat.y, 0.02, viewport, 0.78, 1.35, false, false);

    expect(result.event.type).toBe("damage");
    expect(result.state.mode).toBe("running");
    expect(result.state.hull).toBe(1);
  });

  it("keeps every gate at least 150 pixels high at the required viewport", () => {
    const requiredViewport = { width: 800, height: 600 };
    const riverHeight =
      requiredViewport.height -
      Math.max(62, requiredViewport.height * 0.09) -
      Math.max(126, requiredViewport.height * 0.19);
    expect(
      Math.min(...boatRouteSegments.map((segment) => segment.gapHeight * riverHeight)),
    ).toBeGreaterThanOrEqual(150);
  });
});
