import { contextBridge, ipcRenderer } from "electron";

type Dispose = () => void;

contextBridge.exposeInMainWorld("linkaTobii", {
  getStatus: () => ipcRenderer.invoke("tobii:status:get"),
  rendererReady: () => ipcRenderer.send("tobii:renderer-ready"),
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
