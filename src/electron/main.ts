import { BackWatch } from "@linkasu/tobii-electron/main";
import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { registerConnectFourAiHandlers } from "./connectFourAi";
import { registerDiagnosticsHandlers } from "./diagnostics";
import { registerUpdaterHandlers, setupAutoUpdater } from "./updater";

let mainWindow: BrowserWindow | undefined;
let noTobiiHandlersRegistered = false;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
registerConnectFourAiHandlers();
registerDiagnosticsHandlers();
registerUpdaterHandlers();

const devSession = process.env.LINKA_DEV_SESSION;
if (devSession) {
  app.setPath("userData", join(app.getPath("userData"), devSession));
}

function disabledTobiiStatus() {
  return {
    state: "unsupported",
    mode: "unsupported",
    message: "Tobii отключён для debug-сеанса, используется мышь.",
    deviceFound: false,
    updatedAt: Date.now()
  };
}

function registerNoTobiiHandlers() {
  if (noTobiiHandlersRegistered) return;
  noTobiiHandlersRegistered = true;
  ipcMain.handle("tobii:status:get", () => disabledTobiiStatus());
  ipcMain.handle("tobii:diagnostics:get", () => ({
    status: disabledTobiiStatus(),
    coordinateScaleMode: "one",
    appliedScaleFactor: 1,
    recentTrackerDebug: [],
    recentGaze: []
  }));
  ipcMain.handle("tobii:diagnostics:set-scale-mode", () => ({
    status: disabledTobiiStatus(),
    coordinateScaleMode: "one",
    appliedScaleFactor: 1,
    recentTrackerDebug: [],
    recentGaze: []
  }));
  ipcMain.handle("tobii:calibration:start", () => false);
  ipcMain.handle("tobii:calibration:add-point", () => false);
  ipcMain.handle("tobii:calibration:finish", () => false);
  ipcMain.handle("tobii:calibration:apply-saved", () => false);
  ipcMain.handle("tobii:service:restart", () => false);
  ipcMain.on("tobii:renderer-ready", (event) => {
    event.sender.send("tobii:status", disabledTobiiStatus());
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#fbf7ef",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow = win;
  if (process.env.LINKA_NO_TOBII === "1") {
    registerNoTobiiHandlers();
  } else {
    const backWatch = new BackWatch(win, {
      socketName: process.env.LINKA_TOBII_SOCKET_NAME ?? "su.linka.plays.tobiifree",
      showStartupError: false
    });
    void backWatch;
  }
  win.on("closed", () => {
    mainWindow = undefined;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    await win.loadFile(join(__dirname, "..", "dist", "index.html"));
  }
  setupAutoUpdater(win);
}

app.whenReady().then(async () => {
  await createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
