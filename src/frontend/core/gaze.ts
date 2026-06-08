import { computed, ref, type Ref } from "vue";

export type DwellTarget = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled?: boolean;
  dwellMs?: number;
  priority?: number;
};

export type DwellCancelReason = "left" | "invalid-gaze" | "disabled";

export type DwellEventPayload = {
  targetId: string;
  at: number;
  dwellMs: number;
  elapsedMs: number;
  progress: number;
  pointer: GazePoint;
  reason?: DwellCancelReason;
};

export type GazeMetricsSnapshot = {
  totalGazeSamples: number;
  validGazeSamples: number;
  invalidGazeSamples: number;
  validGazeRatio: number;
  lostGazeEvents: number;
  restoredGazeEvents: number;
  rawPathLength: number;
  meanSampleIntervalMs?: number;
};

export function createGazeMetricsTracker() {
  let totalGazeSamples = 0;
  let validGazeSamples = 0;
  let invalidGazeSamples = 0;
  let lostGazeEvents = 0;
  let restoredGazeEvents = 0;
  let rawPathLength = 0;
  let sampleIntervalSum = 0;
  let sampleIntervalCount = 0;
  let previousPoint: GazePoint | undefined;
  let previousValidPoint: GazePoint | undefined;

  function reset() {
    totalGazeSamples = 0;
    validGazeSamples = 0;
    invalidGazeSamples = 0;
    lostGazeEvents = 0;
    restoredGazeEvents = 0;
    rawPathLength = 0;
    sampleIntervalSum = 0;
    sampleIntervalCount = 0;
    previousPoint = undefined;
    previousValidPoint = undefined;
  }

  function record(point: GazePoint): "lost" | "restored" | undefined {
    const timestamp = point.timestamp ?? Date.now();
    const normalizedPoint = { ...point, timestamp };
    let transition: "lost" | "restored" | undefined;

    totalGazeSamples += 1;
    if (point.valid) validGazeSamples += 1;
    else invalidGazeSamples += 1;

    if (previousPoint) {
      if (previousPoint.valid && !point.valid) {
        lostGazeEvents += 1;
        transition = "lost";
      }
      if (!previousPoint.valid && point.valid) {
        restoredGazeEvents += 1;
        transition = "restored";
      }

      const interval = timestamp - (previousPoint.timestamp ?? timestamp);
      if (Number.isFinite(interval) && interval > 0) {
        sampleIntervalSum += interval;
        sampleIntervalCount += 1;
      }
    }

    if (point.valid && previousValidPoint) {
      rawPathLength += Math.hypot(point.x - previousValidPoint.x, point.y - previousValidPoint.y);
    }

    if (point.valid) previousValidPoint = normalizedPoint;
    previousPoint = normalizedPoint;
    return transition;
  }

  function snapshot(): GazeMetricsSnapshot {
    return {
      totalGazeSamples,
      validGazeSamples,
      invalidGazeSamples,
      validGazeRatio: totalGazeSamples ? validGazeSamples / totalGazeSamples : 1,
      lostGazeEvents,
      restoredGazeEvents,
      rawPathLength,
      meanSampleIntervalMs: sampleIntervalCount ? sampleIntervalSum / sampleIntervalCount : undefined
    };
  }

  return { reset, record, snapshot };
}

export function containsPoint(target: DwellTarget, point: { x: number; y: number }) {
  return point.x >= target.x && point.x <= target.x + target.width && point.y >= target.y && point.y <= target.y + target.height;
}

export function useDwellSelection(options: {
  pointer: Ref<GazePoint>;
  targets: Ref<DwellTarget[]>;
  dwellMs: Ref<number>;
  cooldownMs?: number;
  onSelect: (targetId: string, dwellMs: number) => void;
  onCancel?: (targetId: string, reason: DwellCancelReason) => void;
}) {
  const activeTargetId = ref<string>();
  const enteredAt = ref(0);
  const cooldownUntil = ref(0);
  const progressByTarget = ref<Record<string, number>>({});

  const activeTarget = computed(() => options.targets.value.find((target) => target.id === activeTargetId.value));

  function resetProgress(targetId?: string) {
    if (!targetId) {
      progressByTarget.value = {};
      return;
    }
    progressByTarget.value = { ...progressByTarget.value, [targetId]: 0 };
  }

  function chooseTarget(now: number) {
    if (now < cooldownUntil.value || !options.pointer.value.valid) return undefined;
    const containing = options.targets.value
      .filter((target) => target.enabled !== false && containsPoint(target, options.pointer.value))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return containing[0];
  }

  function tick(now = performance.now()) {
    const nextTarget = chooseTarget(now);
    const previousTargetId = activeTargetId.value;

    if (!options.pointer.value.valid) {
      if (previousTargetId) options.onCancel?.(previousTargetId, "invalid-gaze");
      activeTargetId.value = undefined;
      enteredAt.value = 0;
      resetProgress(previousTargetId);
      return;
    }

    if (!nextTarget) {
      if (previousTargetId) options.onCancel?.(previousTargetId, "left");
      activeTargetId.value = undefined;
      enteredAt.value = 0;
      resetProgress(previousTargetId);
      return;
    }

    if (nextTarget.id !== previousTargetId) {
      if (previousTargetId) options.onCancel?.(previousTargetId, "left");
      activeTargetId.value = nextTarget.id;
      enteredAt.value = now;
      resetProgress(previousTargetId);
    }

    const duration = now - enteredAt.value;
    const dwellMs = nextTarget.dwellMs ?? options.dwellMs.value;
    const progress = Math.min(1, duration / dwellMs);
    progressByTarget.value = { ...progressByTarget.value, [nextTarget.id]: progress };

    if (progress >= 1) {
      options.onSelect(nextTarget.id, dwellMs);
      cooldownUntil.value = now + (options.cooldownMs ?? 500);
      activeTargetId.value = undefined;
      enteredAt.value = 0;
      resetProgress(nextTarget.id);
    }
  }

  return {
    activeTargetId,
    activeTarget,
    progressByTarget,
    tick,
    resetProgress
  };
}
