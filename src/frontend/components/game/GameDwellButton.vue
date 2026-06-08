<script lang="ts">
let sharedCooldownUntil = 0;
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useGazePointer } from "../../composables/useGazePointer";

const props = withDefaults(defineProps<{
  dwellMs?: number;
  disabled?: boolean;
  color?: string;
  minHeight?: number;
}>(), {
  dwellMs: 1000,
  disabled: false,
  color: "surface",
  minHeight: 160
});

const emit = defineEmits<{ select: [] }>();

const rootRef = ref<HTMLElement>();
const progress = ref(0);
const active = ref(false);
const { pointer } = useGazePointer();
let frame = 0;
let enteredAt = 0;
let lastInsideAt = 0;
let disposed = false;
let cooldownUntil = 0;

const hitPaddingPx = 18;
const leaveGraceMs = 160;

const progressValue = computed(() => progress.value * 100);

function containsPointer() {
  const element = rootRef.value;
  if (!element || !pointer.value.valid || props.disabled) return false;
  const rect = element.getBoundingClientRect();
  return pointer.value.x >= rect.left - hitPaddingPx
    && pointer.value.x <= rect.right + hitPaddingPx
    && pointer.value.y >= rect.top - hitPaddingPx
    && pointer.value.y <= rect.bottom + hitPaddingPx;
}

function reset() {
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

  if (!containsPointer()) {
    if (!active.value || now - lastInsideAt > leaveGraceMs) reset();
    frame = requestAnimationFrame(tick);
    return;
  }

  lastInsideAt = now;

  if (!active.value) {
    active.value = true;
    enteredAt = now;
  }

  progress.value = Math.min(1, (now - enteredAt) / props.dwellMs);
  if (progress.value >= 1) {
    emit("select");
    cooldownUntil = now + 500;
    sharedCooldownUntil = now + 700;
    reset();
  }

  if (!disposed) frame = requestAnimationFrame(tick);
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
      :color="active ? 'primary' : color"
      :disabled="disabled"
      :style="{ minBlockSize: `${minHeight}px` }"
      class="pa-5 text-center d-flex flex-column justify-center"
      rounded="xl"
      variant="elevated"
    >
      <slot :active="active" :progress="progress" />
      <v-progress-linear class="mt-4" :model-value="progressValue" color="secondary" height="8" rounded />
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
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.dwell-button--active {
  transform: scale(1.03);
}
</style>
