<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type DoorReveal = {
  icon: string;
  label: string;
  glow: string;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("open-door", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1350,
  sessionSeconds: 85,
  targetScale: 1.7,
  motionSpeed: 0.32,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const reveals: DoorReveal[] = [
  { icon: "mdi-lightbulb-on", label: "тёплый свет", glow: "#ffe5a3" },
  { icon: "mdi-heart", label: "мягкое сердце", glow: "#ffc2d6" },
  { icon: "mdi-flower", label: "тихий цветок", glow: "#c9f4c7" },
  { icon: "mdi-star", label: "спокойная звезда", glow: "#f9e7ff" },
  { icon: "mdi-weather-sunny", label: "лучик солнца", glow: "#ffdf8a" },
  { icon: "mdi-cloud", label: "пушистое облако", glow: "#d7ecff" },
  { icon: "mdi-music-note", label: "тихая нота", glow: "#d8d1ff" },
  { icon: "mdi-creation", label: "мягкая искра", glow: "#ffe7bd" }
];

const doorOpen = ref(false);
const currentReveal = ref(reveals[0]);
const resultVisible = computed(() => session.status === "finished");
let closeTimer: number | undefined;

function clearCloseTimer() {
  if (closeTimer === undefined) return;
  window.clearTimeout(closeTimer);
  closeTimer = undefined;
}

function closeDoorForNextStep() {
  if (session.status !== "running") return;
  doorOpen.value = false;
  closeTimer = undefined;
}

function openDoor() {
  if (session.status !== "running" || doorOpen.value) return;

  clearCloseTimer();
  currentReveal.value = reveals[session.step % reveals.length];
  doorOpen.value = true;
  recordSuccess({ targetId: `open-door:door:${session.step + 1}`, label: currentReveal.value.label });

  if (session.status === "running" && session.step < session.maxSteps) {
    closeTimer = window.setTimeout(closeDoorForNextStep, 1250);
  }
}

function restart() {
  clearCloseTimer();
  doorOpen.value = false;
  currentReveal.value = reveals[0];
  startSession();
}

onUnmounted(clearCloseTimer);
</script>

<template>
  <div class="open-door-shell">
    <div class="open-door-ambient" aria-hidden="true">
      <span class="open-door-orb open-door-orb--one" />
      <span class="open-door-orb open-door-orb--two" />
      <span class="open-door-orb open-door-orb--three" />
    </div>

    <GameHud
      title="Открой дверцу"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <v-container class="open-door-container d-flex align-center justify-center" fluid>
      <v-card class="open-door-scene pa-4 pa-sm-6 pa-md-8" color="transparent" elevation="0">
        <div class="text-center mb-5 mb-md-7 open-door-copy">
          <div class="text-overline text-amber-lighten-3">первая цель для спокойной фиксации</div>
          <h1 class="text-h4 text-sm-h3 font-weight-bold">Посмотри на дверцу, чтобы открыть</h1>
          <p class="text-body-1 text-sm-h6 text-blue-grey-lighten-5 mb-0">За дверцей каждый раз появляется мягкий свет. Ошибок здесь нет.</p>
        </div>

        <GameDwellButton
          :target-id="`open-door:door:${session.step + 1}`"
          :dwell-ms="session.settings.dwellMs"
          :disabled="session.status !== 'running' || doorOpen"
          :min-height="320"
          color="brown-lighten-4"
          class="open-door-target mx-auto"
          @select="openDoor"
        >
          <template #default="{ active, progress }">
            <div class="open-door-stage" :style="{ '--open-door-glow': currentReveal.glow }">
              <div :class="['open-door-light', { 'open-door-light--visible': doorOpen }]" />

              <div v-if="doorOpen" class="open-door-reveal">
                <v-icon :icon="currentReveal.icon" class="open-door-reveal-icon" />
                <div class="text-h6 text-sm-h5 font-weight-bold mt-2">{{ currentReveal.label }}</div>
              </div>

              <div :class="['open-door-panel', { 'open-door-panel--open': doorOpen, 'open-door-panel--active': active }]">
                <div class="open-door-panel-top" aria-hidden="true" />
                <v-icon icon="mdi-door" class="open-door-icon" />
                <div class="open-door-handle" aria-hidden="true" />
              </div>

              <div class="open-door-label text-body-1 text-sm-h6 font-weight-bold">
                {{ doorOpen ? "Открыто" : active && progress > 0.72 ? "Почти открыто" : "Смотри на дверцу" }}
              </div>
            </div>
          </template>
        </GameDwellButton>

        <v-card class="open-door-progress mt-5 mx-auto px-4 py-3" color="surface" rounded="xl" variant="tonal">
          <div class="text-body-2 font-weight-medium">Открыто дверок: {{ session.step }} из {{ session.maxSteps }}</div>
          <div class="text-caption text-medium-emphasis">Дверца закрывается сама и ждёт следующий спокойный взгляд.</div>
        </v-card>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Открой дверцу"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.open-door-shell {
  background: linear-gradient(180deg, #182136 0%, #243654 48%, #40536a 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.open-door-container {
  min-block-size: 100vh;
  padding-block-start: 112px;
}

.open-door-ambient {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.open-door-orb {
  background: rgb(255 232 177 / 24%);
  border-radius: 999px;
  filter: blur(2px);
  position: absolute;
}

.open-door-orb--one {
  block-size: 9rem;
  inline-size: 9rem;
  inset-block-start: 16%;
  inset-inline-start: 9%;
}

.open-door-orb--two {
  block-size: 13rem;
  inline-size: 13rem;
  inset-block-end: 10%;
  inset-inline-end: 7%;
}

.open-door-orb--three {
  block-size: 6rem;
  inline-size: 6rem;
  inset-block-start: 24%;
  inset-inline-end: 22%;
}

.open-door-scene {
  inline-size: min(780px, 100%);
  position: relative;
  z-index: 1;
}

.open-door-copy {
  color: #fff9ea;
  text-shadow: 0 2px 18px rgb(16 22 34 / 42%);
}

.open-door-target {
  inline-size: min(430px, 100%);
}

.open-door-stage {
  align-items: center;
  color: #5c321e;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 320px;
  overflow: hidden;
  position: relative;
}

.open-door-light {
  background: radial-gradient(circle, var(--open-door-glow) 0%, rgb(255 245 214 / 48%) 38%, transparent 72%);
  block-size: 118%;
  border-radius: 999px;
  inline-size: 118%;
  opacity: 0;
  position: absolute;
  transform: scale(0.72);
  transition: opacity 300ms ease, transform 460ms ease;
}

.open-door-light--visible {
  opacity: 0.94;
  transform: scale(1);
}

.open-door-reveal {
  align-items: center;
  color: #4d321e;
  display: flex;
  flex-direction: column;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  position: absolute;
  text-align: center;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.open-door-reveal-icon {
  filter: drop-shadow(0 0 22px rgb(255 235 184 / 86%));
  font-size: clamp(4.2rem, 15vw, 7rem);
}

.open-door-panel {
  background: linear-gradient(135deg, #9d6948 0%, #7b4a31 54%, #5c321f 100%);
  border: 10px solid rgb(72 39 24 / 42%);
  border-radius: 42px 42px 18px 18px;
  box-shadow: inset 0 0 0 3px rgb(255 231 188 / 18%), 0 22px 46px rgb(40 28 22 / 28%);
  block-size: clamp(210px, 42vw, 278px);
  inline-size: clamp(170px, 42vw, 232px);
  position: relative;
  transform-origin: left center;
  transition: transform 520ms ease, filter 240ms ease;
  z-index: 2;
}

.open-door-panel--active {
  filter: brightness(1.08);
}

.open-door-panel--open {
  transform: perspective(760px) rotateY(-64deg) translateX(-16px);
}

.open-door-panel-top {
  border: 4px solid rgb(255 231 188 / 24%);
  border-radius: 32px 32px 14px 14px;
  inset: 18px 22px 68px;
  position: absolute;
}

.open-door-icon {
  color: rgb(255 229 179 / 72%);
  font-size: clamp(4rem, 12vw, 6rem);
  inset-block-start: 50%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translate(-50%, -54%);
}

.open-door-handle {
  background: #f5d085;
  block-size: 1.25rem;
  border-radius: 999px;
  box-shadow: 0 0 18px rgb(255 210 126 / 58%);
  inline-size: 1.25rem;
  inset-block-start: 52%;
  inset-inline-end: 24px;
  position: absolute;
}

.open-door-label {
  color: #fff4da;
  inset-block-end: 8px;
  position: absolute;
  text-shadow: 0 2px 14px rgb(55 34 20 / 48%);
  z-index: 3;
}

.open-door-progress {
  max-inline-size: 440px;
}

@media (max-width: 640px) {
  .open-door-container {
    align-items: flex-start !important;
    padding-block-start: 96px;
  }

  .open-door-stage {
    min-block-size: 280px;
  }
}
</style>
