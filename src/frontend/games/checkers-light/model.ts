export type CheckersLightPieceSide = "gold" | "blue";

export type CheckersLightPiece = {
  id: string;
  side: CheckersLightPieceSide;
  king: boolean;
};

export type CheckersLightCell = CheckersLightPiece | undefined;
export type CheckersLightBoard = CheckersLightCell[];
export type CheckersLightOutcome = "playing" | "gold-win" | "blue-win" | "draw";

export type CheckersLightMove = {
  fromIndex: number;
  toIndex: number;
  capturedIndex?: number;
  capture: boolean;
};

export type CheckersLightState = {
  board: CheckersLightBoard;
  turn: CheckersLightPieceSide;
  selectedIndex?: number;
  forcedFromIndex?: number;
  status: CheckersLightOutcome;
  moveCount: number;
};

export type CheckersLightMoveResult = {
  state: CheckersLightState;
  move?: CheckersLightMove;
  captured?: CheckersLightPiece;
  promoted: boolean;
  mustContinue: boolean;
};

export const checkersLightSize = 8;
export const checkersLightCells = checkersLightSize * checkersLightSize;

const directions = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
] as const;

export function cellIndex(row: number, column: number) {
  return row * checkersLightSize + column;
}

export function cellPosition(index: number) {
  return {
    row: Math.floor(index / checkersLightSize),
    column: index % checkersLightSize
  };
}

export function isDarkCell(index: number) {
  const { row, column } = cellPosition(index);
  return (row + column) % 2 === 1;
}

export function opponent(side: CheckersLightPieceSide): CheckersLightPieceSide {
  return side === "gold" ? "blue" : "gold";
}

export function createInitialCheckersLightBoard(): CheckersLightBoard {
  return createInitialCheckersLightState().board;
}

export function createInitialCheckersLightState(): CheckersLightState {
  const board = Array<CheckersLightCell>(checkersLightCells).fill(undefined);
  let goldIndex = 1;
  let blueIndex = 1;

  for (let row = 0; row < checkersLightSize; row += 1) {
    for (let column = 0; column < checkersLightSize; column += 1) {
      const index = cellIndex(row, column);
      if (!isDarkCell(index)) continue;
      if (row <= 2) {
        board[index] = { id: `blue-${blueIndex}`, side: "blue", king: false };
        blueIndex += 1;
      } else if (row >= 5) {
        board[index] = { id: `gold-${goldIndex}`, side: "gold", king: false };
        goldIndex += 1;
      }
    }
  }

  return { board, turn: "gold", status: "playing", moveCount: 0 };
}

export function getLegalMoves(state: CheckersLightState, side = state.turn) {
  if (state.status !== "playing") return [];
  return getLegalMovesForBoard(state.board, side, state.turn === side ? state.forcedFromIndex : undefined);
}

export function getMovablePieceIndexes(stateOrBoard: CheckersLightState | CheckersLightBoard, side: CheckersLightPieceSide = "gold") {
  const state = Array.isArray(stateOrBoard) ? { board: stateOrBoard, turn: side, status: "playing" as const, moveCount: 0 } : stateOrBoard;
  return [...new Set(getLegalMoves(state, side).map((move) => move.fromIndex))];
}

export function getMoveTargets(stateOrBoard: CheckersLightState | CheckersLightBoard, fromIndex: number, side: CheckersLightPieceSide = "gold") {
  const state = Array.isArray(stateOrBoard) ? { board: stateOrBoard, turn: side, status: "playing" as const, moveCount: 0 } : stateOrBoard;
  return getLegalMoves(state, side).filter((move) => move.fromIndex === fromIndex).map((move) => move.toIndex);
}

export function getMoveForTarget(state: CheckersLightState, fromIndex: number, toIndex: number) {
  return getLegalMoves(state).find((move) => move.fromIndex === fromIndex && move.toIndex === toIndex);
}

export function checkersLightOutcome(stateOrBoard: CheckersLightState | CheckersLightBoard): CheckersLightOutcome {
  if (!Array.isArray(stateOrBoard)) return stateOrBoard.status;
  return determineStatus(stateOrBoard, "gold");
}

export function applyCheckersLightMove(stateOrBoard: CheckersLightState | CheckersLightBoard, fromIndex: number, toIndex: number): CheckersLightMoveResult | CheckersLightBoard | undefined {
  const legacy = Array.isArray(stateOrBoard);
  const state = legacy
    ? { board: stateOrBoard, turn: stateOrBoard[fromIndex]?.side ?? "gold", status: "playing" as const, moveCount: 0 }
    : stateOrBoard;
  const move = getMoveForTarget(state, fromIndex, toIndex);
  if (!move) return undefined;
  const result = applyMoveObject(state, move);
  return legacy ? result.state.board : result;
}

export function chooseCheckersLightCell(state: CheckersLightState, index: number): { state: CheckersLightState; event: "selected" | "moved" | "invalid"; result?: CheckersLightMoveResult } {
  if (state.status !== "playing" || state.turn !== "gold") return { state: cloneState(state), event: "invalid" };
  const piece = state.board[index];
  const movable = getMovablePieceIndexes(state);
  if (piece?.side === "gold" && movable.includes(index) && state.forcedFromIndex === undefined) {
    return { state: { ...cloneState(state), selectedIndex: index }, event: "selected" };
  }
  if (state.selectedIndex === undefined && state.forcedFromIndex === undefined) return { state: cloneState(state), event: "invalid" };

  const fromIndex = state.forcedFromIndex ?? state.selectedIndex;
  if (fromIndex === undefined) return { state: cloneState(state), event: "invalid" };
  const move = getMoveForTarget(state, fromIndex, index);
  if (!move) return { state: cloneState(state), event: "invalid" };
  const result = applyMoveObject(state, move);
  return { state: result.state, event: "moved", result };
}

export function chooseCheckersLightAiMove(state: CheckersLightState, depth = 5): CheckersLightMove | undefined {
  const moves = getLegalMoves(state, "blue");
  if (!moves.length) return undefined;
  let bestMove = moves[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const move of orderMoves(moves)) {
    const result = applyMoveObject(state, move);
    const score = minimax(result.state, depth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

export function encodeCheckersLightBoard(board: CheckersLightBoard) {
  return board.map((piece) => {
    if (!piece) return ".";
    if (piece.side === "gold") return piece.king ? "G" : "g";
    return piece.king ? "B" : "b";
  }).join("");
}

export function countCheckersLightPieces(board: CheckersLightBoard) {
  return board.reduce<Record<CheckersLightPieceSide, number>>((counts, piece) => {
    if (piece) counts[piece.side] += 1;
    return counts;
  }, { gold: 0, blue: 0 });
}

function getLegalMovesForBoard(board: CheckersLightBoard, side: CheckersLightPieceSide, forcedFromIndex?: number) {
  const candidateIndexes = forcedFromIndex === undefined
    ? board.map((piece, index) => piece?.side === side ? index : undefined).filter((index): index is number => index !== undefined)
    : [forcedFromIndex];
  const captureMoves = candidateIndexes.flatMap((index) => getCaptureMoves(board, index));
  if (captureMoves.length) return captureMoves;
  if (forcedFromIndex !== undefined) return [];
  return candidateIndexes.flatMap((index) => getQuietMoves(board, index));
}

function getQuietMoves(board: CheckersLightBoard, fromIndex: number): CheckersLightMove[] {
  const piece = board[fromIndex];
  if (!piece) return [];
  const { row, column } = cellPosition(fromIndex);
  if (piece.king) {
    return directions.flatMap(([rowStep, columnStep]) => {
      const moves: CheckersLightMove[] = [];
      let nextRow = row + rowStep;
      let nextColumn = column + columnStep;
      while (isInside(nextRow, nextColumn)) {
        const nextIndex = cellIndex(nextRow, nextColumn);
        if (board[nextIndex]) break;
        moves.push({ fromIndex, toIndex: nextIndex, capture: false });
        nextRow += rowStep;
        nextColumn += columnStep;
      }
      return moves;
    });
  }

  const forward = piece.side === "gold" ? -1 : 1;
  return [-1, 1]
    .map((columnStep) => [row + forward, column + columnStep] as const)
    .filter(([nextRow, nextColumn]) => isInside(nextRow, nextColumn))
    .map(([nextRow, nextColumn]) => cellIndex(nextRow, nextColumn))
    .filter((nextIndex) => isDarkCell(nextIndex) && !board[nextIndex])
    .map((toIndex) => ({ fromIndex, toIndex, capture: false }));
}

function getCaptureMoves(board: CheckersLightBoard, fromIndex: number): CheckersLightMove[] {
  const piece = board[fromIndex];
  if (!piece) return [];
  const { row, column } = cellPosition(fromIndex);
  if (piece.king) return getKingCaptureMoves(board, fromIndex, piece, row, column);

  return directions.flatMap(([rowStep, columnStep]) => {
    const captureRow = row + rowStep;
    const captureColumn = column + columnStep;
    const landRow = row + rowStep * 2;
    const landColumn = column + columnStep * 2;
    if (!isInside(captureRow, captureColumn) || !isInside(landRow, landColumn)) return [];
    const capturedIndex = cellIndex(captureRow, captureColumn);
    const captured = board[capturedIndex];
    const toIndex = cellIndex(landRow, landColumn);
    if (captured?.side === opponent(piece.side) && !board[toIndex]) return [{ fromIndex, toIndex, capturedIndex, capture: true }];
    return [];
  });
}

function getKingCaptureMoves(board: CheckersLightBoard, fromIndex: number, piece: CheckersLightPiece, row: number, column: number) {
  return directions.flatMap(([rowStep, columnStep]) => {
    const moves: CheckersLightMove[] = [];
    let capturedIndex: number | undefined;
    let nextRow = row + rowStep;
    let nextColumn = column + columnStep;
    while (isInside(nextRow, nextColumn)) {
      const nextIndex = cellIndex(nextRow, nextColumn);
      const nextPiece = board[nextIndex];
      if (!nextPiece) {
        if (capturedIndex !== undefined) moves.push({ fromIndex, toIndex: nextIndex, capturedIndex, capture: true });
      } else if (nextPiece.side === piece.side || capturedIndex !== undefined) {
        break;
      } else {
        capturedIndex = nextIndex;
      }
      nextRow += rowStep;
      nextColumn += columnStep;
    }
    return moves;
  });
}

function applyMoveObject(state: CheckersLightState, move: CheckersLightMove): CheckersLightMoveResult {
  const board = cloneBoard(state.board);
  const piece = board[move.fromIndex];
  if (!piece) return { state: cloneState(state), move, promoted: false, mustContinue: false };
  const captured = move.capturedIndex === undefined ? undefined : board[move.capturedIndex];
  board[move.fromIndex] = undefined;
  if (move.capturedIndex !== undefined) board[move.capturedIndex] = undefined;
  const promoted = !piece.king && reachesPromotionRow(piece.side, move.toIndex);
  const nextPiece = { ...piece, king: piece.king || promoted };
  board[move.toIndex] = nextPiece;

  const mustContinue = move.capture && getCaptureMoves(board, move.toIndex).length > 0;
  const nextTurn = mustContinue ? state.turn : opponent(state.turn);
  const nextState: CheckersLightState = {
    board,
    turn: nextTurn,
    selectedIndex: mustContinue ? move.toIndex : undefined,
    forcedFromIndex: mustContinue ? move.toIndex : undefined,
    status: mustContinue ? "playing" : determineStatus(board, nextTurn),
    moveCount: state.moveCount + (mustContinue ? 0 : 1)
  };
  return { state: nextState, move, captured, promoted, mustContinue };
}

function determineStatus(board: CheckersLightBoard, sideToMove: CheckersLightPieceSide): CheckersLightOutcome {
  const goldCount = board.filter((piece) => piece?.side === "gold").length;
  const blueCount = board.filter((piece) => piece?.side === "blue").length;
  if (!goldCount) return "blue-win";
  if (!blueCount) return "gold-win";
  if (!getLegalMovesForBoard(board, sideToMove).length) return sideToMove === "gold" ? "blue-win" : "gold-win";
  return "playing";
}

function minimax(state: CheckersLightState, depth: number, alpha: number, beta: number, maximizingBlue: boolean): number {
  if (depth <= 0 || state.status !== "playing") return evaluateState(state);
  const side = maximizingBlue ? "blue" : "gold";
  const moves = orderMoves(getLegalMoves(state, side));
  if (!moves.length) return evaluateState(state);

  if (maximizingBlue) {
    let value = Number.NEGATIVE_INFINITY;
    for (const move of moves) {
      value = Math.max(value, minimax(applyMoveObject({ ...state, turn: side }, move).state, depth - 1, alpha, beta, false));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  let value = Number.POSITIVE_INFINITY;
  for (const move of moves) {
    value = Math.min(value, minimax(applyMoveObject({ ...state, turn: side }, move).state, depth - 1, alpha, beta, true));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function evaluateState(state: CheckersLightState) {
  if (state.status === "blue-win") return 100000;
  if (state.status === "gold-win") return -100000;
  return state.board.reduce((score, piece, index) => {
    if (!piece) return score;
    const sign = piece.side === "blue" ? 1 : -1;
    const row = cellPosition(index).row;
    const advancement = piece.side === "blue" ? row : checkersLightSize - 1 - row;
    return score + sign * ((piece.king ? 260 : 100) + advancement * 6 + (isCenter(index) ? 8 : 0));
  }, getLegalMoves(state, "blue").length * 3 - getLegalMoves(state, "gold").length * 3);
}

function orderMoves(moves: CheckersLightMove[]) {
  return [...moves].sort((left, right) => Number(right.capture) - Number(left.capture));
}

function reachesPromotionRow(side: CheckersLightPieceSide, index: number) {
  const row = cellPosition(index).row;
  return side === "gold" ? row === 0 : row === checkersLightSize - 1;
}

function isCenter(index: number) {
  const { row, column } = cellPosition(index);
  return row >= 2 && row <= 5 && column >= 2 && column <= 5;
}

function cloneState(state: CheckersLightState): CheckersLightState {
  return { ...state, board: cloneBoard(state.board) };
}

function cloneBoard(board: CheckersLightBoard): CheckersLightBoard {
  return board.map((piece) => piece ? { ...piece } : undefined);
}

function isInside(row: number, column: number) {
  return row >= 0 && row < checkersLightSize && column >= 0 && column < checkersLightSize;
}
