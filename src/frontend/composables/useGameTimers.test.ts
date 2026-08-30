import { createApp, defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameSession } from "../core/session";
import { useGameTimers } from "./useGameTimers";

function mountTimers(callback: () => void) {
  let api: ReturnType<typeof useGameSession> | undefined;
  let timers: ReturnType<typeof useGameTimers> | undefined;
  const root = document.createElement("div");
  document.body.append(root);
  const app = createApp(
    defineComponent({
      setup() {
        api = useGameSession("timer-test", { sessionSeconds: 30 });
        timers = useGameTimers();
        timers.setGameTimeout(callback, 1_000);
        return () => null;
      },
    }),
  );
  app.mount(root);
  if (!api) throw new Error("Session was not initialized.");
  if (!timers) throw new Error("Timers were not initialized.");
  return {
    api,
    timers,
    unmount: () => {
      app.unmount();
      root.remove();
    },
  };
}

describe("useGameTimers", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("freezes pending callbacks while the session is paused", () => {
    const callback = vi.fn();
    const mounted = mountTimers(callback);
    try {
      vi.advanceTimersByTime(400);
      mounted.api.pauseSession();
      vi.advanceTimersByTime(2_000);
      expect(callback).not.toHaveBeenCalled();

      mounted.api.resumeSession();
      vi.advanceTimersByTime(599);
      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledOnce();
    } finally {
      mounted.unmount();
    }
  });

  it("cancels callbacks from the previous session on restart", () => {
    const callback = vi.fn();
    const mounted = mountTimers(callback);
    try {
      mounted.api.startSession();
      vi.advanceTimersByTime(2_000);
      expect(callback).not.toHaveBeenCalled();
    } finally {
      mounted.unmount();
    }
  });

  it("clears one callback without cancelling the others", () => {
    const first = vi.fn();
    const second = vi.fn();
    const mounted = mountTimers(first);
    try {
      const timerId = mounted.timers.setGameTimeout(second, 1_000);
      mounted.timers.clearGameTimeout(timerId);
      vi.advanceTimersByTime(1_000);
      expect(first).toHaveBeenCalledOnce();
      expect(second).not.toHaveBeenCalled();
    } finally {
      mounted.unmount();
    }
  });

  it("resolves a game wait as cancelled when the session restarts", async () => {
    const mounted = mountTimers(vi.fn());
    try {
      const wait = mounted.timers.waitForGameTimeout(1_000);
      mounted.api.startSession();
      await expect(wait).resolves.toBe(false);
    } finally {
      mounted.unmount();
    }
  });
});
