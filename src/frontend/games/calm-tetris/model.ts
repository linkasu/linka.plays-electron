export type CalmTetrisPieceId = "i" | "o" | "t" | "l" | "s";
export type CalmTetrisCell = CalmTetrisPieceId | "";
export type CalmTetrisBoard = CalmTetrisCell[];

export type CalmTetrisPoint = {
  row: number;
  column: number;
};

export type CalmTetrisPiece = {
  id: CalmTetrisPieceId;
  label: string;
  color: string;
  cells: CalmTetrisPoint[];
  rotation: number;
};

export type CalmTetrisPlacement = {
  piece: CalmTetrisPiece;
  row: number;
  column: number;
};

export const calmTetrisColumns = 10;
export const calmTetrisRows = 12;
export const calmTetrisCells = calmTetrisColumns * calmTetrisRows;
export const calmTetrisTopRecoveryRows = 4;

const pieceDefinitions: Record<CalmTetrisPieceId, Omit<CalmTetrisPiece, "cells" | "rotation"> & { cells: CalmTetrisPoint[] }> = {
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

export const calmTetrisPieceIds = Object.keys(pieceDefinitions) as CalmTetrisPieceId[];

export function createEmptyBoard(): CalmTetrisBoard {
  return Array<CalmTetrisCell>(calmTetrisCells).fill("");
}

export function cellIndex(row: number, column: number) {
  return row * calmTetrisColumns + column;
}

export function isInside(row: number, column: number) {
  return row >= 0 && row < calmTetrisRows && column >= 0 && column < calmTetrisColumns;
}

export function normalizeShape(cells: CalmTetrisPoint[]) {
  const minRow = Math.min(...cells.map((cell) => cell.row));
  const minColumn = Math.min(...cells.map((cell) => cell.column));
  return cells
    .map((cell) => ({ row: cell.row - minRow, column: cell.column - minColumn }))
    .sort((a, b) => a.row - b.row || a.column - b.column);
}

export function rotateShape(cells: CalmTetrisPoint[]) {
  return normalizeShape(cells.map((cell) => ({ row: cell.column, column: -cell.row })));
}

export function createPiece(id: CalmTetrisPieceId, rotation = 0): CalmTetrisPiece {
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

export function pieceBounds(piece: CalmTetrisPiece) {
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

export function createSpawnPlacement(piece: CalmTetrisPiece): CalmTetrisPlacement {
  const bounds = pieceBounds(piece);
  return {
    piece,
    row: 0,
    column: Math.floor((calmTetrisColumns - bounds.width) / 2)
  };
}

export function placementCells(placement: CalmTetrisPlacement) {
  return placement.piece.cells.map((cell) => ({
    row: placement.row + cell.row,
    column: placement.column + cell.column
  }));
}

export function isValidPlacement(board: CalmTetrisBoard, placement: CalmTetrisPlacement) {
  return placementCells(placement).every((cell) => isInside(cell.row, cell.column) && !board[cellIndex(cell.row, cell.column)]);
}

export function movePlacement(placement: CalmTetrisPlacement, rowOffset: number, columnOffset: number): CalmTetrisPlacement {
  return {
    ...placement,
    row: placement.row + rowOffset,
    column: placement.column + columnOffset
  };
}

export function rotatePlacement(placement: CalmTetrisPlacement): CalmTetrisPlacement {
  return {
    ...placement,
    piece: createPiece(placement.piece.id, placement.piece.rotation + 1)
  };
}

export function getDropRow(board: CalmTetrisBoard, placement: CalmTetrisPlacement) {
  if (!isValidPlacement(board, placement)) return undefined;

  let row = placement.row;
  while (isValidPlacement(board, { ...placement, row: row + 1 })) row += 1;
  return row;
}

export function getGhostPlacement(board: CalmTetrisBoard, placement: CalmTetrisPlacement): CalmTetrisPlacement | undefined {
  const row = getDropRow(board, placement);
  return row === undefined ? undefined : { ...placement, row };
}

export function clearFullLines(board: CalmTetrisBoard) {
  const rows: CalmTetrisCell[][] = [];
  let clearedLines = 0;

  for (let row = 0; row < calmTetrisRows; row++) {
    const start = cellIndex(row, 0);
    const nextRow = board.slice(start, start + calmTetrisColumns);
    if (nextRow.every(Boolean)) clearedLines += 1;
    else rows.push(nextRow);
  }

  const emptyRows = Array.from({ length: clearedLines }, () => Array<CalmTetrisCell>(calmTetrisColumns).fill(""));
  return {
    board: [...emptyRows, ...rows].flat(),
    clearedLines
  };
}

export function lockPiece(board: CalmTetrisBoard, placement: CalmTetrisPlacement) {
  if (!isValidPlacement(board, placement)) return undefined;

  const nextBoard = [...board];
  const placedCells = placementCells(placement);
  for (const cell of placedCells) nextBoard[cellIndex(cell.row, cell.column)] = placement.piece.id;

  return {
    ...clearFullLines(nextBoard),
    placedCells
  };
}

export function clearTopRows(board: CalmTetrisBoard, rows = calmTetrisTopRecoveryRows): CalmTetrisBoard {
  const nextBoard = [...board];
  for (let row = 0; row < Math.min(rows, calmTetrisRows); row++) {
    for (let column = 0; column < calmTetrisColumns; column++) nextBoard[cellIndex(row, column)] = "";
  }
  return nextBoard;
}

export function canSpawnPiece(board: CalmTetrisBoard, piece: CalmTetrisPiece) {
  return isValidPlacement(board, createSpawnPlacement(piece));
}
