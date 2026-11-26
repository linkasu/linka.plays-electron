import { createApp, defineComponent, h, nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gazeTargetSnapshot } from "../core/domGazeTargetCoordinator";
import UpdateStatusBar from "./UpdateStatusBar.vue";

describe("UpdateStatusBar", () => {
  let unmount: (() => void) | undefined;

  function mount() {
    const root = document.createElement("div");
    document.body.append(root);
    const app = createApp(UpdateStatusBar);
    app.component(
      "VSnackbar",
      defineComponent({
        props: ["modelValue"],
        setup:
          (props, { slots }) =>
          () =>
            h(
              "div",
              {
                class: ["v-snackbar", { "v-snackbar--active": props.modelValue }],
              },
              [slots.default?.(), slots.actions?.()],
            ),
      }),
    );
    app.component(
      "VCard",
      defineComponent({
        props: ["tag"],
        setup:
          (props, { slots }) =>
          () =>
            h(props.tag ?? "div", slots.default?.()),
      }),
    );
    for (const name of ["VChip", "VIcon", "VProgressLinear"]) {
      app.component(
        name,
        defineComponent({
          setup:
            (_, { slots }) =>
            () =>
              h("span", slots.default?.()),
        }),
      );
    }
    app.mount(root);
    unmount = () => app.unmount();
    return app;
  }

  function bridge() {
    const dispose = vi.fn();
    window.linkaUpdater = {
      getAppVersion: vi.fn(async () => ({
        version: "3.0.1",
        buildSha: "",
        platform: "darwin",
        isPackaged: true,
      })),
      getState: vi.fn(async () => ({
        available: false,
        downloaded: false,
        error: "",
        percent: 0,
        version: "3.0.1",
      })),
      restartApp: vi.fn(),
      onError: vi.fn(() => dispose),
      onAvailable: vi.fn(() => dispose),
      onDownloaded: vi.fn(() => dispose),
      onInfo: vi.fn(() => dispose),
    };
    return { api: window.linkaUpdater, dispose };
  }

  afterEach(() => {
    unmount?.();
    delete window.linkaUpdater;
    delete window.linkaTobii;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("disposes subscriptions when unmounted before IPC snapshots resolve", async () => {
    const { api, dispose } = bridge();
    let resolveVersion!: (value: AppVersionInfo) => void;
    vi.mocked(api.getAppVersion).mockReturnValue(
      new Promise((resolve) => {
        resolveVersion = resolve;
      }),
    );
    const app = mount();
    app.unmount();
    unmount = undefined;
    resolveVersion({ version: "3.0.1", buildSha: "", platform: "darwin", isPackaged: true });
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();
    expect(dispose).toHaveBeenCalledTimes(4);
  });

  it.each(["getAppVersion", "getState"] as const)("handles %s IPC rejection", async (method) => {
    const { api, dispose } = bridge();
    vi.mocked(api[method]).mockRejectedValue(new Error("private-token"));
    mount();
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();
    expect(api.onError).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain("private-token");
    if (method === "getState")
      expect(document.body.textContent).toContain("Можно продолжать играть");
    unmount?.();
    unmount = undefined;
    expect(dispose).toHaveBeenCalledTimes(4);
  });

  it("keeps a live event newer than an in-flight IPC snapshot", async () => {
    const { api } = bridge();
    let resolveState!: (state: UpdaterState) => void;
    vi.mocked(api.getState).mockReturnValue(
      new Promise((resolve) => {
        resolveState = resolve;
      }),
    );
    mount();
    const callback = vi.mocked(api.onDownloaded).mock.calls[0]?.[0];
    expect(callback).toBeDefined();
    callback?.({ version: "3.0.2" });
    resolveState({ available: true, downloaded: false, error: "", percent: 5, version: "3.0.1" });
    await Promise.resolve();
    await nextTick();
    expect(document.body.textContent).toContain("Обновление готово");
    expect(document.body.textContent).not.toContain("Загружается обновление");
  });

  it("combines in-flight progress with the active-download snapshot", async () => {
    const { api } = bridge();
    let resolveState!: (state: UpdaterState) => void;
    vi.mocked(api.getState).mockReturnValue(
      new Promise((resolve) => {
        resolveState = resolve;
      }),
    );
    mount();
    vi.mocked(api.onInfo).mock.calls[0]![0]({ percent: 42 });
    resolveState({ available: true, downloaded: false, error: "", percent: 5, version: "3.0.1" });
    await Promise.resolve();
    await nextTick();
    expect(document.body.textContent).toContain("Загружается обновление");
    expect(document.body.textContent).toContain("42%");
  });

  it("dismisses with a real gaze dwell on the close target", async () => {
    const { api } = bridge();
    let onGaze!: (point: GazePoint) => void;
    window.linkaTobii = {
      getStatus: vi.fn(),
      getDiagnostics: vi.fn(),
      setCoordinateScaleMode: vi.fn(),
      rendererReady: vi.fn(),
      startCalibration: vi.fn(),
      addCalibrationPoint: vi.fn(),
      finishCalibration: vi.fn(),
      applySavedCalibration: vi.fn(),
      restartService: vi.fn(),
      onStatus: vi.fn(),
      onGaze: (callback) => {
        onGaze = callback;
        return vi.fn();
      },
    };
    let now = 1_000_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.set(++id, callback);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frame) => {
      frames.delete(frame);
    });
    mount();
    vi.mocked(api.onError).mock.calls[0]![0]("technical error");
    await nextTick();
    const target = gazeTargetSnapshot().find((entry) => entry.id === "update-status-close")!;
    expect(target).toBeDefined();
    vi.spyOn(target.element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 200, 200));
    for (let step = 0; step < 25; step++) {
      now += 50;
      onGaze({ x: 100, y: 100, valid: true, source: "tobii", timestamp: Date.now() });
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(now);
      await nextTick();
    }
    expect(document.querySelector(".v-snackbar--active")).toBeNull();
    expect(gazeTargetSnapshot().map((entry) => entry.id)).not.toContain("update-status-close");
  });

  it("hides technical errors and dismisses only the current notification", async () => {
    let onError!: (message: string) => void;
    let onAvailable!: (info: UpdateInfo) => void;
    let onDownloaded!: (info: UpdateInfo) => void;
    let onInfo!: (info: UpdateProgressInfo) => void;
    const dispose = vi.fn();
    window.linkaUpdater = {
      getAppVersion: async () => ({
        version: "3.0.1",
        buildSha: "",
        platform: "win32",
        isPackaged: true,
      }),
      getState: async () => ({
        available: false,
        downloaded: false,
        error: "HttpError: https://private.example/latest.yml token=secret",
        percent: 0,
        version: "",
      }),
      restartApp: vi.fn(),
      onError: (callback) => ((onError = callback), dispose),
      onAvailable: (callback) => ((onAvailable = callback), dispose),
      onDownloaded: (callback) => ((onDownloaded = callback), dispose),
      onInfo: (callback) => ((onInfo = callback), dispose),
    };
    // Keep the updater and dwell control real; only replace Vuetify's visual shells.
    const app = mount();
    // The mounted hook awaits both IPC snapshots before updating the renderer.
    await Promise.resolve();
    await Promise.resolve();
    await nextTick();
    await nextTick();

    const snackbar = () => document.querySelector(".v-snackbar");
    const text = () => snackbar()?.textContent ?? "";
    const close = () =>
      Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Закрыть"),
      );
    let now = 2_000_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const dismiss = async (keyboard = false) => {
      const button = close();
      expect(button).toBeDefined();
      expect(button?.type).toBe("button");
      expect(gazeTargetSnapshot().map((entry) => entry.id)).toContain("update-status-close");
      now += 1000;
      if (keyboard) {
        button!.focus();
        expect(document.activeElement).toBe(button);
        // Native Enter/Space activation reaches the button as a zero-detail click.
        button!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
      } else {
        button!.click();
      }
      await nextTick();
      expect(gazeTargetSnapshot().map((entry) => entry.id)).not.toContain("update-status-close");
      expect(snackbar()?.classList.contains("v-snackbar--active")).toBe(false);
    };

    expect(text()).toContain("Можно продолжать играть");
    expect(text()).not.toContain("HttpError");
    expect(text()).not.toContain("private.example");
    expect(text()).not.toContain("secret");
    await dismiss(true);
    onInfo({ percent: 42 });
    await nextTick();
    expect(snackbar()?.classList.contains("v-snackbar--active")).toBe(false);

    // Even the same repeated error is a new notification, not a sticky dismissal.
    onError("HttpError: https://private.example/latest.yml token=secret");
    await nextTick();
    expect(snackbar()?.classList.contains("v-snackbar--active")).toBe(true);
    expect(text()).toContain("Можно продолжать играть");
    await dismiss();

    onAvailable({ version: "3.0.2" });
    await nextTick();
    expect(text()).toContain("Загружается обновление");
    expect(snackbar()?.classList.contains("v-snackbar--active")).toBe(true);
    onInfo({ percent: 42 });
    await nextTick();
    expect(text()).toContain("42%");

    await dismiss();
    onDownloaded({ version: "3.0.2" });
    await nextTick();
    expect(text()).toContain("Обновление готово");
    expect(snackbar()?.classList.contains("v-snackbar--active")).toBe(true);
    app.unmount();
    unmount = undefined;
    expect(dispose).toHaveBeenCalledTimes(4);
    expect(gazeTargetSnapshot().map((entry) => entry.id)).not.toContain("update-status-close");
  });
});
