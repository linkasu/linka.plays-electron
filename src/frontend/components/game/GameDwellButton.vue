<script lang="ts">
let sharedCooldownUntil = 0;
</script>

<script setup lang="ts">
import { computed, getCurrentInstance, inject, onMounted, onUnmounted, ref } from "vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { activeDomGazeTargetId, registerDomGazeTarget } from "../../core/domGazeTargetCoordinator";
import { advanceDwellMachine, createDwellMachineState } from "../../core/dwellStateMachine";
import { DEFAULT_DWELL_MS } from "../../core/dwellSettings";
import type { DwellCancelReason, DwellEventPayload } from "../../core/gaze";
import { gameSessionTelemetryKey } from "../../core/session";

const props = withDefaults(defineProps<{
  targetId?: string;
  dwellMs?: number;
  disabled?: boolean;
  color?: string;
  minHeight?: number | string;
  hitPadding?: number;
  priority?: number;
  graceMs?: number;
}>(), {
  dwellMs: DEFAULT_DWELL_MS,
  disabled: false,
  color: "surface",
  minHeight: 160,
  hitPadding: 36,
  priority: 0,
  graceMs: 140
});

const emit = defineEmits<{
  select: [payload: DwellEventPayload];
  "target-enter": [payload: DwellEventPayload];
  "target-cancel": [payload: DwellEventPayload];
  "target-click": [payload: DwellEventPayload];
}>();

const rootRef = ref<HTMLElement>();
const progress = ref(0);
const active = ref(false);
const { pointer } = useGazePointer();
const telemetry = inject(gameSessionTelemetryKey, undefined);
const instance = getCurrentInstance();
let frame = 0;
let disposed = false;
let unregisterTarget: (() => void) | undefined;
let machineState = createDwellMachineState();

const progressStyle = computed(() => ({
  "--dwell-progress-scale": progress.value.toFixed(3)
}));
const minBlockSize = computed(() => typeof props.minHeight === "number" ? `${props.minHeight}px` : props.minHeight);

function currentTargetId() {
  return props.targetId ?? rootRef.value?.id ?? `dwell-button-${instance?.uid ?? "unknown"}`;
}

function makePayload(now: number, nextProgress: number, reason?: DwellCancelReason, elapsedMs = machineState.accumulatedMs): DwellEventPayload {
  return {
    targetId: currentTargetId(),
    at: Date.now(),
    dwellMs: props.dwellMs,
    elapsedMs,
    progress: nextProgress,
    pointer: {
      x: pointer.value.x,
      y: pointer.value.y,
      valid: pointer.value.valid,
      source: pointer.value.source,
      timestamp: pointer.value.timestamp
    },
    reason
  };
}

function record(type: "target-enter" | "target-cancel" | "target-click", payload: DwellEventPayload) {
  if (type === "target-enter") emit("target-enter", payload);
  if (type === "target-cancel") emit("target-cancel", payload);
  if (type === "target-click") emit("target-click", payload);
  telemetry?.recordEvent(type, payload as unknown as Record<string, unknown>);
}

function tick(now: number) {
  if (disposed) return;
  if (now < sharedCooldownUntil) {
    frame = requestAnimationFrame(tick);
    return;
  }

  const targetId = currentTargetId();
  const coordinatedTargetId = activeDomGazeTargetId.value;
  const previousState = machineState;
  const previousProgress = progress.value;
  const result = advanceDwellMachine(machineState, {
    now,
    targetId: coordinatedTargetId === targetId ? targetId : undefined,
    pointerValid: pointer.value.valid,
    disabled: props.disabled,
    anotherTargetActive: Boolean(coordinatedTargetId && coordinatedTargetId !== targetId),
    dwellMs: props.dwellMs,
    graceMs: props.graceMs,
    cooldownMs: 500
  });
  machineState = result.state;
  progress.value = result.progress;

  for (const event of result.events) {
    if (event.type === "enter") {
      active.value = true;
      record("target-enter", makePayload(now, 0, undefined, 0));
    }
    if (event.type === "cancel") {
      record("target-cancel", makePayload(now, previousProgress, event.reason, previousState.accumulatedMs));
      active.value = false;
      progress.value = 0;
    }
    if (event.type === "select") {
      const payload = makePayload(now, 1, undefined, previousState.accumulatedMs + Math.max(0, now - previousState.lastAt));
      record("target-click", payload);
      emit("select", payload);
      active.value = false;
      progress.value = 0;
      sharedCooldownUntil = now + 700;
    }
  }

  if (!disposed) frame = requestAnimationFrame(tick);
}

function selectByPointerClick() {
  if (props.disabled) return;
  const now = performance.now();
  const payload = makePayload(now, 1, undefined, 0);
  record("target-click", payload);
  emit("select", payload);
  machineState = {
    ...createDwellMachineState(),
    phase: "cooldown",
    cooldownUntil: now + 500
  };
  sharedCooldownUntil = now + 700;
}

onMounted(() => {
  unregisterTarget = registerDomGazeTarget({
    id: currentTargetId(),
    element: () => rootRef.value,
    enabled: () => !props.disabled,
    hitPadding: () => props.hitPadding,
    priority: () => props.priority
  }, pointer);
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  disposed = true;
  unregisterTarget?.();
  cancelAnimationFrame(frame);
});
</script>

<template>
  <div ref="rootRef" class="dwell-hitbox">
    <v-card
      :class="['dwell-button', { 'dwell-button--active': active }]"
      :color="color"
      :disabled="disabled"
      :style="{ minBlockSize }"
      class="pa-5 text-center d-flex flex-column justify-center"
      rounded="xl"
      variant="elevated"
      @click="selectByPointerClick"
    >
      <slot :active="active" :progress="progress" />
      <div v-if="active" class="dwell-progress" :style="progressStyle" aria-hidden="true" />
    </v-card>
  </div>
</template>

<style scoped>
.dwell-hitbox {
  display: block;
}

.dwell-button {
  block-size: 100%;
  inline-size: 100%;
  overflow: hidden;
  position: relative;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.dwell-button--active {
  box-shadow: 0 0 0 0.22rem rgb(var(--v-theme-secondary) / 32%), 0 0.7rem 1.6rem rgb(var(--v-theme-primary) / 16%);
  transform: scale(1.03);
}

.dwell-progress {
  background: rgb(var(--v-theme-surface-variant) / 42%);
  block-size: clamp(0.45rem, 1.1dvh, 0.7rem);
  border-radius: 999rem;
  box-shadow: 0 0 0 0.16rem rgb(var(--v-theme-secondary) / 18%);
  inline-size: calc(100% - clamp(2rem, 4dvh, 3rem));
  inset-block-end: clamp(0.7rem, 1.4dvh, 0.95rem);
  inset-inline-start: clamp(1rem, 2dvh, 1.5rem);
  overflow: hidden;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

.dwell-progress::after {
  background: linear-gradient(90deg, rgb(var(--v-theme-secondary)), rgb(var(--v-theme-primary)));
  block-size: 100%;
  border-radius: inherit;
  content: "";
  inline-size: 100%;
  inset: 0;
  position: absolute;
  transform: scaleX(var(--dwell-progress-scale));
  transform-origin: left center;
}
</style>
