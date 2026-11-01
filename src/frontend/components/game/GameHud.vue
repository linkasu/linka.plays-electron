<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useDwellSettings } from "../../core/dwellSettings";
import { fitGameBelowHud } from "../../core/fitBelowHud";
import { resolveMenuMode, resolveMenuRoute } from "../../core/menuMode";
import { gameSessionRunKey } from "../../core/session";
import GameDwellButton from "./GameDwellButton.vue";
import GazePointerOverlay from "./GazePointerOverlay.vue";
import TobiiStatusBadge from "../TobiiStatusBadge.vue";

const props = defineProps<{
  title: string;
  step: number;
  maxSteps: number;
  score?: number;
  mistakes?: number;
  durationMs?: number;
  sessionSeconds?: number;
  paused?: boolean;
  pauseDisabled?: boolean;
  showProgress?: boolean;
  showTimer?: boolean;
}>();

const emit = defineEmits<{
  pause: [];
  resume: [];
}>();

const router = useRouter();
const { dwellMs } = useDwellSettings();
const progress = computed(() =>
  props.maxSteps > 0 ? Math.min(100, (props.step / props.maxSteps) * 100) : 0,
);
const showProgress = computed(() => props.showProgress !== false);
const showTimer = computed(() => props.showTimer !== false);
const isSelfMode = computed(() => resolveMenuMode() === "self");
const runContext = inject(gameSessionRunKey, undefined);
const countsToGoal = computed(() => (runContext?.run.mode ?? "successes") === "successes");
const totalSuccesses = computed(() => props.step + (runContext?.run.successesBefore ?? 0));
const totalScore = computed(() =>
  props.score === undefined ? undefined : props.score + (runContext?.run.successesBefore ?? 0),
);
const totalMistakes = computed(() =>
  props.mistakes === undefined ? undefined : props.mistakes + (runContext?.run.mistakesBefore ?? 0),
);

// Testers: the game field sat under the «В меню» / «Пауза» buttons. The HUD tells
// the page how far down it reaches (styles/game-layout.css starts the game below).
const hudRef = ref<HTMLElement>();
let hudObserver: ResizeObserver | undefined;
let stopFitting: (() => void) | undefined;

function publishHudClearance() {
  const bottom = hudRef.value?.getBoundingClientRect().bottom;
  if (bottom === undefined) return;
  document.documentElement.style.setProperty("--game-hud-clearance", `${Math.ceil(bottom)}px`);
}

onMounted(() => {
  publishHudClearance();
  if (typeof ResizeObserver !== "undefined" && hudRef.value) {
    hudObserver = new ResizeObserver(publishHudClearance);
    hudObserver.observe(hudRef.value);
  }
  window.addEventListener("resize", publishHudClearance);
  stopFitting = fitGameBelowHud();
});

onUnmounted(() => {
  hudObserver?.disconnect();
  stopFitting?.();
  window.removeEventListener("resize", publishHudClearance);
  document.documentElement.style.removeProperty("--game-hud-clearance");
});
const remainingSeconds = computed(() => {
  if (props.durationMs === undefined) return undefined;
  // The chosen time limit is always on screen, whatever the game hides from its HUD.
  if (runContext?.run.mode === "timed") {
    const { timeLimitMs, activeMsBefore } = runContext.run;
    return Math.max(0, Math.ceil((timeLimitMs - activeMsBefore - props.durationMs) / 1000));
  }
  if (!showTimer.value || props.sessionSeconds === undefined) return undefined;
  if (runContext && !runContext.hasSessionTimer()) return undefined;
  return Math.max(0, Math.ceil(props.sessionSeconds - props.durationMs / 1000));
});

function goToMenu() {
  router.push(resolveMenuRoute());
}

function togglePause() {
  if (props.pauseDisabled) return;
  props.paused ? emit("resume") : emit("pause");
}
</script>

<template>
  <div ref="hudRef" class="game-hud d-flex flex-wrap align-center ga-2 pa-3" data-canvas-overlay>
    <template v-if="isSelfMode">
      <div class="self-gaze-edge d-flex ga-2" aria-label="Управление взглядом">
        <GameDwellButton
          class="self-gaze-action"
          target-id="hud-menu"
          :dwell-ms="dwellMs"
          min-height="clamp(5rem, 12dvh, 7.5rem)"
          color="secondary"
          @select="goToMenu"
        >
          <template #default>
            <div class="d-flex flex-column align-center justify-center ga-1 text-white">
              <v-icon icon="mdi-arrow-left" size="36" />
              <div class="text-h6 font-weight-bold">В меню</div>
              <div class="text-caption">удержи взгляд</div>
            </div>
          </template>
        </GameDwellButton>
        <GameDwellButton
          class="self-gaze-action"
          target-id="hud-pause"
          :disabled="pauseDisabled"
          :dwell-ms="dwellMs"
          min-height="clamp(5rem, 12dvh, 7.5rem)"
          color="surface"
          @select="togglePause"
        >
          <template #default>
            <div class="d-flex flex-column align-center justify-center ga-1 text-primary">
              <v-icon :icon="paused ? 'mdi-play' : 'mdi-pause'" size="36" />
              <div class="text-h6 font-weight-bold">{{ paused ? "Продолжить" : "Пауза" }}</div>
              <div class="text-caption">удержи взгляд</div>
            </div>
          </template>
        </GameDwellButton>
      </div>
    </template>
    <template v-else>
      <v-btn
        color="surface"
        density="comfortable"
        prepend-icon="mdi-arrow-left"
        variant="flat"
        @click="goToMenu"
      >
        В меню
      </v-btn>
      <v-btn
        color="surface"
        density="comfortable"
        :prepend-icon="paused ? 'mdi-play' : 'mdi-pause'"
        :disabled="pauseDisabled"
        variant="flat"
        @click="togglePause"
      >
        {{ paused ? "Продолжить" : "Пауза" }}
      </v-btn>
      <v-chip
        color="secondary"
        prepend-icon="mdi-hand-back-left-outline"
        size="small"
        variant="tonal"
      >
        Ручное управление специалиста
      </v-chip>
    </template>
    <v-card v-if="showProgress" class="px-3 py-1" color="surface" rounded="pill" variant="flat">
      <div class="text-caption text-medium-emphasis">{{ title }}</div>
      <template v-if="countsToGoal">
        <div class="text-body-2 font-weight-bold">Шаг {{ step }} / {{ maxSteps }}</div>
        <v-progress-linear
          class="mt-1"
          :model-value="progress"
          color="primary"
          height="6"
          rounded
        />
      </template>
      <div v-else class="text-body-2 font-weight-bold">Успехов: {{ totalSuccesses }}</div>
    </v-card>
    <v-chip v-if="totalScore !== undefined" color="primary" size="small" variant="flat"
      >Успех: {{ totalScore }}</v-chip
    >
    <v-chip v-if="totalMistakes !== undefined" color="warning" size="small" variant="tonal"
      >Ошибки: {{ totalMistakes }}</v-chip
    >
    <v-chip
      v-if="remainingSeconds !== undefined"
      color="info"
      prepend-icon="mdi-timer-outline"
      size="small"
      variant="tonal"
    >
      {{ remainingSeconds }} сек
    </v-chip>
    <TobiiStatusBadge />
  </div>
  <GazePointerOverlay />
</template>

<style scoped>
.game-hud {
  left: 0;
  pointer-events: auto;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 10;
}

.self-gaze-edge {
  max-inline-size: min(100%, 24rem);
  opacity: 0.72;
  transition: opacity 160ms ease;
}

.self-gaze-edge:focus-within,
.self-gaze-edge:hover {
  opacity: 1;
}

.self-gaze-action {
  flex: 1 1 10rem;
}

.self-gaze-action :deep(.dwell-button) {
  backdrop-filter: blur(0.55rem);
}

.self-gaze-action :deep(.dwell-button--active) {
  opacity: 1;
}
</style>
