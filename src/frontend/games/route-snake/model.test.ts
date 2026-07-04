import { describe, expect, it } from "vitest";
import { routeSnakeOutcome, createRouteSnakeState, nextSnakeHead, pointsEqual, setSnakeDirection, stepSnake, type RouteSnakeState } from "./model";

function state(overrides: Partial<RouteSnakeState>): RouteSnakeState {
  return {
    width: 5,
    height: 5,
    snake: [{ row: 2, column: 2 }],
    direction: "right",
    food: { row: 0, column: 0 },
    lastEvent: "moved",
   ...overrides
  };
}

describe("calm snake model", () => {
  it("creates a centered snake with food inside the board", () => {
    const created = createRouteSnakeState(9, 9);

    expect(created.snake).toHaveLength(3);
    expect(created.direction).toBe("right");
    expect(created.food.row).toBeGreaterThanOrEqual(0);
    expect(created.food.row).toBeLessThan(created.height);
    expect(created.food.column).toBeGreaterThanOrEqual(0);
    expect(created.food.column).toBeLessThan(created.width);
    expect(created.snake.some((part) => pointsEqual(part, created.food))).toBe(false);
  });

  it("moves one calm step in the current direction", () => {
    const result = stepSnake(state({ snake: [{ row: 2, column: 2 }], direction: "right" }));

    expect(result.event).toBe("moved");
    expect(result.moved).toBe(true);
    expect(result.state.snake[0]).toEqual({ row: 2, column: 3 });
  });

  it("grows when the next step reaches food", () => {
    const result = stepSnake(state({ snake: [{ row: 2, column: 2 }, { row: 2, column: 1 }], direction: "right", food: { row: 2, column: 3 } }));

    expect(result.event).toBe("ate-food");
    expect(result.state.snake).toHaveLength(3);
    expect(result.state.snake[0]).toEqual({ row: 2, column: 3 });
    expect(result.state.snake.some((part) => pointsEqual(part, result.state.food))).toBe(false);
  });

  it("does not reverse into itself", () => {
    const current = state({ snake: [{ row: 2, column: 2 }, { row: 2, column: 1 }], direction: "right" });

    expect(setSnakeDirection(current, "left")).toBe(current);
    expect(stepSnake(current, "left").state.snake[0]).toEqual({ row: 2, column: 3 });
  });

  it("uses a gentle fallback when the next step reaches a wall", () => {
    const result = stepSnake(state({ snake: [{ row: 0, column: 4 }, { row: 0, column: 3 }], direction: "right" }));

    expect(result.event).toBe("blocked-wall");
    expect(result.moved).toBe(true);
    expect(routeSnakeOutcome(result)).toBe("playing");
  });

  it("stops safely when no fallback move is available", () => {
    const current = state({
      width: 3,
      height: 3,
      snake: [
        { row: 0, column: 0 },
        { row: 1, column: 0 },
        { row: 0, column: 1 },
        { row: 1, column: 1 }
      ],
      direction: "up"
    });

    const result = stepSnake(current);

    expect(result.event).toBe("blocked-wall");
    expect(result.moved).toBe(false);
    expect(result.state.snake).toEqual(current.snake);
    expect(routeSnakeOutcome(result)).toBe("loss");
  });

  it("calculates the next head without mutating input", () => {
    const head = { row: 3, column: 3 };

    expect(nextSnakeHead(head, "up")).toEqual({ row: 2, column: 3 });
    expect(head).toEqual({ row: 3, column: 3 });
  });
});
