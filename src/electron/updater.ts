import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";
import Store from "electron-store";
import { appendFileSync } from "fs";

export type AppVersionInfo = {
  version: string;
  platform: NodeJS.Platform;
  isPackaged: boolean;
};

export type UpdaterState = {
  available: boolean;
  downloaded: boolean;
  error: string;
  percent: number;
  version: string;
};

const isUpdateTestMode = process.env.UPDATE_TEST_MODE === "1";
const updateFeedUrl = process.env.UPDATE_FEED_URL;
const updateLogPath = process.env.UPDATE_LOG_PATH;
const UPDATE_RESTART_COOLDOWN_MS = 5 * 60 * 1000;

const updateStore = new Store({ name: "updater" });
const updateState: UpdaterState = {
  available: false,
  downloaded: false,
  error: "",
  percent: 0,
  version: ""
};

let autoUpdaterInitialized = false;
let isDownloadingUpdate = false;
let isQuittingForUpdate = false;
let downloadedVersion: string | null = null;
let mainWindow: BrowserWindow | undefined;

export function registerUpdaterHandlers() {
  ipcMain.handle("app:version", () => ({
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged
  } satisfies AppVersionInfo));
  ipcMain.handle("updater:getState", () => ({ ...updateState }));
  ipcMain.on("updater:restartApp", () => {
    if (isQuittingForUpdate || !downloadedVersion || !updateState.downloaded) return;
    isQuittingForUpdate = true;
    recordUpdateInstallAttempt(downloadedVersion);
    logUpdate("restart_app");
    autoUpdater.quitAndInstall();
  });
}

export function setupAutoUpdater(win: BrowserWindow) {
  mainWindow = win;
  updateState.version = app.getVersion();
  if (autoUpdaterInitialized || !app.isPackaged) return;
  autoUpdaterInitialized = true;

  if (updateFeedUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: updateFeedUrl });
    logUpdate("update_feed_url", { url: updateFeedUrl });
  }

  clearUpdateAttemptIfSucceeded();
  if (shouldSkipUpdateCheck()) {
    console.warn("Skipping update check to avoid restart loop.");
    logUpdate("update_check_skipped");
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("error", (error) => {
    isDownloadingUpdate = false;
    const message = error instanceof Error ? error.message : String(error);
    updateState.error = message;
    updateState.available = false;
    updateState.downloaded = false;
    logUpdate("update_error", { message });
    sendToRenderer("updater:error", message);
  });

  autoUpdater.on("update-available", (info) => {
    if (isDownloadingUpdate) return;
    isDownloadingUpdate = true;
    downloadedVersion = info.version;
    updateState.available = true;
    updateState.downloaded = false;
    updateState.error = "";
    updateState.percent = 0;
    logUpdate("update_available", info);
    sendToRenderer("updater:available", info);
    autoUpdater.downloadUpdate().catch((error) => {
      isDownloadingUpdate = false;
      const message = error instanceof Error ? error.message : String(error);
      updateState.error = message;
      logUpdate("update_download_error", { message });
      sendToRenderer("updater:error", message);
    });
  });

  autoUpdater.on("update-not-available", () => {
    isDownloadingUpdate = false;
    updateState.available = false;
    logUpdate("update_not_available");
  });

  autoUpdater.on("download-progress", (info) => {
    updateState.percent = info.percent;
    logUpdate("download_progress", info);
    sendToRenderer("updater:info", info);
  });

  autoUpdater.on("update-downloaded", (info) => {
    isDownloadingUpdate = false;
    downloadedVersion = info.version;
    updateState.available = false;
    updateState.downloaded = true;
    updateState.error = "";
    updateState.percent = 100;
    logUpdate("update_downloaded", info);
    sendToRenderer("updater:downloaded", info);
    if (isUpdateTestMode && !isQuittingForUpdate) {
      isQuittingForUpdate = true;
      recordUpdateInstallAttempt(downloadedVersion);
      logUpdate("update_test_quit_and_install");
      autoUpdater.quitAndInstall(true, false);
    }
  });

  autoUpdater.checkForUpdates().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    updateState.error = message;
    updateState.available = false;
    updateState.downloaded = false;
    logUpdate("update_check_error", { message });
    sendToRenderer("updater:error", message);
  });
}

function sendToRenderer (channel: string, payload?: unknown) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function logUpdate (message: string, payload?: unknown) {
  if (!updateLogPath) return;
  const safePayload = payload ? ` ${JSON.stringify(payload)}` : "";
  const line = `[${new Date().toISOString()}] ${message}${safePayload}\n`;
  try {
    appendFileSync(updateLogPath, line);
  } catch (error) {
    console.warn("Failed to write update log:", error);
  }
}

function recordUpdateInstallAttempt (version: string | null) {
  updateStore.set("lastAttemptAt", Date.now());
  if (version) updateStore.set("lastAttemptVersion", version);
}

function clearUpdateAttemptIfSucceeded () {
  const lastAttemptVersion = updateStore.get("lastAttemptVersion");
  if (typeof lastAttemptVersion === "string" && lastAttemptVersion && lastAttemptVersion === app.getVersion()) {
    updateStore.delete("lastAttemptAt");
    updateStore.delete("lastAttemptVersion");
  }
}

function shouldSkipUpdateCheck () {
  if (isUpdateTestMode) return false;
  const lastAttemptAt = updateStore.get("lastAttemptAt");
  if (typeof lastAttemptAt !== "number") return false;
  return Date.now() - lastAttemptAt < UPDATE_RESTART_COOLDOWN_MS;
}

export type { ProgressInfo, UpdateInfo };
