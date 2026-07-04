export const chessBoardSize = 8;
export const chessCellCount = chessBoardSize * chessBoardSize;
export const chessInitialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type ChessSide = "white" | "black";
export type ChessStatus = "playing" | "white-win" | "black-win" | "draw";
export type ChessPiece = "P" | "N" | "B" | "R" | "Q" | "K" | "p" | "n" | "b" | "r" | "q" | "k" | ".";

export type ChessCell = {
  index: number;
  row: number;
  column: number;
  label: string;
  piece: ChessPiece;
};

export const chessPieceMeta: Record<Exclude<ChessPiece, ".">, { label: string; icon: string; side: ChessSide }> = {
  P: { label: "Пешка", icon: "mdi-chess-pawn", side: "white" },
  N: { label: "Конь", icon: "mdi-chess-knight", side: "white" },
  B: { label: "Слон", icon: "mdi-chess-bishop", side: "white" },
  R: { label: "Ладья", icon: "mdi-chess-rook", side: "white" },
  Q: { label: "Ферзь", icon: "mdi-chess-queen", side: "white" },
  K: { label: "Король", icon: "mdi-chess-king", side: "white" },
  p: { label: "Пешка", icon: "mdi-chess-pawn", side: "black" },
  n: { label: "Конь", icon: "mdi-chess-knight", side: "black" },
  b: { label: "Слон", icon: "mdi-chess-bishop", side: "black" },
  r: { label: "Ладья", icon: "mdi-chess-rook", side: "black" },
  q: { label: "Ферзь", icon: "mdi-chess-queen", side: "black" },
  k: { label: "Король", icon: "mdi-chess-king", side: "black" }
};

export function cellIndex(row: number, column: number) {
  return row * chessBoardSize + column;
}

export function cellPosition(index: number) {
  return {
    row: Math.floor(index / chessBoardSize),
    column: index % chessBoardSize
  };
}

export function squareLabel(index: number) {
  const { row, column } = cellPosition(index);
  return `${String.fromCharCode(65 + column)}${chessBoardSize - row}`;
}

export function fenSideToMove(fen: string): ChessSide {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

export function parseFenBoard(fen: string): ChessPiece[] {
  const placement = fen.split(" ")[0] ?? "";
  const cells: ChessPiece[] = [];

  for (const token of placement) {
    if (token === "/") continue;
    if (/^[1-8]$/.test(token)) {
      cells.push(...Array.from({ length: Number(token) }, () => "." as ChessPiece));
      continue;
    }
    cells.push(token as ChessPiece);
  }

  return Array.from({ length: chessCellCount }, (_, index) => cells[index] ?? ".");
}

export function boardCells(fen: string): ChessCell[] {
  const pieces = parseFenBoard(fen);
  return Array.from({ length: chessCellCount }, (_, index) => {
    const { row, column } = cellPosition(index);
    return { index, row, column, label: squareLabel(index), piece: pieces[index] };
  });
}

export function isWhitePiece(piece: ChessPiece) {
  return piece !== "." && piece === piece.toUpperCase();
}

export function isBlackPiece(piece: ChessPiece) {
  return piece !== "." && piece === piece.toLowerCase();
}

export function pieceSide(piece: ChessPiece): ChessSide | undefined {
  if (isWhitePiece(piece)) return "white";
  if (isBlackPiece(piece)) return "black";
  return undefined;
}

export function statusLabel(status: ChessStatus, check: boolean) {
  if (status === "white-win") return "Мат. Белые выиграли.";
  if (status === "black-win") return "Мат. Чёрные выиграли.";
  if (status === "draw") return "Ничья.";
  return check ? "Шах. Найди безопасный ход." : "Партия идёт.";
}
