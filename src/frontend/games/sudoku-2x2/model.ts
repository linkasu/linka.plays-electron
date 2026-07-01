export type Sudoku2x2Value = 1 | 2 | 3 | 4 | 5;

export type Sudoku2x2Size = 2 | 3 | 4 | 5;

export type Sudoku2x2Cell = {
  id: string;
  row: number;
  col: number;
  value: Sudoku2x2Value;
  hidden: boolean;
};

export type Sudoku2x2Choice = {
  id: string;
  value: Sudoku2x2Value;
  label: string;
  colorName: string;
  tone: "sky" | "sun" | "mint" | "rose" | "violet";
};

export type Sudoku2x2Round = {
  roundId: string;
  prompt: string;
  size: Sudoku2x2Size;
  board: Sudoku2x2Cell[];
  missingCell: Sudoku2x2Cell;
  choices: Sudoku2x2Choice[];
  correctChoice: Sudoku2x2Choice;
  correctIndex: number;
};

export const sudoku2x2Choices: Sudoku2x2Choice[] = [
  { id: "card-1", value: 1, label: "1", colorName: "синяя", tone: "sky" },
  { id: "card-2", value: 2, label: "2", colorName: "жёлтая", tone: "sun" },
  { id: "card-3", value: 3, label: "3", colorName: "зелёная", tone: "mint" },
  { id: "card-4", value: 4, label: "4", colorName: "розовая", tone: "rose" },
  { id: "card-5", value: 5, label: "5", colorName: "фиолетовая", tone: "violet" }
];

function boardSizeForRound(roundIndex: number): Sudoku2x2Size {
  return Math.min(5, 2 + Math.floor((roundIndex - 1) / 2)) as Sudoku2x2Size;
}

function choiceFor(value: Sudoku2x2Value) {
  const choice = sudoku2x2Choices.find((item) => item.value === value);
  if (!choice) throw new Error(`Нет карточки для значения ${value}.`);
  return choice;
}

function choicesForSize(size: Sudoku2x2Size, roundIndex: number) {
  const choices = sudoku2x2Choices.slice(0, size);
  return roundIndex % 2 === 0 ? [...choices].reverse() : choices;
}

function cellValue(size: Sudoku2x2Size, row: number, col: number, roundIndex: number): Sudoku2x2Value {
  const offset = (roundIndex - 1) % size;
  return (((row + col + offset) % size) + 1) as Sudoku2x2Value;
}

function hiddenIndexFor(size: Sudoku2x2Size, roundIndex: number) {
  return ((roundIndex - 1) * 3) % (size * size);
}

export function generateSudoku2x2Round(roundIndex = 1): Sudoku2x2Round {
  const safeRoundIndex = Math.max(1, Math.trunc(roundIndex));
  const size = boardSizeForRound(safeRoundIndex);
  const hiddenIndex = hiddenIndexFor(size, safeRoundIndex);

  const board = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;

    return {
      id: `cell-${index}`,
      row,
      col,
      value: cellValue(size, row, col, safeRoundIndex),
      hidden: index === hiddenIndex
    };
  });
  const missingCell = board[hiddenIndex];
  if (!missingCell) throw new Error("Не удалось выбрать пустую клетку судоку.");

  const correctChoice = choiceFor(missingCell.value);
  const choices = choicesForSize(size, safeRoundIndex);

  return {
    roundId: `sudoku-2x2:round:${safeRoundIndex}`,
    prompt: `Судоку ${size}×${size}: какая карточка нужна в пустой клетке?`,
    size,
    board,
    missingCell,
    choices,
    correctChoice,
    correctIndex: choices.findIndex((choice) => choice.id === correctChoice.id)
  };
}
