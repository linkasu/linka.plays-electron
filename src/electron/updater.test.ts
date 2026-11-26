import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserWindow } from "electron";

const mocks = vi.hoisted(() => ({
  app: {
    isPackaged: true,
    getVersion: () => "0.1.22",
    getAppPath: () => "/missing-app",
    getPath: () => "/test-user-data",
  },
  appendFileSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 0 })),
  renameSync: vi.fn(),
  readFileSync: vi.fn(() => JSON.stringify({ buildSha: "abcdef123456" })),
  ipcMain: {
    handle: vi.fn<(channel: string, handler: () => unknown) => void>(),
    on: vi.fn<(channel: string, handler: () => void) => void>(),
  },
  autoUpdater: {
    on: vi.fn<(event: string, listener: (info: { version: string } | Error) => void) => void>(),
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
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    appendFileSync: mocks.appendFileSync,
    statSync: mocks.statSync,
    renameSync: mocks.renameSync,
    readFileSync: mocks.readFileSync,
    default: {
      ...actual,
      appendFileSync: mocks.appendFileSync,
      statSync: mocks.statSync,
      renameSync: mocks.renameSync,
      readFileSync: mocks.readFileSync,
    },
  };
});
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
  mocks.statSync.mockReturnValue({ size: 0 });
  mocks.autoUpdater.downloadUpdate.mockResolvedValue(undefined);
  mocks.autoUpdater.checkForUpdates.mockResolvedValue(undefined);
  vi.stubEnv("UPDATE_FEED_URL", "https://updates.example.test/");
  vi.stubEnv("UPDATE_TEST_MODE", "0");
  vi.stubEnv("UPDATE_LOG_PATH", undefined);
});

afterEach(() => {
  Object.defineProperty(process, "platform", platformDescriptor);
  vi.unstubAllEnvs();
});

describe("updater platform policy", () => {
  it.each([undefined, "/custom/updater.log"])(
    "logs only safe diagnostics with UPDATE_LOG_PATH=%s",
    async (path) => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      vi.stubEnv("UPDATE_LOG_PATH", path);
      vi.stubEnv("UPDATE_FEED_URL", "https://user:password@updates.test/feed?token=secret");
      const updater = await import("./updater");
      updater.setupAutoUpdater(new BrowserWindow());
      const listeners = new Map(mocks.autoUpdater.on.mock.calls);
      listeners.get("error")?.(
        Object.assign(
          new Error(
            "Cannot find https://user:password@updates.test/?token=secret Bearer hidden-token",
          ),
          { code: "ERR_UPDATER_LATEST_VERSION_NOT_FOUND" },
        ),
      );
      expect(mocks.appendFileSync).toHaveBeenLastCalledWith(
        path ?? "/test-user-data/updater.log",
        expect.stringContaining("ERR_UPDATER_LATEST_VERSION_NOT_FOUND"),
      );
      const log = mocks.appendFileSync.mock.calls.map((call) => call[1]).join("");
      expect(log).toContain("update_error");
      expect(log).toContain("0.1.22");
      expect(log).toContain("abcdef123456");
      for (const secret of ["user:password", "updates.test", "secret", "hidden-token", "Bearer"]) {
        expect(log).not.toContain(secret);
      }
    },
  );

  it("rotates a full log before appending, retaining one backup", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    mocks.statSync.mockReturnValue({ size: 1024 * 1024 });
    const updater = await import("./updater");
    updater.setupAutoUpdater(new BrowserWindow());
    expect(mocks.renameSync).toHaveBeenCalledWith(
      "/test-user-data/updater.log",
      "/test-user-data/updater.log.1",
    );
    expect(mocks.renameSync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.appendFileSync.mock.invocationCallOrder[0]!,
    );
  });

  it("keeps HTTP status but discards unknown token-shaped error codes and release metadata", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const updater = await import("./updater");
    updater.setupAutoUpdater(new BrowserWindow());
    const listeners = new Map(mocks.autoUpdater.on.mock.calls);
    const info = {
      version: "0.1.23",
      releaseNotes: "secret-release-token",
      files: [{ url: "https://user:pass@host/?key=secret" }],
    };
    listeners.get("update-available")?.(info);
    listeners.get("error")?.(
      Object.assign(new Error("Authorization: Bearer secret-token"), {
        code: "secret-error-token",
        statusCode: 404,
      }),
    );
    const log = mocks.appendFileSync.mock.calls.map((call) => call[1]).join("");
    expect(log).toContain("HTTP_404");
    expect(log).toContain("0.1.23");
    expect(log).not.toContain("secret");
    expect(log).not.toContain("user:pass");
    expect(log).not.toContain("Authorization");
  });

  it.each([
    ["event", false],
    ["check", false],
    ["download", false],
    ["event", true],
    ["check", true],
    ["download", true],
  ] as const)(
    "clears installable state after %s failure (downloaded=%s)",
    async (source, downloaded) => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      let rejectCheck!: (error: Error) => void;
      let rejectDownload!: (error: Error) => void;
      mocks.autoUpdater.checkForUpdates.mockReturnValue(
        new Promise((_, reject) => {
          rejectCheck = reject;
        }),
      );
      mocks.autoUpdater.downloadUpdate.mockReturnValue(
        new Promise((_, reject) => {
          rejectDownload = reject;
        }),
      );
      const updater = await import("./updater");
      updater.registerUpdaterHandlers();
      updater.setupAutoUpdater(new BrowserWindow());
      const listeners = new Map(mocks.autoUpdater.on.mock.calls);
      listeners.get("update-available")?.({ version: "0.1.23" });
      if (downloaded) listeners.get("update-downloaded")?.({ version: "0.1.23" });
      expect(updater.hasDownloadedUpdate()).toBe(downloaded);
      const error = new Error("technical failure");
      if (source === "event") listeners.get("error")?.(error);
      if (source === "check") rejectCheck(error);
      if (source === "download") rejectDownload(error);
      await Promise.resolve();
      const handlers = new Map(mocks.ipcMain.handle.mock.calls);
      expect(handlers.get("updater:getState")?.()).toMatchObject({
        available: false,
        downloaded: false,
        percent: 0,
        error: expect.any(String),
      });
      expect(updater.hasDownloadedUpdate()).toBe(false);
      expect(updater.installDownloadedUpdateOnQuit()).toBe(false);
      for (const [, handler] of mocks.ipcMain.on.mock.calls) handler();
      await Promise.resolve();
      expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
      // A late completion from the failed download cannot resurrect the installer.
      listeners.get("update-downloaded")?.({ version: "0.1.23" });
      expect(updater.hasDownloadedUpdate()).toBe(false);
    },
  );

  it.each(["0", "1"])(
    "does not install after an error during restart preparation (test mode=%s)",
    async (mode) => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      vi.stubEnv("UPDATE_TEST_MODE", mode);
      let finishRestart!: () => void;
      const updater = await import("./updater");
      updater.registerUpdaterHandlers({
        onRestart: () =>
          new Promise<void>((resolve) => {
            finishRestart = resolve;
          }),
      });
      updater.setupAutoUpdater(new BrowserWindow());
      const listeners = new Map(mocks.autoUpdater.on.mock.calls);
      listeners.get("update-available")?.({ version: "0.1.23" });
      listeners.get("update-downloaded")?.({ version: "0.1.23" });
      if (mode === "0") {
        for (const [, handler] of mocks.ipcMain.on.mock.calls) handler();
      }
      listeners.get("error")?.(new Error("failed"));
      finishRestart();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(mocks.autoUpdater.quitAndInstall).not.toHaveBeenCalled();
    },
  );

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
