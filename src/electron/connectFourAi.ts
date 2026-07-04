import { app, ipcMain } from "electron";
import { existsSync } from "fs";
import { createRequire } from "module";
import { join } from "path";

type ConnectFourAiResult = {
  ok: boolean;
  column: number;
  score: number;
  depth: number;
  nodes: number;
  elapsedMs: number;
  timedOut: boolean;
  source: "native";
};

type ConnectFourAiAddon = {
  findBestMove: (board: string, player: "R" | "Y", depth: number, timeLimitMs: number, threads: number) => Promise<Omit<ConnectFourAiResult, "source">>;
  findBestReversiMove?: (board: string, player: "R" | "Y", depth: number, timeLimitMs: number) => Promise<{
    ok: boolean;
    move: number;
    score: number;
    depth: number;
    nodes: number;
    elapsedMs: number;
    timedOut: boolean;
  }>;
  findBestCheckersMove?: (board: string, side: "gold" | "blue", depth: number, timeLimitMs: number, forcedFrom: number) => Promise<{
    ok: boolean;
    fromIndex: number;
    toIndex: number;
    capturedIndex: number;
    score: number;
    depth: number;
    nodes: number;
    elapsedMs: number;
    timedOut: boolean;
  }>;
  chessLegalMoves?: (fen: string) => Promise<ChessMiniNativeResult>;
  chessApplyMove?: (fen: string, fromIndex: number, toIndex: number, promotion: string) => Promise<ChessMiniNativeResult>;
  chessBestMove?: (fen: string, depth: number, timeLimitMs: number) => Promise<ChessMiniNativeResult>;
};

type ChessMiniMove = {
  fromIndex: number;
  toIndex: number;
  from: string;
  to: string;
  flags: number;
  promotion?: string;
};

type ChessMiniNativeResult = {
  ok: boolean;
  fen: string;
  status: "playing" | "white-win" | "black-win" | "draw";
  reason: string;
  check: boolean;
  fromIndex: number;
  toIndex: number;
  promotion?: string;
  score: number;
  depth: number;
  nodes: number;
  elapsedMs: number;
  timedOut: boolean;
  moves: ChessMiniMove[];
};

const requireNative = createRequire(__filename);
let cachedAddon: ConnectFourAiAddon | undefined;
let loadAttempted = false;

function addonCandidates() {
  const binaryName = "connect_four_ai.node";
  const candidates = [
    process.env.LINKA_CONNECT_FOUR_AI_ADDON,
    join(process.cwd(), "build", "Release", binaryName),
    join(process.resourcesPath, "native", binaryName)
  ];

  if (app.isPackaged) candidates.push(join(process.resourcesPath, "app.asar.unpacked", "build", "Release", binaryName));
  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

function loadAddon() {
  if (loadAttempted) return cachedAddon;
  loadAttempted = true;

  for (const candidate of addonCandidates()) {
    if (!existsSync(candidate)) continue;
    try {
      cachedAddon = requireNative(candidate) as ConnectFourAiAddon;
      return cachedAddon;
    } catch (error) {
      console.warn(`Failed to load Connect Four AI addon from ${candidate}`, error);
    }
  }

  return undefined;
}

function normalizeBoard(board: unknown) {
  if (typeof board !== "string" || board.length !== 42) return undefined;
  return Array.from(board).every((cell) => cell === "." || cell === "R" || cell === "Y") ? board : undefined;
}

function normalizeReversiBoard(board: unknown) {
  if (typeof board !== "string" || board.length !== 16) return undefined;
  return Array.from(board).every((cell) => cell === "." || cell === "R" || cell === "Y") ? board : undefined;
}

function normalizeCheckersBoard(board: unknown) {
  if (typeof board !== "string" || board.length !== 64) return undefined;
  return Array.from(board).every((cell) => cell === "." || cell === "g" || cell === "G" || cell === "b" || cell === "B") ? board : undefined;
}

function normalizeChessFen(fen: unknown) {
  if (typeof fen !== "string" || fen.length < 15 || fen.length > 128) return undefined;
  return /^[pnbrqkPNBRQK1-8/\s\-a-h0-9KQkqwb]+$/.test(fen) ? fen : undefined;
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.min(max, Math.floor(value)) : fallback;
}

export function registerConnectFourAiHandlers() {
  ipcMain.handle("connect-four:best-move", async (_event, payload: { board?: unknown; player?: unknown; depth?: unknown; timeLimitMs?: unknown; threads?: unknown } = {}) => {
    const addon = loadAddon();
    const board = normalizeBoard(payload.board);
    if (!addon || !board) return { ok: false, error: addon ? "invalid-board" : "native-addon-unavailable", source: "fallback" as const };

    const player = payload.player === "R" ? "R" : "Y";
    const depth = normalizePositiveInteger(payload.depth, 16, 24);
    const timeLimitMs = normalizePositiveInteger(payload.timeLimitMs, 1800, 15000);
    const threads = normalizePositiveInteger(payload.threads, 0, 32);

    try {
      const result = await addon.findBestMove(board, player, depth, timeLimitMs, threads);
      return { ...result, ok: result.ok && result.column >= 0 && result.column < 7, source: "native" as const };
    } catch (error) {
      console.warn("Connect Four AI addon failed", error);
      return { ok: false, error: "native-addon-failed", source: "fallback" as const };
    }
  });

  ipcMain.handle("reversi-light:best-move", async (_event, payload: { board?: unknown; player?: unknown; depth?: unknown; timeLimitMs?: unknown } = {}) => {
    const addon = loadAddon();
    const board = normalizeReversiBoard(payload.board);
    if (!addon?.findBestReversiMove || !board) return { ok: false, error: addon ? "invalid-board" : "native-addon-unavailable", source: "fallback" as const };

    const player = payload.player === "R" ? "R" : "Y";
    const depth = normalizePositiveInteger(payload.depth, 12, 16);
    const timeLimitMs = normalizePositiveInteger(payload.timeLimitMs, 800, 3000);

    try {
      const result = await addon.findBestReversiMove(board, player, depth, timeLimitMs);
      return { ...result, ok: result.ok && result.move >= 0 && result.move < 16, source: "native" as const };
    } catch (error) {
      console.warn("Reversi Light AI addon failed", error);
      return { ok: false, error: "native-addon-failed", source: "fallback" as const };
    }
  });

  ipcMain.handle("checkers-light:best-move", async (_event, payload: { board?: unknown; side?: unknown; depth?: unknown; timeLimitMs?: unknown; forcedFrom?: unknown } = {}) => {
    const addon = loadAddon();
    const board = normalizeCheckersBoard(payload.board);
    if (!addon?.findBestCheckersMove || !board) return { ok: false, error: addon ? "invalid-board" : "native-addon-unavailable", source: "fallback" as const };

    const side = payload.side === "gold" ? "gold" : "blue";
    const depth = normalizePositiveInteger(payload.depth, 6, 12);
    const timeLimitMs = normalizePositiveInteger(payload.timeLimitMs, 1200, 5000);
    const forcedFrom = typeof payload.forcedFrom === "number" && Number.isFinite(payload.forcedFrom) ? Math.floor(payload.forcedFrom) : -1;

    try {
      const result = await addon.findBestCheckersMove(board, side, depth, timeLimitMs, forcedFrom);
      return { ...result, ok: result.ok && result.fromIndex >= 0 && result.toIndex >= 0, source: "native" as const };
    } catch (error) {
      console.warn("Checkers Light AI addon failed", error);
      return { ok: false, error: "native-addon-failed", source: "fallback" as const };
    }
  });

  ipcMain.handle("chess-mini:legal-moves", async (_event, payload: { fen?: unknown } = {}) => {
    const addon = loadAddon();
    const fen = normalizeChessFen(payload.fen);
    if (!addon?.chessLegalMoves || !fen) return { ok: false, error: addon ? "invalid-fen" : "native-addon-unavailable", source: "fallback" as const };

    try {
      const result = await addon.chessLegalMoves(fen);
      return { ...result, source: "native" as const };
    } catch (error) {
      console.warn("Chess Mini legal moves addon failed", error);
      return { ok: false, error: "native-addon-failed", source: "fallback" as const };
    }
  });

  ipcMain.handle("chess-mini:apply-move", async (_event, payload: { fen?: unknown; fromIndex?: unknown; toIndex?: unknown; promotion?: unknown } = {}) => {
    const addon = loadAddon();
    const fen = normalizeChessFen(payload.fen);
    const fromIndex = typeof payload.fromIndex === "number" && Number.isFinite(payload.fromIndex) ? Math.floor(payload.fromIndex) : -1;
    const toIndex = typeof payload.toIndex === "number" && Number.isFinite(payload.toIndex) ? Math.floor(payload.toIndex) : -1;
    const promotion = typeof payload.promotion === "string" && payload.promotion.length > 0 ? payload.promotion[0] : "q";
    if (!addon?.chessApplyMove || !fen || fromIndex < 0 || fromIndex >= 64 || toIndex < 0 || toIndex >= 64) return { ok: false, error: addon ? "invalid-move" : "native-addon-unavailable", source: "fallback" as const };

    try {
      const result = await addon.chessApplyMove(fen, fromIndex, toIndex, promotion);
      return { ...result, source: "native" as const };
    } catch (error) {
      console.warn("Chess Mini apply move addon failed", error);
      return { ok: false, error: "native-addon-failed", source: "fallback" as const };
    }
  });

  ipcMain.handle("chess-mini:best-move", async (_event, payload: { fen?: unknown; depth?: unknown; timeLimitMs?: unknown } = {}) => {
    const addon = loadAddon();
    const fen = normalizeChessFen(payload.fen);
    if (!addon?.chessBestMove || !fen) return { ok: false, error: addon ? "invalid-fen" : "native-addon-unavailable", source: "fallback" as const };

    const depth = normalizePositiveInteger(payload.depth, 16, 16);
    const timeLimitMs = normalizePositiveInteger(payload.timeLimitMs, 1500, 5000);

    try {
      const result = await addon.chessBestMove(fen, depth, timeLimitMs);
      return { ...result, ok: result.ok && result.fromIndex >= 0 && result.toIndex >= 0, source: "native" as const };
    } catch (error) {
      console.warn("Chess Mini AI addon failed", error);
      return { ok: false, error: "native-addon-failed", source: "fallback" as const };
    }
  });
}
