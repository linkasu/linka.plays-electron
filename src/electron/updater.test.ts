import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserWindow } from "electron";

const mocks = vi.hoisted(() => ({
  app: { isPackaged: true, getVersion: () => "0.1.22", getAppPath: () => "/missing-app" },
  ipcMain: {
    handle: vi.fn<(channel: string, handler: () => unknown) => void>(),
    on: vi.fn<(channel: string, handler: () => void) => void>(),
  },
  autoUpdater: {
    on: vi.fn<(event: string, listener: (info: { version: string }) => void) => void>(),
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(),
  },
}));

vi.mock("electron", () => ({
  app: mocks.app,
  ipcMain: mocks.ipcMain,
  BrowserWindow: class {
    isDestroyed = () => false;
    webContents = { send: vi.fn() };
  },
}));
vi.mock("electron-updater", () => ({ autoUpdater: mocks.autoUpdater }));
vi.mock("electron-store", () => ({
  default: class {
    get = vi.fn();
    set = vi.fn();
    delete = vi.fn();
  },
}));

const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")!;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.app.isPackaged = true;
  vi.stubEnv("UPDATE_FEED_URL", "https://updates.example.test/");
  vi.stubEnv("UPDATE_TEST_MODE", "0");
});

afterEach(() => {
  Object.defineProperty(process, "platform", platformDescriptor);
  vi.unstubAllEnvs();
});

describe("updater platform policy", () => {
  it.each(["0", "1"])(
    "disables packaged Windows updates with UPDATE_TEST_MODE=%s",
    async (mode) => {
      Object.defineProperty(process, "platform", { value: "win32" });
      vi.stubEnv("UPDATE_TEST_MODE", mode);
      const updater = await import("./updater");
      updater.registerUpdaterHandlers();
      updater.setupAutoUpdater(new BrowserWindow());
      updater.setupAutoUpdater(new BrowserWindow());

      const handlers = new Map(mocks.ipcMain.handle.mock.calls);
      expect(handlers.get("app:version")?.()).toMatchObject({
        version: "0.1.22",
        platform: "win32",
        isPackaged: true,
      });
      expect(handlers.get("updater:getState")?.()).toEqual({
        available: false,
        downloaded: false,
        error: "",
        percent: 0,
        version: "0.1.22",
      });
      for (const [, handler] of mocks.ipcMain.on.mock.calls) handler();
      expect(updater.hasDownloadedUpdate()).toBe(false);
      expect(updater.installDownloadedUpdateOnQuit()).toBe(false);
      expect(mocks.autoUpdater.setFeedURL).not.toHaveBeenCalled();
      expect(mocks.autoUpdater.on).not.toHaveBeenCalled();
      expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
      expect(mocks.autoUpdater.downloadUpdate).not.toHaveBeenCalled();
      expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    },
  );

  it.each(["darwin", "linux"])(
    "preserves checking, download and install on %s",
    async (platform) => {
      Object.defineProperty(process, "platform", { value: platform });
      const updater = await import("./updater");
      updater.setupAutoUpdater(new BrowserWindow());
      updater.setupAutoUpdater(new BrowserWindow());
      expect(mocks.autoUpdater.setFeedURL).toHaveBeenCalledOnce();
      expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledOnce();

      const listeners = new Map(mocks.autoUpdater.on.mock.calls);
      listeners.get("update-available")?.({ version: "0.1.23" });
      expect(mocks.autoUpdater.downloadUpdate).toHaveBeenCalledOnce();
      listeners.get("update-downloaded")?.({ version: "0.1.23" });
      expect(updater.hasDownloadedUpdate()).toBe(true);
      expect(updater.installDownloadedUpdateOnQuit()).toBe(true);
      expect(mocks.autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
    },
  );
});
