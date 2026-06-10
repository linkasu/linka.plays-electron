export type SokobanLargeDirection = "up" | "right" | "down" | "left";

export type SokobanLargePoint = {
  row: number;
  column: number;
};

export type SokobanLargeMoveEvent = "moved" | "pushed" | "wrong-direction" | "blocked" | "complete";

export type SokobanLargeState = {
  width: number;
  height: number;
  player: SokobanLargePoint;
  box: SokobanLargePoint;
  goal: SokobanLargePoint;
  stepIndex: number;
};

export type SokobanLargeMoveResult = {
  state: SokobanLargeState;
  event: SokobanLargeMoveEvent;
  moved: boolean;
  pushed: boolean;
  expectedDirection?: SokobanLargeDirection;
};

export const sokobanLargeMaxWrongMoves = 3;
export type SokobanLargeChoiceOutcome = "move" | "wrong-move" | "loss";

export const sokobanLargePlan: SokobanLargeDirection[] = [
  "left",
  "up",
  "down",
  "left",
  "up",
  "up",
  "up",
  "left",
  "up",
  "right",
  "right",
  "right"
];

export const sokobanLargeDirectionLabels: Record<SokobanLargeDirection, string> = {
  up: "вверх",
  right: "вправо",
  down: "вниз",
  left: "влево"
};

const directionDeltas: Record<SokobanLargeDirection, SokobanLargePoint> = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 }
};

export function createSokobanLargeState(): SokobanLargeState {
  return {
    width: 5,
    height: 5,
    player: { row: 4, column: 3 },
    box: { row: 3, column: 1 },
    goal: { row: 0, column: 4 },
    stepIndex: 0
  };
}

export function getSokobanLargeExpectedDirection(state: SokobanLargeState) {
  return sokobanLargePlan[state.stepIndex];
}

export function applySokobanLargeMove(state: SokobanLargeState, direction: SokobanLargeDirection): SokobanLargeMoveResult {
  const expectedDirection = getSokobanLargeExpectedDirection(state);
  if (!expectedDirection) return { state: cloneState(state), event: "complete", moved: false, pushed: false };

  if (direction !== expectedDirection) {
    return {
      state: cloneState(state),
      event: "wrong-direction",
      moved: false,
      pushed: false,
      expectedDirection
    };
  }

  const nextPlayer = movePoint(state.player, direction);
  if (!isInside(state, nextPlayer)) {
    return { state: cloneState(state), event: "blocked", moved: false, pushed: false, expectedDirection };
  }

  const pushesBox = pointsEqual(nextPlayer, state.box);
  if (!pushesBox) {
    return {
      state: { ...cloneState(state), player: nextPlayer, stepIndex: state.stepIndex + 1 },
      event: "moved",
      moved: true,
      pushed: false,
      expectedDirection
    };
  }

  const nextBox = movePoint(state.box, direction);
  if (!isInside(state, nextBox)) {
    return { state: cloneState(state), event: "blocked", moved: false, pushed: false, expectedDirection };
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
    pushed: true,
    expectedDirection
  };
}

export function sokobanLargeChoiceOutcome(result: SokobanLargeMoveResult, mistakesAfterChoice: number): SokobanLargeChoiceOutcome {
  if (result.moved || result.event === "complete") return "move";
  return mistakesAfterChoice >= sokobanLargeMaxWrongMoves ? "loss" : "wrong-move";
}

export function isSokobanLargeComplete(state: SokobanLargeState) {
  return state.stepIndex >= sokobanLargePlan.length && pointsEqual(state.box, state.goal);
}

export function pointKey(point: SokobanLargePoint) {
  return `${point.row}:${point.column}`;
}

export function pointsEqual(a: SokobanLargePoint, b: SokobanLargePoint) {
  return a.row === b.row && a.column === b.column;
}

export function movePoint(point: SokobanLargePoint, direction: SokobanLargeDirection): SokobanLargePoint {
  const delta = directionDeltas[direction];
  return { row: point.row + delta.row, column: point.column + delta.column };
}

function isInside(state: SokobanLargeState, point: SokobanLargePoint) {
  return point.row >= 0 && point.row < state.height && point.column >= 0 && point.column < state.width;
}

function cloneState(state: SokobanLargeState): SokobanLargeState {
  return {
    ...state,
    player: { ...state.player },
    box: { ...state.box },
    goal: { ...state.goal }
  };
}
