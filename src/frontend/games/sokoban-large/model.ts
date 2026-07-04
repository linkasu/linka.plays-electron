export type SokobanLargeDirection = "up" | "right" | "down" | "left";

export type SokobanLargePoint = {
  row: number;
  column: number;
};

export type SokobanLargeMoveEvent = "moved" | "pushed" | "blocked" | "complete";

export type SokobanLargeState = {
  width: number;
  height: number;
  walls: SokobanLargePoint[];
  player: SokobanLargePoint;
  box: SokobanLargePoint;
  goal: SokobanLargePoint;
  stepIndex: number;
  roundIndex: number;
  solution: SokobanLargeDirection[];
};

export type SokobanLargeMoveResult = {
  state: SokobanLargeState;
  event: SokobanLargeMoveEvent;
  moved: boolean;
  pushed: boolean;
};

export type SokobanLargeChoiceOutcome = "move" | "wrong-move";

const boardWidth = 6;
const boardHeight = 6;
const fallbackSolution: SokobanLargeDirection[] = ["up", "left", "up", "right", "right"];
const fallbackState: Omit<SokobanLargeState, "roundIndex" | "solution" | "stepIndex"> = {
  width: boardWidth,
  height: boardHeight,
  walls: perimeterWalls(boardWidth, boardHeight),
  player: { row: 4, column: 2 },
  box: { row: 3, column: 2 },
  goal: { row: 2, column: 4 }
};

export const sokobanLargeSolution = fallbackSolution;

export const sokobanLargeDirectionLabels: Record<SokobanLargeDirection, string> = {
  up: "вверх",
  right: "вправо",
  down: "вниз",
  left: "влево"
};

const directions: SokobanLargeDirection[] = ["up", "right", "down", "left"];
const directionDeltas: Record<SokobanLargeDirection, SokobanLargePoint> = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 }
};

export function createSokobanLargeState(roundIndex = 0, random: () => number = createRoundRandom(roundIndex)): SokobanLargeState {
  const generated = generateSokobanLargeState(roundIndex, random);
  if (generated) return generated;

  return {
   ...cloneBaseState(fallbackState),
    stepIndex: 0,
    roundIndex,
    solution: [...fallbackSolution]
  };
}

export function generateSokobanLargeState(roundIndex = 0, random: () => number = createRoundRandom(roundIndex)): SokobanLargeState | undefined {
  const wallBudget = Math.min(3, Math.floor(roundIndex / 3) + randomInt(random, 0, 2));
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const walls = [...perimeterWalls(boardWidth, boardHeight)];
    const innerCells = shuffled(innerPoints(boardWidth, boardHeight), random);
    for (const point of innerCells.slice(0, wallBudget)) walls.push(point);

    const freeCells = innerPoints(boardWidth, boardHeight).filter((point) => !pointInList(walls, point));
    if (freeCells.length < 4) continue;

    const picks = shuffled(freeCells, random).slice(0, 3);
    const state: SokobanLargeState = {
      width: boardWidth,
      height: boardHeight,
      walls,
      player: picks[0],
      box: picks[1],
      goal: picks[2],
      stepIndex: 0,
      roundIndex,
      solution: []
    };

    if (pointsEqual(state.player, state.box) || pointsEqual(state.player, state.goal) || pointsEqual(state.box, state.goal)) continue;

    const solution = solveSokobanLargeState(state, 18);
    if (solution.length >= 3 && solution.length <= 14) return { ...state, solution };
  }

  return undefined;
}

export function solveSokobanLargeState(initialState: SokobanLargeState, maxMoves = 18): SokobanLargeDirection[] {
  const queue: { state: SokobanLargeState; path: SokobanLargeDirection[] }[] = [{ state: cloneState(initialState), path: [] }];
  const visited = new Set([stateKey(initialState)]);

  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    if (isSokobanLargeComplete(item.state)) return item.path;
    if (item.path.length >= maxMoves) continue;

    for (const direction of directions) {
      const result = applySokobanLargeMove(item.state, direction);
      if (!result.moved) continue;
      const key = stateKey(result.state);
      if (visited.has(key)) continue;
      const path = [...item.path, direction];
      if (isSokobanLargeComplete(result.state)) return path;
      visited.add(key);
      queue.push({ state: result.state, path });
    }
  }

  return [];
}

export function applySokobanLargeMove(state: SokobanLargeState, direction: SokobanLargeDirection): SokobanLargeMoveResult {
  const nextPlayer = movePoint(state.player, direction);
  if (isBlocked(state, nextPlayer)) {
    return { state: cloneState(state), event: "blocked", moved: false, pushed: false };
  }

  const pushesBox = pointsEqual(nextPlayer, state.box);
  if (!pushesBox) {
    return {
      state: { ...cloneState(state), player: nextPlayer, stepIndex: state.stepIndex + 1 },
      event: "moved",
      moved: true,
      pushed: false
    };
  }

  const nextBox = movePoint(state.box, direction);
  if (isBlocked(state, nextBox)) {
    return { state: cloneState(state), event: "blocked", moved: false, pushed: false };
  }

  const nextState = {
   ...cloneState(state),
    player: nextPlayer,
    box: nextBox,
    stepIndex: state.stepIndex + 1
  };

  return {
    state: nextState,
    event: isSokobanLargeComplete(nextState) ? "complete" : "pushed",
    moved: true,
    pushed: true
  };
}

export function sokobanLargeChoiceOutcome(result: SokobanLargeMoveResult, _mistakesAfterChoice: number): SokobanLargeChoiceOutcome {
  if (result.moved || result.event === "complete") return "move";
  return "wrong-move";
}

export function isSokobanLargeComplete(state: SokobanLargeState) {
  return pointsEqual(state.box, state.goal);
}

export function pointKey(point: SokobanLargePoint) {
  return `${point.row}:${point.column}`;
}

export function pointsEqual(a: SokobanLargePoint, b: SokobanLargePoint) {
  return a.row === b.row && a.column === b.column;
}

export function hasSokobanLargeWall(state: SokobanLargeState, point: SokobanLargePoint) {
  return state.walls.some((wall) => pointsEqual(wall, point));
}

export function movePoint(point: SokobanLargePoint, direction: SokobanLargeDirection): SokobanLargePoint {
  const delta = directionDeltas[direction];
  return { row: point.row + delta.row, column: point.column + delta.column };
}

function perimeterWalls(width: number, height: number) {
  const walls: SokobanLargePoint[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (row === 0 || column === 0 || row === height - 1 || column === width - 1) walls.push({ row, column });
    }
  }
  return walls;
}

function innerPoints(width: number, height: number) {
  const points: SokobanLargePoint[] = [];
  for (let row = 1; row < height - 1; row += 1) {
    for (let column = 1; column < width - 1; column += 1) points.push({ row, column });
  }
  return points;
}

function isInside(state: SokobanLargeState, point: SokobanLargePoint) {
  return point.row >= 0 && point.row < state.height && point.column >= 0 && point.column < state.width;
}

function isBlocked(state: SokobanLargeState, point: SokobanLargePoint) {
  return !isInside(state, point) || hasSokobanLargeWall(state, point);
}

function stateKey(state: SokobanLargeState) {
  return `${pointKey(state.player)}|${pointKey(state.box)}`;
}

function pointInList(points: SokobanLargePoint[], point: SokobanLargePoint) {
  return points.some((item) => pointsEqual(item, point));
}

function randomInt(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

function shuffled<T>(items: T[], random: () => number) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function createRoundRandom(roundIndex: number) {
  let seed = (0x6d2b79f5 ^ Math.imul(roundIndex + 1, 0x9e3779b1)) >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function cloneBaseState(state: Omit<SokobanLargeState, "roundIndex" | "solution" | "stepIndex">) {
  return {
   ...state,
    walls: state.walls.map((wall) => ({ ...wall })),
    player: { ...state.player },
    box: { ...state.box },
    goal: { ...state.goal }
  };
}

function cloneState(state: SokobanLargeState): SokobanLargeState {
  return {
   ...state,
    walls: state.walls.map((wall) => ({ ...wall })),
    player: { ...state.player },
    box: { ...state.box },
    goal: { ...state.goal },
    solution: [...state.solution]
  };
}
