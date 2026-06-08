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
  }
}

export {};
