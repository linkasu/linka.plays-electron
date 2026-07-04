/// <reference types="vite/client" />

declare global {
  type TobiiStatusState =
    | "unsupported"
    | "service_starting"
    | "service_unavailable"
    | "connecting"
    | "waiting_device"
    | "connected"
    | "tracking"
    | "reconnecting"
    | "error";

  type TobiiStatus = {
    state: TobiiStatusState;
    mode: "socket-service" | "direct" | "native" | "unsupported";
    message: string;
    socketPath?: string;
    servicePid?: number;
    deviceFound: boolean;
    lastGazeAt?: number;
    lastError?: string;
    reconnectAttempt?: number;
    updatedAt: number;
  };

  type GazePoint = {
    x: number;
    y: number;
    valid: boolean;
    source: "tobii" | "mouse";
    timestamp?: number;
  };

  type Dispose = () => void;

  type ConnectFourAiResult = {
    ok: boolean;
    column?: number;
    score?: number;
    depth?: number;
    nodes?: number;
    elapsedMs?: number;
    timedOut?: boolean;
    source: "native" | "fallback";
    error?: string;
  };

  type ReversiLightAiResult = {
    ok: boolean;
    move?: number;
    score?: number;
    depth?: number;
    nodes?: number;
    elapsedMs?: number;
    timedOut?: boolean;
    source: "native" | "fallback";
    error?: string;
  };

  type CheckersLightAiResult = {
    ok: boolean;
    fromIndex?: number;
    toIndex?: number;
    capturedIndex?: number;
    score?: number;
    depth?: number;
    nodes?: number;
    elapsedMs?: number;
    timedOut?: boolean;
    source: "native" | "fallback";
    error?: string;
  };

  type ChessMiniMove = {
    fromIndex: number;
    toIndex: number;
    from: string;
    to: string;
    flags: number;
    promotion?: string;
  };

  type ChessMiniAiResult = {
    ok: boolean;
    fen?: string;
    status?: "playing" | "white-win" | "black-win" | "draw";
    reason?: string;
    check?: boolean;
    fromIndex?: number;
    toIndex?: number;
    promotion?: string;
    score?: number;
    depth?: number;
    nodes?: number;
    elapsedMs?: number;
    timedOut?: boolean;
    moves?: ChessMiniMove[];
    source: "native" | "fallback";
    error?: string;
  };

  interface Window {
    linkaTobii?: {
      getStatus: () => Promise<TobiiStatus>;
      rendererReady: () => void;
      startCalibration: () => Promise<boolean>;
      addCalibrationPoint: (point: { x: number; y: number }) => Promise<boolean>;
      finishCalibration: () => Promise<boolean>;
      applySavedCalibration: () => Promise<boolean>;
      restartService: () => Promise<boolean>;
      onStatus: (listener: (status: TobiiStatus) => void) => Dispose;
      onGaze: (listener: (point: GazePoint) => void) => Dispose;
    };
    linkaAi?: {
      connectFourBestMove: (payload: { board: string; player?: "R" | "Y"; depth?: number; timeLimitMs?: number; threads?: number }) => Promise<ConnectFourAiResult>;
      reversiLightBestMove: (payload: { board: string; player?: "R" | "Y"; depth?: number; timeLimitMs?: number }) => Promise<ReversiLightAiResult>;
      checkersLightBestMove: (payload: { board: string; side?: "gold" | "blue"; depth?: number; timeLimitMs?: number; forcedFrom?: number }) => Promise<CheckersLightAiResult>;
      chessMiniLegalMoves: (payload: { fen: string }) => Promise<ChessMiniAiResult>;
      chessMiniApplyMove: (payload: { fen: string; fromIndex: number; toIndex: number; promotion?: string }) => Promise<ChessMiniAiResult>;
      chessMiniBestMove: (payload: { fen: string; depth?: number; timeLimitMs?: number }) => Promise<ChessMiniAiResult>;
    };
  }
}

export {};
