import { describe, expect, it } from "vitest";
import { boardCells, cellIndex, chessCellCount, chessInitialFen, fenSideToMove, parseFenBoard, pieceSide, squareLabel, statusLabel } from "./model";

describe("chess-mini model", () => {
  it("parses the full 8x8 initial chess board", () => {
    const pieces = parseFenBoard(chessInitialFen);

    expect(pieces).toHaveLength(chessCellCount);
    expect(pieces[cellIndex(0, 0)]).toBe("r");
    expect(pieces[cellIndex(0, 4)]).toBe("k");
    expect(pieces[cellIndex(7, 4)]).toBe("K");
    expect(pieces[cellIndex(6, 0)]).toBe("P");
    expect(pieces[cellIndex(4, 4)]).toBe(".");
  });

  it("keeps square labels aligned with chess ranks", () => {
    expect(squareLabel(cellIndex(0, 0))).toBe("A8");
    expect(squareLabel(cellIndex(7, 7))).toBe("H1");
    expect(squareLabel(cellIndex(6, 4))).toBe("E2");
  });

  it("builds render cells with piece ownership", () => {
    const cells = boardCells(chessInitialFen);

    expect(cells).toHaveLength(chessCellCount);
    expect(pieceSide(cells[cellIndex(7, 3)].piece)).toBe("white");
    expect(pieceSide(cells[cellIndex(0, 3)].piece)).toBe("black");
    expect(pieceSide(cells[cellIndex(3, 3)].piece)).toBeUndefined();
  });

  it("reads side-to-move and status labels", () => {
    expect(fenSideToMove(chessInitialFen)).toBe("white");
    expect(fenSideToMove("8/8/8/8/8/8/8/8 b - - 0 1")).toBe("black");
    expect(statusLabel("playing", true)).toContain("Шах");
    expect(statusLabel("draw", false)).toBe("Ничья.");
  });
});
