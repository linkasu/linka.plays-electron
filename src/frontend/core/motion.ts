// Smooth motion for drawn characters: easing curves and frame-rate independent
// smoothing, so parts move with ease-in/ease-out instead of jumping.

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Progress of `value` between `start` and `end`, clamped to 0..1. */
export function progressBetween(value: number, start: number, end: number) {
  return end === start ? (value >= end ? 1 : 0) : clamp01((value - start) / (end - start));
}

export function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

/** Overshoots a little and settles back, like a petal popping open. */
export function easeOutBack(t: number, overshoot = 1.5) {
  const x = clamp01(t) - 1;
  return 1 + (overshoot + 1) * x * x * x + overshoot * x * x;
}

/**
 * Moves `current` towards `target` with the same feel at any frame rate.
 * `rate` is how many times per second the remaining gap shrinks by e.
 */
export function approach(current: number, target: number, rate: number, deltaSeconds: number) {
  return target + (current - target) * Math.exp(-rate * Math.max(0, deltaSeconds));
}

/** Seconds since the previous call for the same key; for draw functions without a delta. */
export function createFrameClock() {
  const last = new Map<string, number>();
  return (key: string, nowMs: number) => {
    const previous = last.get(key);
    last.set(key, nowMs);
    return previous === undefined ? 0 : Math.min(0.1, Math.max(0, (nowMs - previous) / 1000));
  };
}
