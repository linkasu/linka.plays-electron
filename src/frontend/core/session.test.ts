import { createApp, defineComponent, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameSession } from "./session";
import type { SessionSettings } from "./settings";

function mountSession(overrides: Partial<SessionSettings> = {}, options: Parameters<typeof useGameSession>[2] = {}) {
  let api: ReturnType<typeof useGameSession> | undefined;
  const root = document.createElement("div");
  document.body.append(root);

  const app = createApp(defineComponent({
    setup() {
      api = useGameSession("unit-game", overrides, options);
      return () => null;
    }
  }));

  app.mount(root);
  if (!api) throw new Error("Session composable was not initialized.");

  return {
    api,
    unmount: () => {
      app.unmount();
      root.remove();
    }
  };
}

describe("useGameSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    const mounted = mountSession({ maxSteps: 5, sessionSeconds: 30 });

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
});
