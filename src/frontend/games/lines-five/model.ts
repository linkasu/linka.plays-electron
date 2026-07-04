export type LinesFiveColor = "sky" | "sun" | "leaf" | "berry";
export type LinesFiveCell = LinesFiveColor | "";
export type LinesFiveBoard = LinesFiveCell[];

export type LinesFiveState = {
  board: LinesFiveBoard;
  selectedIndex?: number;
  nextBalls: LinesFiveColor[];
  score: number;
  moveCount: number;
  seed: number;
  status: "playing" | "loss";
};

export type LinesFiveMoveResult = {
  state: LinesFiveState;
  event: "selected" | "moved" | "cleared" | "spawn-cleared" | "loss" | "invalid";
  movedFrom?: number;
  movedTo?: number;
  path: number[];
  cleared: number[];
  spawned: number[];
};

export type LinesFiveOutcome = "playing" | "loss";

export const linesFiveSize = 6;
export const linesFiveCellCount = linesFiveSize * linesFiveSize;
export const linesFiveColors: LinesFiveColor[] = ["sky", "sun", "leaf", "berry"];

const spawnCount = 3;
const lineLength = 5;
const directions = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
] as const;
const neighborSteps = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1]
] as const;

export function createEmptyLinesFiveBoard(): LinesFiveBoard {
  return Array<LinesFiveCell>(linesFiveCellCount).fill("");
}

export function createInitialLinesFiveState(seed = 0x5f3759df): LinesFiveState {
  const board = createEmptyLinesFiveBoard();
  const opening: [number, LinesFiveColor][] = [
    [cellIndex(0, 0), "sky"],
    [cellIndex(0, 1), "sky"],
    [cellIndex(0, 2), "sky"],
    [cellIndex(0, 3), "sky"],
    [cellIndex(2, 2), "sun"],
    [cellIndex(3, 3), "leaf"],
    [cellIndex(5, 5), "berry"]
  ];
  for (const [index, color] of opening) board[index] = color;

  return {
    board,
    nextBalls: ["sun", "leaf", "berry"],
    score: 0,
    moveCount: 0,
    seed,
    status: "playing"
  };
}

export function createInitialLinesFiveBoard(): LinesFiveBoard {
  return createInitialLinesFiveState().board;
}

export function cellIndex(row: number, column: number) {
  return row * linesFiveSize + column;
}

export function rowOf(index: number) {
  return Math.floor(index / linesFiveSize);
}

export function columnOf(index: number) {
  return index % linesFiveSize;
}

export function nextColorForStep(step: number): LinesFiveColor {
  return linesFiveColors[step % linesFiveColors.length];
}

export function emptyCellIndexes(board: LinesFiveBoard) {
  return board.reduce<number[]>((indexes, cell, index) => {
    if (!cell) indexes.push(index);
    return indexes;
  }, []);
}

export function isBoardFull(board: LinesFiveBoard) {
  return emptyCellIndexes(board).length === 0;
}

export function linesFiveOutcome(board: LinesFiveBoard): LinesFiveOutcome {
  return isBoardFull(board) ? "loss" : "playing";
}

export function countColors(board: LinesFiveBoard) {
  return board.reduce<Record<LinesFiveColor, number>>((counts, cell) => {
    if (cell) counts[cell] += 1;
    return counts;
  }, { sky: 0, sun: 0, leaf: 0, berry: 0 });
}

export function isSelectableBall(state: LinesFiveState, index: number) {
  return state.status === "playing" && Boolean(state.board[index]);
}

export function reachableDestinationIndexes(board: LinesFiveBoard, fromIndex: number) {
  return emptyCellIndexes(board).filter((index) => findPath(board, fromIndex, index).length > 0);
}

export function chooseLinesFiveCell(state: LinesFiveState, index: number): LinesFiveMoveResult {
  if (state.status !== "playing" || index < 0 || index >= linesFiveCellCount) return invalidResult(state);

  if (state.board[index]) {
    return {
      state: { ...cloneState(state), selectedIndex: index },
      event: "selected",
      path: [],
      cleared: [],
      spawned: []
    };
  }

  if (state.selectedIndex === undefined) return invalidResult(state);

  const selectedColor = state.board[state.selectedIndex];
  if (!selectedColor) return invalidResult({ ...cloneState(state), selectedIndex: undefined });

  const path = findPath(state.board, state.selectedIndex, index);
  if (!path.length) return invalidResult(state);

  const movedBoard = [...state.board];
  movedBoard[state.selectedIndex] = "";
  movedBoard[index] = selectedColor;
  const movedLines = completedLinesThrough(movedBoard, index);
  const movedCleared = uniqueLineIndexes(movedLines);

  if (movedCleared.length) {
    const board = clearIndexes(movedBoard, movedCleared);
    const nextState = {
     ...cloneState(state),
      board,
      selectedIndex: undefined,
      score: state.score + movedCleared.length,
      moveCount: state.moveCount + 1,
      status: linesFiveOutcome(board)
    };
    return { state: nextState, event: "cleared", movedFrom: state.selectedIndex, movedTo: index, path, cleared: movedCleared, spawned: [] };
  }

  const spawned = spawnBalls(movedBoard, state.nextBalls, state.seed + state.moveCount + 1);
  const spawnLines = spawned.indexes.flatMap((spawnedIndex) => completedLinesThrough(spawned.board, spawnedIndex));
  const spawnCleared = uniqueLineIndexes(spawnLines);
  const board = spawnCleared.length ? clearIndexes(spawned.board, spawnCleared) : spawned.board;
  const nextStatus = linesFiveOutcome(board);
  const nextState = {
   ...cloneState(state),
    board,
    selectedIndex: undefined,
    nextBalls: nextQueue(spawned.seed),
    seed: spawned.seed,
    score: state.score + spawnCleared.length,
    moveCount: state.moveCount + 1,
    status: nextStatus
  };

  return {
    state: nextState,
    event: nextStatus === "loss" ? "loss" : spawnCleared.length ? "spawn-cleared" : "moved",
    movedFrom: state.selectedIndex,
    movedTo: index,
    path,
    cleared: spawnCleared,
    spawned: spawned.indexes
  };
}

export function placeBall(board: LinesFiveBoard, index: number, color: LinesFiveColor): Omit<LinesFiveMoveResult, "state" | "event" | "movedFrom" | "movedTo" | "path" | "spawned"> & { board: LinesFiveBoard; placedIndex: number; completedLines: number[][] } | undefined {
  if (index < 0 || index >= linesFiveCellCount || board[index]) return undefined;

  const nextBoard = [...board];
  nextBoard[index] = color;
  const completedLines = completedLinesThrough(nextBoard, index);
  const cleared = uniqueLineIndexes(completedLines);
  for (const clearedIndex of cleared) nextBoard[clearedIndex] = "";
  return { board: nextBoard, placedIndex: index, cleared, completedLines };
}

export function suggestedMoveIndexes(board: LinesFiveBoard, color: LinesFiveColor) {
  const emptyIndexes = emptyCellIndexes(board);
  const clearingMoves = emptyIndexes.filter((index) => {
    const nextBoard = [...board];
    nextBoard[index] = color;
    return completedLinesThrough(nextBoard, index).length > 0;
  });

  return clearingMoves.length ? clearingMoves : emptyIndexes.slice(0, 5);
}

export function completedLinesThrough(board: LinesFiveBoard, index: number) {
  const color = board[index];
  if (!color) return [];

  return directions.reduce<number[][]>((lines, [rowStep, columnStep]) => {
    const line = lineThrough(board, index, color, rowStep, columnStep);
    if (line.length >= lineLength) lines.push(line);
    return lines;
  }, []);
}

export function findPath(board: LinesFiveBoard, fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || !board[fromIndex] || board[toIndex]) return [];

  const queue = [fromIndex];
  const previous = new Map<number, number>();
  const visited = new Set([fromIndex]);

  while (queue.length) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of neighbors(current)) {
      if (visited.has(next)) continue;
      if (next !== toIndex && board[next]) continue;
      visited.add(next);
      previous.set(next, current);
      if (next === toIndex) return reconstructPath(previous, fromIndex, toIndex);
      queue.push(next);
    }
  }

  return [];
}

function lineThrough(board: LinesFiveBoard, index: number, color: LinesFiveColor, rowStep: number, columnStep: number) {
  const row = rowOf(index);
  const column = columnOf(index);
  const before = collectDirection(board, row, column, color, -rowStep, -columnStep).reverse();
  const after = collectDirection(board, row, column, color, rowStep, columnStep);
  return [...before, index, ...after];
}

function collectDirection(board: LinesFiveBoard, row: number, column: number, color: LinesFiveColor, rowStep: number, columnStep: number) {
  const indexes: number[] = [];
  let nextRow = row + rowStep;
  let nextColumn = column + columnStep;

  while (isInside(nextRow, nextColumn) && board[cellIndex(nextRow, nextColumn)] === color) {
    indexes.push(cellIndex(nextRow, nextColumn));
    nextRow += rowStep;
    nextColumn += columnStep;
  }

  return indexes;
}

function spawnBalls(board: LinesFiveBoard, colors: LinesFiveColor[], seed: number) {
  const nextBoard = [...board];
  let nextSeed = seed;
  const indexes: number[] = [];

  for (const color of colors) {
    const empty = emptyCellIndexes(nextBoard);
    if (!empty.length) break;
    const random = nextRandom(nextSeed);
    nextSeed = random.seed;
    const index = empty[Math.floor(random.value * empty.length)];
    nextBoard[index] = color;
    indexes.push(index);
  }

  return { board: nextBoard, indexes, seed: nextSeed };
}

function nextQueue(seed: number) {
  let nextSeed = seed;
  return Array.from({ length: spawnCount }, () => {
    const random = nextRandom(nextSeed);
    nextSeed = random.seed;
    return linesFiveColors[Math.floor(random.value * linesFiveColors.length)];
  });
}

function nextRandom(seed: number) {
  const nextSeed = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return { seed: nextSeed, value: nextSeed / 0x100000000 };
}

function neighbors(index: number) {
  const row = rowOf(index);
  const column = columnOf(index);
  return neighborSteps
   .map(([rowStep, columnStep]) => [row + rowStep, column + columnStep] as const)
   .filter(([nextRow, nextColumn]) => isInside(nextRow, nextColumn))
   .map(([nextRow, nextColumn]) => cellIndex(nextRow, nextColumn));
}

function reconstructPath(previous: Map<number, number>, fromIndex: number, toIndex: number) {
  const path = [toIndex];
  let current = toIndex;
  while (current !== fromIndex) {
    const parent = previous.get(current);
    if (parent === undefined) return [];
    current = parent;
    path.unshift(current);
  }
  return path;
}

function clearIndexes(board: LinesFiveBoard, indexes: number[]) {
  const nextBoard = [...board];
  for (const index of indexes) nextBoard[index] = "";
  return nextBoard;
}

function uniqueLineIndexes(lines: number[][]) {
  return [...new Set(lines.flat())].sort((left, right) => left - right);
}

function invalidResult(state: LinesFiveState): LinesFiveMoveResult {
  return { state: cloneState(state), event: "invalid", path: [], cleared: [], spawned: [] };
}

function cloneState(state: LinesFiveState): LinesFiveState {
  return {
   ...state,
    board: [...state.board],
    nextBalls: [...state.nextBalls]
  };
}

function isInside(row: number, column: number) {
  return row >= 0 && row < linesFiveSize && column >= 0 && column < linesFiveSize;
}
