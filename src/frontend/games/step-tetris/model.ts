export type StepTetrisPieceId = "i" | "o" | "t" | "l" | "s";
export type StepTetrisCell = StepTetrisPieceId | "";
export type StepTetrisBoard = StepTetrisCell[];

export type StepTetrisPoint = {
  row: number;
  column: number;
};

export type StepTetrisPiece = {
  id: StepTetrisPieceId;
  label: string;
  color: string;
  cells: StepTetrisPoint[];
  rotation: number;
};

export type StepTetrisPlacement = {
  piece: StepTetrisPiece;
  row: number;
  column: number;
};

export type StepTetrisSpawnOutcome = "playing" | "loss";

export const stepTetrisColumns = 10;
export const stepTetrisRows = 12;
export const stepTetrisCells = stepTetrisColumns * stepTetrisRows;
export const stepTetrisTopRecoveryRows = 4;

const pieceDefinitions: Record<StepTetrisPieceId, Omit<StepTetrisPiece, "cells" | "rotation"> & { cells: StepTetrisPoint[] }> = {
  i: {
    id: "i",
    label: "Палочка",
    color: "#80cbc4",
    cells: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 0, column: 3 }
    ]
  },
  o: {
    id: "o",
    label: "Квадрат",
    color: "#ffe082",
    cells: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 1, column: 0 },
      { row: 1, column: 1 }
    ]
  },
  t: {
    id: "t",
    label: "Три луча",
    color: "#b39ddb",
    cells: [
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 1, column: 1 }
    ]
  },
  l: {
    id: "l",
    label: "Уголок",
    color: "#ffab91",
    cells: [
      { row: 0, column: 0 },
      { row: 1, column: 0 },
      { row: 2, column: 0 },
      { row: 2, column: 1 }
    ]
  },
  s: {
    id: "s",
    label: "Ступенька",
    color: "#a5d6a7",
    cells: [
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 1, column: 0 },
      { row: 1, column: 1 }
    ]
  }
};

export const stepTetrisPieceIds = Object.keys(pieceDefinitions) as StepTetrisPieceId[];

export function createEmptyBoard(): StepTetrisBoard {
  return Array<StepTetrisCell>(stepTetrisCells).fill("");
}

export function cellIndex(row: number, column: number) {
  return row * stepTetrisColumns + column;
}

export function isInside(row: number, column: number) {
  return row >= 0 && row < stepTetrisRows && column >= 0 && column < stepTetrisColumns;
}

export function normalizeShape(cells: StepTetrisPoint[]) {
  const minRow = Math.min(...cells.map((cell) => cell.row));
  const minColumn = Math.min(...cells.map((cell) => cell.column));
  return cells
   .map((cell) => ({ row: cell.row - minRow, column: cell.column - minColumn }))
   .sort((a, b) => a.row - b.row || a.column - b.column);
}

export function rotateShape(cells: StepTetrisPoint[]) {
  return normalizeShape(cells.map((cell) => ({ row: cell.column, column: -cell.row })));
}

export function createPiece(id: StepTetrisPieceId, rotation = 0): StepTetrisPiece {
  const definition = pieceDefinitions[id];
  let cells = normalizeShape(definition.cells);
  const turns = ((rotation % 4) + 4) % 4;
  for (let index = 0; index < turns; index++) cells = rotateShape(cells);

  return {
    id: definition.id,
    label: definition.label,
    color: definition.color,
    cells,
    rotation: turns
  };
}

export function pieceBounds(piece: StepTetrisPiece) {
  const rows = piece.cells.map((cell) => cell.row);
  const columns = piece.cells.map((cell) => cell.column);
  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minColumn: Math.min(...columns),
    maxColumn: Math.max(...columns),
    height: Math.max(...rows) + 1,
    width: Math.max(...columns) + 1
  };
}

export function createSpawnPlacement(piece: StepTetrisPiece): StepTetrisPlacement {
  const bounds = pieceBounds(piece);
  return {
    piece,
    row: 0,
    column: Math.floor((stepTetrisColumns - bounds.width) / 2)
  };
}

export function placementCells(placement: StepTetrisPlacement) {
  return placement.piece.cells.map((cell) => ({
    row: placement.row + cell.row,
    column: placement.column + cell.column
  }));
}

export function isValidPlacement(board: StepTetrisBoard, placement: StepTetrisPlacement) {
  return placementCells(placement).every((cell) => isInside(cell.row, cell.column) && !board[cellIndex(cell.row, cell.column)]);
}

export function movePlacement(placement: StepTetrisPlacement, rowOffset: number, columnOffset: number): StepTetrisPlacement {
  return {
   ...placement,
    row: placement.row + rowOffset,
    column: placement.column + columnOffset
  };
}

export function rotatePlacement(placement: StepTetrisPlacement): StepTetrisPlacement {
  return {
   ...placement,
    piece: createPiece(placement.piece.id, placement.piece.rotation + 1)
  };
}

export function getDropRow(board: StepTetrisBoard, placement: StepTetrisPlacement) {
  if (!isValidPlacement(board, placement)) return undefined;

  let row = placement.row;
  while (isValidPlacement(board, { ...placement, row: row + 1 })) row += 1;
  return row;
}

export function getGhostPlacement(board: StepTetrisBoard, placement: StepTetrisPlacement): StepTetrisPlacement | undefined {
  const row = getDropRow(board, placement);
  return row === undefined ? undefined : { ...placement, row };
}

export function clearFullLines(board: StepTetrisBoard) {
  const rows: StepTetrisCell[][] = [];
  let clearedLines = 0;

  for (let row = 0; row < stepTetrisRows; row++) {
    const start = cellIndex(row, 0);
    const nextRow = board.slice(start, start + stepTetrisColumns);
    if (nextRow.every(Boolean)) clearedLines += 1;
    else rows.push(nextRow);
  }

  const emptyRows = Array.from({ length: clearedLines }, () => Array<StepTetrisCell>(stepTetrisColumns).fill(""));
  return {
    board: [...emptyRows, ...rows].flat(),
    clearedLines
  };
}

export function lockPiece(board: StepTetrisBoard, placement: StepTetrisPlacement) {
  if (!isValidPlacement(board, placement)) return undefined;

  const nextBoard = [...board];
  const placedCells = placementCells(placement);
  for (const cell of placedCells) nextBoard[cellIndex(cell.row, cell.column)] = placement.piece.id;

  return {
   ...clearFullLines(nextBoard),
    placedCells
  };
}

export function clearTopRows(board: StepTetrisBoard, rows = stepTetrisTopRecoveryRows): StepTetrisBoard {
  const nextBoard = [...board];
  for (let row = 0; row < Math.min(rows, stepTetrisRows); row++) {
    for (let column = 0; column < stepTetrisColumns; column++) nextBoard[cellIndex(row, column)] = "";
  }
  return nextBoard;
}

export function canSpawnPiece(board: StepTetrisBoard, piece: StepTetrisPiece) {
  return isValidPlacement(board, createSpawnPlacement(piece));
}

export function stepTetrisSpawnOutcome(board: StepTetrisBoard, piece: StepTetrisPiece): StepTetrisSpawnOutcome {
  return canSpawnPiece(board, piece) ? "playing" : "loss";
}
