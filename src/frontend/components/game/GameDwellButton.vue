<script lang="ts">
let sharedCooldownUntil = 0;
</script>

<script setup lang="ts">
import { computed, getCurrentInstance, inject, onMounted, onUnmounted, ref } from "vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { DEFAULT_DWELL_MS } from "../../core/dwellSettings";
import type { DwellCancelReason, DwellEventPayload } from "../../core/gaze";
import { gameSessionTelemetryKey } from "../../core/session";

const props = withDefaults(defineProps<{
  targetId?: string;
  dwellMs?: number;
  disabled?: boolean;
  color?: string;
  minHeight?: number | string;
}>(), {
  dwellMs: DEFAULT_DWELL_MS,
  disabled: false,
  color: "surface",
  minHeight: 160
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
let enteredAt = 0;
let disposed = false;
let cooldownUntil = 0;

const hitPaddingPx = 36;

const progressStyle = computed(() => ({
  "--dwell-progress-scale": progress.value.toFixed(3)
}));
const minBlockSize = computed(() => typeof props.minHeight === "number" ? `${props.minHeight}px` : props.minHeight);

function currentTargetId() {
  return props.targetId ?? rootRef.value?.id ?? `dwell-button-${instance?.uid ?? "unknown"}`;
}

function makePayload(now: number, nextProgress: number, reason?: DwellCancelReason): DwellEventPayload {
  return {
    targetId: currentTargetId(),
    at: Date.now(),
    dwellMs: props.dwellMs,
    elapsedMs: enteredAt ? now - enteredAt : 0,
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

function containsPointer() {
  const element = rootRef.value;
  if (!element || !pointer.value.valid || props.disabled) return false;
  const rect = element.getBoundingClientRect();
  return pointer.value.x >= rect.left - hitPaddingPx
    && pointer.value.x <= rect.right + hitPaddingPx
    && pointer.value.y >= rect.top - hitPaddingPx
    && pointer.value.y <= rect.bottom + hitPaddingPx;
}

function cancelReason(): DwellCancelReason | undefined {
  if (props.disabled) return "disabled";
  if (!pointer.value.valid) return "invalid-gaze";
  return containsPointer() ? undefined : "left";
}

function reset(now = performance.now(), reason?: DwellCancelReason) {
  if (active.value && reason) record("target-cancel", makePayload(now, progress.value, reason));
  active.value = false;
  progress.value = 0;
  enteredAt = 0;
}

function tick(now: number) {
  if (disposed) return;

  if (now < cooldownUntil || now < sharedCooldownUntil) {
    frame = requestAnimationFrame(tick);
    return;
  }

  const reason = cancelReason();
  if (reason) {
    reset(now, active.value ? reason : undefined);
    frame = requestAnimationFrame(tick);
    return;
  }

  if (!active.value) {
    active.value = true;
    enteredAt = now;
    progress.value = 0;
    record("target-enter", makePayload(now, 0));
  }

  progress.value = Math.min(1, (now - enteredAt) / props.dwellMs);
  if (progress.value >= 1) {
    const payload = makePayload(now, 1);
    record("target-click", payload);
    emit("select", payload);
    cooldownUntil = now + 500;
    sharedCooldownUntil = now + 700;
    reset(now);
  }

  if (!disposed) frame = requestAnimationFrame(tick);
}

function selectByPointerClick() {
  if (props.disabled) return;
  const payload = makePayload(performance.now(), 1);
  record("target-click", payload);
  emit("select", payload);
}

onMounted(() => {
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  disposed = true;
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
