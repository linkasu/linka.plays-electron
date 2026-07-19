import { BackWatch } from "@linkasu/tobii-electron/main";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { isAbsolute, join } from "path";
import { registerConnectFourAiHandlers } from "./connectFourAi";
import { registerPrivacyIpcHandlers } from "./privacyIpc";
import { clearMetricsTelemetryData, createMetricsTelemetry, type MetricsTelemetry } from "./telemetry";
import { shouldStartTelemetry } from "./telemetry/policy";
import { TelemetryPrivacyController } from "./telemetry/privacyController";
import { TelemetryPrivacyPreferenceStore } from "./telemetry/privacyPreference";
import { registerUpdaterHandlers, setupAutoUpdater } from "./updater";

let mainWindow: BrowserWindow | undefined;
let noTobiiHandlersRegistered = false;
let privacyController: TelemetryPrivacyController<MetricsTelemetry> | undefined;
let quitReason: "app-quit" | "update-restart" = "app-quit";
let quitPreparing = false;
let quitPrepared = false;
const devSession = process.env.LINKA_DEV_SESSION;
const smokeUserDataPath = process.env.LINKA_PRIVACY_SMOKE === "1" ? process.env.LINKA_TEST_USER_DATA_PATH : undefined;
if (smokeUserDataPath && isAbsolute(smokeUserDataPath)) {
  app.setPath("userData", smokeUserDataPath);
} else if (devSession) {
  app.setPath("userData", join(app.getPath("userData"), devSession));
}
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) app.quit();

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
registerConnectFourAiHandlers();
registerPrivacyIpcHandlers({
  getTelemetryPreference: () => privacyController?.getPreference() ?? "unknown",
  setTelemetryPreference: (preference) => {
    if (!privacyController) throw new Error("privacy controller is not ready");
    return privacyController.setPreference(preference);
  }
});
registerUpdaterHandlers({
  onState: (state, version) => privacyController?.telemetry?.recordUpdaterState(state, version),
  onRestart: async () => {
    quitReason = "update-restart";
    await privacyController?.closeGate();
    await privacyController?.telemetry?.shutdown(quitReason);
    quitPrepared = true;
  }
});
ipcMain.on("metrics:event", (_event, input: unknown) => {
  privacyController?.telemetry?.recordRendererEvent(input);
});
ipcMain.on("metrics:session-summary", (_event, input: unknown) => {
  privacyController?.telemetry?.recordRendererSummary(input);
});

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
  win.on("close", () => {
    if (!quitPreparing && !quitPrepared) void privacyController?.telemetry?.interruptActiveSessions("window-close").catch(() => undefined);
  });
  win.on("focus", () => privacyController?.telemetry?.setAppForeground(true));
  win.on("blur", () => privacyController?.telemetry?.setAppForeground(false));
  win.webContents.on("render-process-gone", () => {
    privacyController?.telemetry?.recordError("renderer.crash", { constructor: { name: "RendererProcessGone" } });
    void privacyController?.telemetry?.interruptActiveSessions("renderer-crash").catch(() => undefined);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "https://plays-metric.nkolinka.ru/privacy") void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file:") || url === process.env.VITE_DEV_SERVER_URL) return;
    event.preventDefault();
    if (url === "https://plays-metric.nkolinka.ru/privacy") void shell.openExternal(url);
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
  if (!hasSingleInstanceLock) return;
  const userDataPath = app.getPath("userData");
  privacyController = new TelemetryPrivacyController({
    store: new TelemetryPrivacyPreferenceStore(userDataPath),
    canStartTelemetry: () => shouldStartTelemetry(app.isPackaged, "enabled"),
    createTelemetry: createMetricsTelemetry,
    clearTelemetryData: (preference) => clearMetricsTelemetryData(userDataPath, preference)
  });
  await privacyController.initialize().catch((error) => console.warn("[privacy] failed to initialize", error));
  await createWindow();
});

process.on("uncaughtExceptionMonitor", (error) => {
  privacyController?.telemetry?.recordError("electron.main", error);
});
process.on("unhandledRejection", (reason) => {
  privacyController?.telemetry?.recordError("electron.promise", reason);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", (event) => {
  if (quitPrepared) return;
  event.preventDefault();
  if (quitPreparing) return;
  quitPreparing = true;
  void Promise.resolve(privacyController?.closeGate()).then(() => privacyController?.telemetry?.shutdown(quitReason)).catch(() => undefined).finally(() => {
    quitPrepared = true;
    app.quit();
  });
});
