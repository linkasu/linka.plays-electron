export type SnakeDirection = "up" | "right" | "down" | "left";

export type SnakePoint = {
  row: number;
  column: number;
};

export type RouteSnakeStepEvent = "moved" | "ate-food" | "blocked-wall" | "blocked-self";

export type RouteSnakeState = {
  width: number;
  height: number;
  snake: SnakePoint[];
  direction: SnakeDirection;
  food: SnakePoint;
  lastEvent: RouteSnakeStepEvent;
};

export type RouteSnakeStepResult = {
  state: RouteSnakeState;
  event: RouteSnakeStepEvent;
  moved: boolean;
};
export type RouteSnakeOutcome = "playing" | "loss";

const directionDeltas: Record<SnakeDirection, SnakePoint> = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 }
};

const directions: SnakeDirection[] = ["up", "right", "down", "left"];

export function createRouteSnakeState(width = 9, height = 9): RouteSnakeState {
  const centerRow = Math.floor(height / 2);
  const centerColumn = Math.floor(width / 2);
  const snake = [
    { row: centerRow, column: centerColumn },
    { row: centerRow, column: centerColumn - 1 },
    { row: centerRow, column: centerColumn - 2 }
  ];

  return {
    width,
    height,
    snake,
    direction: "right",
    food: placeFood(width, height, snake, { row: centerRow, column: centerColumn + 2 }),
    lastEvent: "moved"
  };
}

export function setSnakeDirection(state: RouteSnakeState, direction: SnakeDirection): RouteSnakeState {
  if (state.snake.length > 1 && isOpposite(state.direction, direction)) return state;
  return { ...state, direction };
}

export function nextSnakeHead(head: SnakePoint, direction: SnakeDirection): SnakePoint {
  const delta = directionDeltas[direction];
  return { row: head.row + delta.row, column: head.column + delta.column };
}

export function stepSnake(state: RouteSnakeState, requestedDirection = state.direction): RouteSnakeStepResult {
  const direction = state.snake.length > 1 && isOpposite(state.direction, requestedDirection) ? state.direction : requestedDirection;
  const firstTry = evaluateMove(state, direction);
  if (firstTry.safe) return applyMove(state, direction, "moved");

  const safeDirection = gentleFallbackDirections(direction, state.direction).find((candidate) => evaluateMove(state, candidate).safe);
  if (!safeDirection) {
    const event = firstTry.reason === "wall" ? "blocked-wall" : "blocked-self";
    return { state: { ...state, lastEvent: event }, event, moved: false };
  }

  const event = firstTry.reason === "wall" ? "blocked-wall" : "blocked-self";
  const moved = applyMove(state, safeDirection, event);
  return { ...moved, event };
}

export function pointsEqual(a: SnakePoint, b: SnakePoint) {
  return a.row === b.row && a.column === b.column;
}

export function routeSnakeOutcome(result: RouteSnakeStepResult): RouteSnakeOutcome {
  return !result.moved && (result.event === "blocked-wall" || result.event === "blocked-self") ? "loss" : "playing";
}

function applyMove(state: RouteSnakeState, direction: SnakeDirection, event: RouteSnakeStepEvent): RouteSnakeStepResult {
  const head = nextSnakeHead(state.snake[0], direction);
  const ateFood = pointsEqual(head, state.food);
  const nextSnake = ateFood ? [head, ...state.snake] : [head, ...state.snake.slice(0, -1)];
  const nextEvent = ateFood ? "ate-food" : event;
  const nextState = {
   ...state,
    snake: nextSnake,
    direction,
    food: ateFood ? placeFood(state.width, state.height, nextSnake, state.food) : state.food,
    lastEvent: nextEvent
  };

  return { state: nextState, event: nextEvent, moved: true };
}

function evaluateMove(state: RouteSnakeState, direction: SnakeDirection) {
  const head = nextSnakeHead(state.snake[0], direction);
  if (head.row < 0 || head.row >= state.height || head.column < 0 || head.column >= state.width) return { safe: false, reason: "wall" as const };

  const grows = pointsEqual(head, state.food);
  const body = grows ? state.snake : state.snake.slice(0, -1);
  if (body.some((part) => pointsEqual(part, head))) return { safe: false, reason: "self" as const };
  return { safe: true, reason: undefined };
}

function placeFood(width: number, height: number, snake: SnakePoint[], after: SnakePoint): SnakePoint {
  const total = width * height;
  const startIndex = pointIndex(after, width);

  for (let offset = 1; offset <= total; offset += 1) {
    const index = (startIndex + offset) % total;
    const candidate = { row: Math.floor(index / width), column: index % width };
    if (!snake.some((part) => pointsEqual(part, candidate))) return candidate;
  }

  return after;
}

function pointIndex(point: SnakePoint, width: number) {
  return point.row * width + point.column;
}

function gentleFallbackDirections(blockedDirection: SnakeDirection, currentDirection: SnakeDirection) {
  return uniqueDirections([turnRight(blockedDirection), turnLeft(blockedDirection), currentDirection]);
}

function uniqueDirections(input: SnakeDirection[]) {
  return input.filter((direction, index) => input.indexOf(direction) === index);
}

function turnRight(direction: SnakeDirection) {
  return directions[(directions.indexOf(direction) + 1) % directions.length];
}

function turnLeft(direction: SnakeDirection) {
  return directions[(directions.indexOf(direction) + directions.length - 1) % directions.length];
}

function isOpposite(a: SnakeDirection, b: SnakeDirection) {
  return directionDeltas[a].row + directionDeltas[b].row === 0 && directionDeltas[a].column + directionDeltas[b].column === 0;
}
