import { contextBridge, ipcRenderer } from "electron";

type Dispose = () => void;

contextBridge.exposeInMainWorld("linkaTobii", {
  getStatus: () => ipcRenderer.invoke("tobii:status:get"),
  rendererReady: () => ipcRenderer.send("tobii:renderer-ready"),
  startCalibration: () => ipcRenderer.invoke("tobii:calibration:start"),
  addCalibrationPoint: (point: { x: number; y: number }) => ipcRenderer.invoke("tobii:calibration:add-point", point),
  finishCalibration: () => ipcRenderer.invoke("tobii:calibration:finish"),
  applySavedCalibration: () => ipcRenderer.invoke("tobii:calibration:apply-saved"),
  restartService: () => ipcRenderer.invoke("tobii:service:restart"),
  onStatus: (listener: (status: unknown) => void): Dispose => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => listener(status);
    ipcRenderer.on("tobii:status", handler);
    return () => ipcRenderer.off("tobii:status", handler);
  },
  onGaze: (listener: (point: unknown) => void): Dispose => {
    const handler = (_event: Electron.IpcRendererEvent, point: unknown) => listener(point);
    ipcRenderer.on("tobii:gaze", handler);
    return () => ipcRenderer.off("tobii:gaze", handler);
  }
});

contextBridge.exposeInMainWorld("linkaAi", {
  connectFourBestMove: (payload: { board: string; player?: "R" | "Y"; depth?: number; timeLimitMs?: number; threads?: number }) => ipcRenderer.invoke("connect-four:best-move", payload),
  reversiLightBestMove: (payload: { board: string; player?: "R" | "Y"; depth?: number; timeLimitMs?: number }) => ipcRenderer.invoke("reversi-light:best-move", payload),
  checkersLightBestMove: (payload: { board: string; side?: "gold" | "blue"; depth?: number; timeLimitMs?: number; forcedFrom?: number }) => ipcRenderer.invoke("checkers-light:best-move", payload),
  chessMiniLegalMoves: (payload: { fen: string }) => ipcRenderer.invoke("chess-mini:legal-moves", payload),
  chessMiniApplyMove: (payload: { fen: string; fromIndex: number; toIndex: number; promotion?: string }) => ipcRenderer.invoke("chess-mini:apply-move", payload),
  chessMiniBestMove: (payload: { fen: string; depth?: number; timeLimitMs?: number }) => ipcRenderer.invoke("chess-mini:best-move", payload)
});

contextBridge.exposeInMainWorld("linkaUpdater", {
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  getState: () => ipcRenderer.invoke("updater:getState"),
  restartApp: () => ipcRenderer.send("updater:restartApp"),
  onInfo: (listener: (info: unknown) => void): Dispose => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown) => listener(info);
    ipcRenderer.on("updater:info", handler);
    return () => ipcRenderer.off("updater:info", handler);
  },
  onAvailable: (listener: (info: unknown) => void): Dispose => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown) => listener(info);
    ipcRenderer.on("updater:available", handler);
    return () => ipcRenderer.off("updater:available", handler);
  },
  onDownloaded: (listener: (info: unknown) => void): Dispose => {
    const handler = (_event: Electron.IpcRendererEvent, info: unknown) => listener(info);
    ipcRenderer.on("updater:downloaded", handler);
    return () => ipcRenderer.off("updater:downloaded", handler);
  },
  onError: (listener: (message: string) => void): Dispose => {
    const handler = (_event: Electron.IpcRendererEvent, message: string) => listener(message);
    ipcRenderer.on("updater:error", handler);
    return () => ipcRenderer.off("updater:error", handler);
  }
});
