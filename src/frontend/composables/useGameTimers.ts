import { onUnmounted, watch } from "vue";
import { activeGameSessionEpoch, activeGameSessionStatus } from "../core/session";

type GameTimer = {
  callback: () => void;
  remainingMs: number;
  startedAt: number;
  nativeId?: number;
  cancel?: () => void;
};

export function useGameTimers() {
  const timers = new Map<number, GameTimer>();
  let nextTimerId = 1;

  function schedule(timerId: number) {
    const timer = timers.get(timerId);
    if (!timer || activeGameSessionStatus.value !== "running") return;
    timer.startedAt = performance.now();
    timer.nativeId = window.setTimeout(() => {
      timers.delete(timerId);
      timer.callback();
    }, timer.remainingMs);
  }

  function setGameTimeout(callback: () => void, delayMs: number) {
    const timerId = nextTimerId++;
    timers.set(timerId, { callback, remainingMs: Math.max(0, delayMs), startedAt: performance.now() });
    schedule(timerId);
    return timerId;
  }

  function waitForGameTimeout(delayMs: number) {
    return new Promise<boolean>((resolve) => {
      const timerId = setGameTimeout(() => resolve(true), delayMs);
      const timer = timers.get(timerId);
      if (timer) timer.cancel = () => resolve(false);
    });
  }

  function clearGameTimers() {
    for (const timer of timers.values()) {
      if (timer.nativeId !== undefined) window.clearTimeout(timer.nativeId);
      timer.cancel?.();
    }
    timers.clear();
  }

  function clearGameTimeout(timerId: number) {
    const timer = timers.get(timerId);
    if (!timer) return;
    if (timer.nativeId !== undefined) window.clearTimeout(timer.nativeId);
    timer.cancel?.();
    timers.delete(timerId);
  }

  const stopStatusWatch = watch(activeGameSessionStatus, (status, previousStatus) => {
    if (status === "paused") {
      const now = performance.now();
      for (const timer of timers.values()) {
        if (timer.nativeId === undefined) continue;
        window.clearTimeout(timer.nativeId);
        timer.nativeId = undefined;
        timer.remainingMs = Math.max(0, timer.remainingMs - (now - timer.startedAt));
      }
      return;
    }
    if (status === "running" && previousStatus === "paused") {
      for (const timerId of timers.keys()) schedule(timerId);
      return;
    }
    if (status === "finished" || status === "idle") clearGameTimers();
  }, { flush: "sync" });

  const stopEpochWatch = watch(activeGameSessionEpoch, () => clearGameTimers(), { flush: "sync" });

  onUnmounted(() => {
    stopStatusWatch();
    stopEpochWatch();
    clearGameTimers();
  });

  return { setGameTimeout, waitForGameTimeout, clearGameTimeout, clearGameTimers };
}
