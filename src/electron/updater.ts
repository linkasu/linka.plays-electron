import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";
import Store from "electron-store";
import { appendFileSync, readFileSync, renameSync, statSync } from "fs";
import { join } from "path";

export type AppVersionInfo = {
  version: string;
  buildSha: string;
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
const UPDATE_LOG_MAX_BYTES = 1024 * 1024;

const updateStore = new Store({ name: "updater" });
const updateState: UpdaterState = {
  available: false,
  downloaded: false,
  error: "",
  percent: 0,
  version: "",
};

let autoUpdaterInitialized = false;
let isDownloadingUpdate = false;
let isQuittingForUpdate = false;
let downloadedVersion: string | null = null;
let mainWindow: BrowserWindow | undefined;
let telemetryHooks: UpdaterTelemetryHooks = {};

type UpdaterTelemetryHooks = {
  onState?: (
    state:
      "idle" | "checking" | "available" | "downloading" | "downloaded" | "installing" | "error",
    version?: string,
  ) => void;
  onRestart?: () => Promise<void>;
};

export function registerUpdaterHandlers(hooks: UpdaterTelemetryHooks = {}) {
  telemetryHooks = hooks;
  ipcMain.handle("app:version", () => {
    return {
      version: app.getVersion(),
      buildSha: getBuildSha(),
      platform: process.platform,
      isPackaged: app.isPackaged,
    } satisfies AppVersionInfo;
  });
  ipcMain.handle("updater:getState", () => ({ ...updateState }));
  ipcMain.on("updater:restartApp", () => {
    if (isQuittingForUpdate || !downloadedVersion || !updateState.downloaded) return;
    const version = downloadedVersion;
    isQuittingForUpdate = true;
    telemetryHooks.onState?.("installing", downloadedVersion);
    void Promise.resolve(telemetryHooks.onRestart?.())
      .catch(() => undefined)
      .finally(() => {
        if (!updateState.downloaded || downloadedVersion !== version) {
          isQuittingForUpdate = false;
          return;
        }
        recordUpdateInstallAttempt(version);
        logUpdate("restart_app");
        autoUpdater.quitAndInstall();
      });
  });
}

export function setupAutoUpdater(win: BrowserWindow) {
  mainWindow = win;
  updateState.version = app.getVersion();
  // Windows bundles are updated only by the external launcher, including in test mode.
  if (process.platform === "win32" || autoUpdaterInitialized || !app.isPackaged) return;
  autoUpdaterInitialized = true;
  telemetryHooks.onState?.("checking");

  if (updateFeedUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: updateFeedUrl });
    logUpdate("update_feed_configured");
  }

  clearUpdateAttemptIfSucceeded();
  if (shouldSkipUpdateCheck()) {
    telemetryHooks.onState?.("idle");
    console.warn("Skipping update check to avoid restart loop.");
    logUpdate("update_check_skipped");
    return;
  }

  autoUpdater.autoDownload = false;
  // Installed from before-quit by installDownloadedUpdateOnQuit(): electron-updater's own
  // install-on-quit runs the installer silently, and a program reopened during that
  // minute crashed or did not start on half-replaced files.
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("error", (error) => failUpdate("update_error", error));

  autoUpdater.on("update-available", (info) => {
    if (isDownloadingUpdate) return;
    isDownloadingUpdate = true;
    downloadedVersion = null;
    updateState.available = true;
    updateState.downloaded = false;
    updateState.error = "";
    updateState.percent = 0;
    telemetryHooks.onState?.("available", info.version);
    telemetryHooks.onState?.("downloading", info.version);
    logUpdate("update_available", { version: info.version });
    sendToRenderer("updater:available", info);
    autoUpdater.downloadUpdate().catch((error) => failUpdate("update_download_error", error));
  });

  autoUpdater.on("update-not-available", () => {
    isDownloadingUpdate = false;
    downloadedVersion = null;
    updateState.available = false;
    updateState.downloaded = false;
    updateState.error = "";
    updateState.percent = 0;
    telemetryHooks.onState?.("idle");
    logUpdate("update_not_available");
  });

  autoUpdater.on("download-progress", (info) => {
    if (!isDownloadingUpdate) return;
    updateState.percent = info.percent;
    logUpdate("download_progress");
    sendToRenderer("updater:info", info);
  });

  autoUpdater.on("update-downloaded", (info) => {
    if (!isDownloadingUpdate) return;
    isDownloadingUpdate = false;
    downloadedVersion = info.version;
    updateState.available = false;
    updateState.downloaded = true;
    updateState.error = "";
    updateState.percent = 100;
    telemetryHooks.onState?.("downloaded", info.version);
    logUpdate("update_downloaded", { version: info.version });
    sendToRenderer("updater:downloaded", info);
    if (isUpdateTestMode && !isQuittingForUpdate) {
      const version = downloadedVersion;
      isQuittingForUpdate = true;
      telemetryHooks.onState?.("installing", downloadedVersion);
      void Promise.resolve(telemetryHooks.onRestart?.())
        .catch(() => undefined)
        .finally(() => {
          if (!updateState.downloaded || downloadedVersion !== version) {
            isQuittingForUpdate = false;
            return;
          }
          recordUpdateInstallAttempt(version);
          logUpdate("update_test_quit_and_install");
          autoUpdater.quitAndInstall(true, false);
        });
    }
  });

  logUpdate("update_check");
  autoUpdater.checkForUpdates().catch((error) => failUpdate("update_check_error", error));
}

/** True when a downloaded update is waiting to be installed when the program closes. */
export function hasDownloadedUpdate() {
  return (
    app.isPackaged && updateState.downloaded && Boolean(downloadedVersion) && !isQuittingForUpdate
  );
}

/**
 * Testers: after an update the program crashed or did not start for a few minutes.
 * The update was installed silently on quit, so nothing showed it was still being
 * installed. Now the installer runs with its progress window and opens the program
 * again when it is done. Returns false when there is nothing to install.
 */
export function installDownloadedUpdateOnQuit() {
  if (!hasDownloadedUpdate()) return false;
  isQuittingForUpdate = true;
  telemetryHooks.onState?.("installing", downloadedVersion ?? undefined);
  recordUpdateInstallAttempt(downloadedVersion);
  logUpdate("install_on_quit", { version: downloadedVersion });
  // Not silent: the installer shows its progress; it then starts the program itself.
  autoUpdater.quitAndInstall(false, true);
  return true;
}

function sendToRenderer(channel: string, payload?: unknown) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function failUpdate(stage: string, error: unknown) {
  isDownloadingUpdate = false;
  downloadedVersion = null;
  updateState.available = false;
  updateState.downloaded = false;
  updateState.percent = 0;
  // Raw updater errors can contain signed URLs or credentials; keep only a diagnostic code.
  const candidate = error && typeof error === "object" && "code" in error ? error.code : "";
  const status =
    error && typeof error === "object" && "statusCode" in error ? error.statusCode : undefined;
  const code =
    typeof candidate === "string" &&
    /^(ERR_UPDATER_(LATEST_VERSION_NOT_FOUND|INVALID_RELEASE_FEED|INVALID_RELEASE_NOTES|INVALID_PROVIDER_CONFIGURATION|NO_PUBLISHED_VERSIONS|CHANNEL_FILE_NOT_FOUND|INVALID_CHANNEL_FILE|NO_FILES_PROVIDED|CHECKSUM_MISMATCH)|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EACCES|ENOSPC)$/.test(
      candidate,
    )
      ? candidate
      : typeof status === "number" && Number.isInteger(status) && status >= 300 && status <= 599
        ? `HTTP_${status}`
        : "UPDATER_ERROR";
  updateState.error = code;
  telemetryHooks.onState?.("error");
  logUpdate(stage, { code });
  sendToRenderer("updater:error", code);
}

function getBuildSha() {
  try {
    const { buildSha } = JSON.parse(
      readFileSync(join(app.getAppPath(), "package.json"), "utf8"),
    ) as { buildSha?: unknown };
    return typeof buildSha === "string" && /^[a-f0-9]{7,40}$/i.test(buildSha) ? buildSha : "";
  } catch {
    return "";
  }
}

function logUpdate(stage: string, payload?: { version?: string | null; code?: string }) {
  try {
    const path = updateLogPath || join(app.getPath("userData"), "updater.log");
    const safeVersion = (version?: string | null) =>
      version && /^\d{1,6}\.\d{1,6}\.\d{1,6}(?:-[a-z]+\.\d{1,6})?$/.test(version)
        ? version
        : undefined;
    const line = `[${new Date().toISOString()}] ${stage} ${JSON.stringify({
      currentVersion: safeVersion(app.getVersion()),
      version: safeVersion(payload?.version),
      buildSha: getBuildSha(),
      code: payload?.code,
    })}\n`;
    let size = 0;
    try {
      size = statSync(path).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (size + Buffer.byteLength(line) > UPDATE_LOG_MAX_BYTES) renameSync(path, `${path}.1`);
    appendFileSync(path, line);
  } catch {
    console.warn("Failed to write update log.");
  }
}

function recordUpdateInstallAttempt(version: string | null) {
  updateStore.set("lastAttemptAt", Date.now());
  if (version) updateStore.set("lastAttemptVersion", version);
}

function clearUpdateAttemptIfSucceeded() {
  const lastAttemptVersion = updateStore.get("lastAttemptVersion");
  if (
    typeof lastAttemptVersion === "string" &&
    lastAttemptVersion &&
    lastAttemptVersion === app.getVersion()
  ) {
    updateStore.delete("lastAttemptAt");
    updateStore.delete("lastAttemptVersion");
  }
}

function shouldSkipUpdateCheck() {
  if (isUpdateTestMode) return false;
  const lastAttemptAt = updateStore.get("lastAttemptAt");
  if (typeof lastAttemptAt !== "number") return false;
  return Date.now() - lastAttemptAt < UPDATE_RESTART_COOLDOWN_MS;
}

export type { ProgressInfo, UpdateInfo };
