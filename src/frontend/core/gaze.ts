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
