<script lang="ts">
let sharedCooldownUntil = 0;
let visibilityCheckTimer = 0;
</script>

<script setup lang="ts">
import { computed, getCurrentInstance, inject, onMounted, onUnmounted, ref } from "vue";
import { useGazePointer } from "../../composables/useGazePointer";
import type { DwellCancelReason, DwellEventPayload } from "../../core/gaze";
import { gameSessionTelemetryKey } from "../../core/session";

const props = withDefaults(defineProps<{
  targetId?: string;
  dwellMs?: number;
  disabled?: boolean;
  color?: string;
  minHeight?: number | string;
}>(), {
  dwellMs: 1000,
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

const hitPaddingPx = 18;

const progressStyle = computed(() => ({
  "--dwell-seconds": `${props.dwellMs / 1000}s`,
  "--dwell-size": typeof props.minHeight === "number" ? `${Math.max(64, Math.min(props.minHeight * 0.72, 150))}px` : "min(72%, 9.375rem)"
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

function hasVisibleDwellTarget() {
  return Array.from(document.querySelectorAll<HTMLElement>(".dwell-hitbox")).some((element) => {
    const rect = element.getBoundingClientRect();
    return rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight;
  });
}

function scheduleInitialVisibilityCheck() {
  window.clearTimeout(visibilityCheckTimer);
  const scheduledHref = window.location.href;
  visibilityCheckTimer = window.setTimeout(() => {
    if (window.location.href !== scheduledHref) return;
    const firstTarget = document.querySelector<HTMLElement>(".dwell-hitbox");
    if (!firstTarget || document.querySelector(".wasd-panel") || hasVisibleDwellTarget()) return;
    const hud = document.querySelector<HTMLElement>(".game-hud, [class*='hud']");
    const hudBottom = hud?.getBoundingClientRect().bottom ?? 0;
    const targetTop = firstTarget.getBoundingClientRect().top;
    window.scrollBy({ top: targetTop - hudBottom - 16, behavior: "auto" });
  }, 700);
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

onMounted(() => {
  scheduleInitialVisibilityCheck();
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
      :color="active ? 'primary' : color"
      :disabled="disabled"
      :style="{ minBlockSize }"
      class="pa-5 text-center d-flex flex-column justify-center"
      rounded="xl"
      variant="elevated"
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
  transform: scale(1.03);
}

@property --dwell-progress {
  syntax: '<integer>';
  initial-value: 0;
  inherits: false;
}

@keyframes dwell-progress {
  to {
    --dwell-progress: 100;
  }
}

.dwell-progress {
  animation: dwell-progress var(--dwell-seconds) linear forwards;
  background: radial-gradient(closest-side, transparent 76%, rgb(var(--v-theme-primary)) 77% 82%, transparent 83%),
    conic-gradient(rgb(var(--v-theme-secondary)) calc(var(--dwell-progress) * 1%), transparent 0);
  block-size: var(--dwell-size);
  border-radius: 999px;
  box-shadow: 0 0 0 8px rgb(var(--v-theme-secondary) / 14%);
  inline-size: var(--dwell-size);
  inset-block-start: 50%;
  inset-inline-start: 50%;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 2;
}
</style>
