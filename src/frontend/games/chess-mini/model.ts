export type ChessMiniPiece = "rook" | "bishop" | "knight" | "queen" | "king";

export type ChessMiniTask = {
  id: string;
  piece: ChessMiniPiece;
  from: number;
  blockers: number[];
  prompt: string;
};

export const chessMiniSize = 4;
export const chessMiniCellCount = chessMiniSize * chessMiniSize;

const taskDefinitions: ChessMiniTask[] = [
  {
    id: "rook-lane",
    piece: "rook",
    from: cellIndex(1, 1),
    blockers: [cellIndex(1, 3), cellIndex(3, 1)],
    prompt: "Ладья ходит прямо по строке или столбцу. Выбери клетку без преграды."
  },
  {
    id: "bishop-diagonal",
    piece: "bishop",
    from: cellIndex(0, 2),
    blockers: [cellIndex(2, 0)],
    prompt: "Слон идёт по диагонали. Найди спокойный диагональный ход."
  },
  {
    id: "knight-corner",
    piece: "knight",
    from: cellIndex(0, 0),
    blockers: [cellIndex(1, 2)],
    prompt: "Конь прыгает буквой Г и может перепрыгнуть через преграды."
  },
  {
    id: "king-center",
    piece: "king",
    from: cellIndex(2, 2),
    blockers: [cellIndex(1, 1), cellIndex(3, 3)],
    prompt: "Король делает один шаг рядом с собой. Выбери соседнюю свободную клетку."
  },
  {
    id: "queen-choice",
    piece: "queen",
    from: cellIndex(2, 1),
    blockers: [cellIndex(0, 1), cellIndex(2, 3)],
    prompt: "Ферзь умеет ходить прямо и по диагонали. Найди допустимое место."
  },
  {
    id: "rook-edge",
    piece: "rook",
    from: cellIndex(3, 0),
    blockers: [cellIndex(1, 0), cellIndex(3, 2)],
    prompt: "Ладья на краю поля тоже ходит только по прямой линии."
  },
  {
    id: "bishop-calm",
    piece: "bishop",
    from: cellIndex(3, 3),
    blockers: [cellIndex(1, 1)],
    prompt: "Слону нужна чистая диагональ. Выбери клетку до преграды."
  },
  {
    id: "knight-shift",
    piece: "knight",
    from: cellIndex(2, 1),
    blockers: [cellIndex(0, 2), cellIndex(2, 2)],
    prompt: "Конь снова прыгает буквой Г. Переключи внимание на далёкую клетку."
  }
];

export function createChessMiniTasks() {
  return taskDefinitions.map((task) => ({ ...task, blockers: [...task.blockers] }));
}

export function cellIndex(row: number, column: number) {
  return row * chessMiniSize + column;
}

export function cellPosition(index: number) {
  return {
    row: Math.floor(index / chessMiniSize),
    column: index % chessMiniSize
  };
}

export function squareLabel(index: number) {
  const { row, column } = cellPosition(index);
  return `${String.fromCharCode(65 + column)}${chessMiniSize - row}`;
}

export function legalMoves(task: ChessMiniTask) {
  return Array.from({ length: chessMiniCellCount }, (_, index) => index).filter((index) => isLegalMove(task, index));
}

export function isLegalMove(task: ChessMiniTask, toIndex: number) {
  if (!canLandOn(task, toIndex)) return false;

  const from = cellPosition(task.from);
  const to = cellPosition(toIndex);
  const rowDelta = to.row - from.row;
  const columnDelta = to.column - from.column;
  const absRow = Math.abs(rowDelta);
  const absColumn = Math.abs(columnDelta);

  if (task.piece === "king") return Math.max(absRow, absColumn) === 1;
  if (task.piece === "knight") return (absRow === 2 && absColumn === 1) || (absRow === 1 && absColumn === 2);
  if (task.piece === "rook") return isClearRookMove(task, rowDelta, columnDelta, toIndex);
  if (task.piece === "bishop") return isClearBishopMove(task, rowDelta, columnDelta, toIndex);
  return isClearRookMove(task, rowDelta, columnDelta, toIndex) || isClearBishopMove(task, rowDelta, columnDelta, toIndex);
}

function canLandOn(task: ChessMiniTask, index: number) {
  return index >= 0 && index < chessMiniCellCount && index !== task.from && !task.blockers.includes(index);
}

function isClearRookMove(task: ChessMiniTask, rowDelta: number, columnDelta: number, toIndex: number) {
  if (rowDelta !== 0 && columnDelta !== 0) return false;
  return isPathClear(task, Math.sign(rowDelta), Math.sign(columnDelta), toIndex);
}

function isClearBishopMove(task: ChessMiniTask, rowDelta: number, columnDelta: number, toIndex: number) {
  if (Math.abs(rowDelta) !== Math.abs(columnDelta)) return false;
  return isPathClear(task, Math.sign(rowDelta), Math.sign(columnDelta), toIndex);
}

function isPathClear(task: ChessMiniTask, rowStep: number, columnStep: number, toIndex: number) {
  if (rowStep === 0 && columnStep === 0) return false;

  const from = cellPosition(task.from);
  let row = from.row + rowStep;
  let column = from.column + columnStep;

  while (isInside(row, column)) {
    const index = cellIndex(row, column);
    if (index === toIndex) return true;
    if (task.blockers.includes(index)) return false;
    row += rowStep;
    column += columnStep;
  }

  return false;
}

function isInside(row: number, column: number) {
  return row >= 0 && row < chessMiniSize && column >= 0 && column < chessMiniSize;
}
