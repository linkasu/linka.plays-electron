export type Sudoku2x2Value = 1 | 2;

export type Sudoku2x2Cell = {
  id: string;
  row: 0 | 1;
  col: 0 | 1;
  value: Sudoku2x2Value;
  hidden: boolean;
};

export type Sudoku2x2Choice = {
  id: string;
  value: Sudoku2x2Value;
  label: string;
  colorName: string;
  tone: "sky" | "sun";
};

export type Sudoku2x2Round = {
  roundId: string;
  prompt: string;
  board: Sudoku2x2Cell[];
  missingCell: Sudoku2x2Cell;
  choices: Sudoku2x2Choice[];
  correctChoice: Sudoku2x2Choice;
  correctIndex: number;
};

export const sudoku2x2Choices: Sudoku2x2Choice[] = [
  { id: "card-1", value: 1, label: "1", colorName: "синяя", tone: "sky" },
  { id: "card-2", value: 2, label: "2", colorName: "жёлтая", tone: "sun" }
];

const solvedBoards: Sudoku2x2Value[][] = [
  [1, 2, 2, 1],
  [2, 1, 1, 2]
];

const hiddenCellOrder = [0, 3, 1, 2, 2, 1, 3, 0] as const;

function cellPosition(index: number) {
  return {
    row: Math.floor(index / 2) as 0 | 1,
    col: (index % 2) as 0 | 1
  };
}

function choiceFor(value: Sudoku2x2Value) {
  const choice = sudoku2x2Choices.find((item) => item.value === value);
  if (!choice) throw new Error(`Нет карточки для значения ${value}.`);
  return choice;
}

export function generateSudoku2x2Round(roundIndex = 1): Sudoku2x2Round {
  const safeRoundIndex = Math.max(1, Math.trunc(roundIndex));
  const values = solvedBoards[(safeRoundIndex - 1) % solvedBoards.length];
  const hiddenIndex = hiddenCellOrder[(safeRoundIndex - 1) % hiddenCellOrder.length];

  const board = values.map((value, index) => ({
    id: `cell-${index}`,
    ...cellPosition(index),
    value,
    hidden: index === hiddenIndex
  }));
  const missingCell = board[hiddenIndex];
  const correctChoice = choiceFor(missingCell.value);
  const choices = safeRoundIndex % 2 === 0 ? [...sudoku2x2Choices].reverse() : [...sudoku2x2Choices];

  return {
    roundId: `sudoku-2x2:round:${safeRoundIndex}`,
    prompt: "Какая карточка нужна в пустой клетке?",
    board,
    missingCell,
    choices,
    correctChoice,
    correctIndex: choices.findIndex((choice) => choice.id === correctChoice.id)
  };
}
