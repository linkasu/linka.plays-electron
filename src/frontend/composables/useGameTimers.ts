import { onUnmounted } from "vue";

export function useGameTimers() {
  const timers = new Set<number>();

  function setGameTimeout(callback: () => void, delayMs: number) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delayMs);
    timers.add(timer);
    return timer;
  }

  function clearGameTimers() {
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
  }

  onUnmounted(() => {
    clearGameTimers();
  });

  return { setGameTimeout, clearGameTimers };
}
