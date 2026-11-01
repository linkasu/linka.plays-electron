import { createApp, defineComponent, h, inject, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setGameEndMode, setGameTimeLimitMinutes } from "./gameEndMode";
import { gameSessionRunKey, useGameSession, type GameSessionRunContext } from "./session";
import type { SessionSettings } from "./settings";

function mountSession(
  overrides: Partial<SessionSettings> = {},
  options: Parameters<typeof useGameSession>[2] = {},
  gameId = "unit-game",
) {
  let api: ReturnType<typeof useGameSession> | undefined;
  let runContext: GameSessionRunContext | undefined;
  const RunProbe = defineComponent({
    setup() {
      runContext = inject(gameSessionRunKey);
      return () => null;
    },
  });
  const root = document.createElement("div");
  document.body.append(root);

  const app = createApp(
    defineComponent({
      setup() {
        api = useGameSession(gameId, overrides, options);
        return () => h(RunProbe);
      },
    }),
  );

  app.mount(root);
  if (!api || !runContext) throw new Error("Session composable was not initialized.");

  return {
    api,
    runContext,
    unmount: () => {
      app.unmount();
      root.remove();
    },
  };
}

describe("useGameSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  afterEach(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    setGameEndMode("successes");
    vi.useRealTimers();
  });

  it("waits for explicit start on a mode selection screen", async () => {
    const mounted = mountSession({ sessionSeconds: 2 }, { autoStart: false });
    try {
      mounted.api.recordEvent("target-click", { targetId: "mode:face" });
      mounted.api.pauseSession();
      mounted.api.resumeSession();
      vi.advanceTimersByTime(10_000);
      await nextTick();
      expect(mounted.api.session.status).toBe("idle");
      expect(mounted.api.durationMs.value).toBe(0);
      expect(mounted.api.session.events).toEqual([]);

      mounted.api.startSession();
      expect(mounted.api.session.status).toBe("running");
      expect(mounted.api.session.events.map((event) => event.type)).toEqual(["session-start"]);
      vi.advanceTimersByTime(1_000);
      await nextTick();
      expect(mounted.api.durationMs.value).toBe(1_000);
    } finally {
      mounted.unmount();
    }
  });

  it("auto-pauses while hidden without resuming a manual pause", () => {
    const mounted = mountSession({ sessionSeconds: 30 });
    try {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
      expect(mounted.api.session.status).toBe("paused");

      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
      expect(mounted.api.session.status).toBe("running");

      mounted.api.pauseSession();
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
      expect(mounted.api.session.status).toBe("paused");
    } finally {
      mounted.unmount();
    }
  });

  it("finishes after maxSteps successes", () => {
    const mounted = mountSession({ maxSteps: 2, sessionSeconds: 30 });

    try {
      mounted.api.recordSuccess();
      expect(mounted.api.session.status).toBe("running");

      mounted.api.recordSuccess();

      expect(mounted.api.session.status).toBe("finished");
      expect(mounted.api.session.finishReason).toBe("max-steps");
      expect(mounted.api.metrics.value.successes).toBe(2);
    } finally {
      mounted.unmount();
    }
  });

  it("does not count paused time toward active duration", async () => {
    const mounted = mountSession({ maxSteps: 5, sessionSeconds: 30 }, {}, "magic-dust");

    try {
      vi.advanceTimersByTime(5_000);
      await nextTick();
      mounted.api.pauseSession();

      vi.advanceTimersByTime(20_000);
      await nextTick();

      expect(mounted.api.session.status).toBe("paused");
      expect(mounted.api.durationMs.value).toBe(5_000);

      mounted.api.resumeSession();
      vi.advanceTimersByTime(25_000);
      await nextTick();

      expect(mounted.api.session.status).toBe("finished");
      expect(mounted.api.session.finishReason).toBe("timeout");
      expect(mounted.api.durationMs.value).toBe(30_000);
    } finally {
      mounted.unmount();
    }
  });

  it("creates a new session id on restart", () => {
    const mounted = mountSession({ maxSteps: 1 });

    try {
      const firstSessionId = mounted.api.session.sessionId;
      vi.advanceTimersByTime(1);
      mounted.api.startSession();

      expect(mounted.api.session.sessionId).not.toBe(firstSessionId);
      expect(mounted.api.session.status).toBe("running");
    } finally {
      mounted.unmount();
    }
  });

  it("can keep running after many mistakes", () => {
    const mounted = mountSession({ maxSteps: 2, sessionSeconds: 30 }, { finishOnMistakes: false });

    try {
      for (let index = 0; index < 10; index += 1) mounted.api.recordMistake();

      expect(mounted.api.session.status).toBe("running");
      expect(mounted.api.metrics.value.mistakes).toBe(10);
    } finally {
      mounted.unmount();
    }
  });

  it("does not stop a success-goal game on time", async () => {
    const mounted = mountSession({ maxSteps: 8, sessionSeconds: 1 });

    try {
      vi.advanceTimersByTime(5_000);
      await nextTick();

      expect(mounted.api.session.status).toBe("running");
    } finally {
      mounted.unmount();
    }
  });

  it("carries the totals over when an endless session restarts", () => {
    setGameEndMode("endless");
    const mounted = mountSession({ maxSteps: 2, sessionSeconds: 30 });

    try {
      vi.advanceTimersByTime(2_000);
      mounted.api.recordSuccess();
      mounted.api.recordSuccess();
      expect(mounted.api.session.finishReason).toBe("max-steps");
      expect(mounted.runContext.willContinue()).toBe(true);

      mounted.runContext.continueRun();
      mounted.api.startSession();

      expect(mounted.api.session.status).toBe("running");
      expect(mounted.api.session.step).toBe(0);
      expect(mounted.runContext.run.successesBefore).toBe(2);
      expect(mounted.runContext.run.activeMsBefore).toBe(2_000);
    } finally {
      mounted.unmount();
    }
  });

  it("resets the totals on a restart the user asked for", () => {
    setGameEndMode("endless");
    const mounted = mountSession({ maxSteps: 1, sessionSeconds: 30 });

    try {
      mounted.api.recordSuccess();
      mounted.api.startSession();

      expect(mounted.runContext.run.successesBefore).toBe(0);
    } finally {
      mounted.unmount();
    }
  });

  it("shows the result when a session ends too fast to continue", () => {
    setGameEndMode("endless");
    const mounted = mountSession({ maxSteps: 1, sessionSeconds: 30 });

    try {
      mounted.api.recordSuccess();

      expect(mounted.runContext.willContinue()).toBe(false);
    } finally {
      mounted.unmount();
    }
  });

  it("does not stop an endless game on mistakes or time", async () => {
    setGameEndMode("endless");
    const mounted = mountSession({ maxSteps: 2, sessionSeconds: 1 }, {}, "magic-dust");

    try {
      for (let index = 0; index < 20; index += 1) mounted.api.recordMistake();
      vi.advanceTimersByTime(600_000);
      await nextTick();

      expect(mounted.api.session.status).toBe("running");
    } finally {
      mounted.unmount();
    }
  });

  it("ends a timed run at the chosen limit across restarts", async () => {
    setGameTimeLimitMinutes(1);
    setGameEndMode("timed");
    const mounted = mountSession({ maxSteps: 1, sessionSeconds: 30 }, { finishOnTimeout: false });

    try {
      vi.advanceTimersByTime(40_000);
      await nextTick();
      mounted.api.recordSuccess();
      expect(mounted.runContext.willContinue()).toBe(true);

      mounted.runContext.continueRun();
      mounted.api.startSession();
      vi.advanceTimersByTime(19_000);
      await nextTick();
      expect(mounted.api.session.status).toBe("running");

      vi.advanceTimersByTime(1_000);
      await nextTick();
      expect(mounted.api.session.finishReason).toBe("timeout");
      expect(mounted.runContext.willContinue()).toBe(false);
    } finally {
      mounted.unmount();
    }
  });

  it("can keep running after session time elapses", async () => {
    const mounted = mountSession({ maxSteps: 8, sessionSeconds: 1 }, { finishOnTimeout: false });

    try {
      vi.advanceTimersByTime(2_000);
      await nextTick();

      expect(mounted.api.session.status).toBe("running");
      expect(mounted.api.session.finishReason).toBeUndefined();
    } finally {
      mounted.unmount();
    }
  });
});
