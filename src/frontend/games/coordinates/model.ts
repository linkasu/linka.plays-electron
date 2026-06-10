export type CoordinateColumn = "A" | "B" | "C";
export type CoordinateRow = 1 | 2 | 3;

export type CoordinateCell = {
  id: string;
  coordinate: string;
  column: CoordinateColumn;
  row: CoordinateRow;
  isTarget: boolean;
};

export type CoordinatesRound = {
  roundId: string;
  prompt: string;
  target: string;
  cells: CoordinateCell[];
  correctIndex: number;
};

export const coordinateColumns: CoordinateColumn[] = ["A", "B", "C"];
export const coordinateRows: CoordinateRow[] = [1, 2, 3];

const targetSequence = ["A1", "B2", "C3", "A2", "B3", "C1", "A3", "B1", "C2"];

export function generateCoordinatesRound(roundIndex = 1): CoordinatesRound {
  const target = targetSequence[Math.max(0, roundIndex - 1) % targetSequence.length];
  const cells: CoordinateCell[] = coordinateRows.flatMap((row) => coordinateColumns.map((column) => {
    const coordinate = `${column}${row}`;
    return {
      id: `coordinates:${row}:${column}`,
      coordinate,
      column,
      row,
      isTarget: coordinate === target
    };
  }));
  const correctIndex = cells.findIndex((cell) => cell.coordinate === target);

  return {
    roundId: `coordinates:round:${roundIndex}`,
    prompt: `Найди клетку ${target}`,
    target,
    cells,
    correctIndex
  };
}
