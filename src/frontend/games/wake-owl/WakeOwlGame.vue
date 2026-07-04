<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { CSSProperties } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeWakeOwlAudio, playWakeOwlHoot, warmWakeOwlAudio } from "./audio";

type OwlPosition = {
  x: number;
  y: number;
};

const owlPositions: OwlPosition[] = [
  { x: 50, y: 62 },
  { x: 27, y: 58 },
  { x: 73, y: 58 },
  { x: 36, y: 42 },
  { x: 64, y: 42 }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSessionFor("wake-owl", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.75, motionSpeed: 0.32, distractors: "none", hints: "high", sound: true },
  finishOnMistakes: false
});

const blinking = ref(false);
const owlPositionIndex = ref(0);
const resultVisible = computed(() => session.status === "finished");
const awakeRatio = computed(() => Math.min(1, session.step / session.maxSteps));
const owlTargetStyle = computed(() => {
  const position = owlPositions[owlPositionIndex.value] ?? owlPositions[0];
  return {
    "--owl-x": `${position.x}%`,
    "--owl-y": `${position.y}%`
  } as CSSProperties;
});
const owlStateText = computed(() => {
  if (session.status === "paused") return "Сова ждёт паузу.";
  if (session.step >= session.maxSteps) return "Сова проснулась и смотрит вокруг.";
  if (session.step >= 5) return "Глаза почти открыты. Ещё немного взгляда.";
  if (session.step >= 2) return "Сова уже моргает и просыпается.";
  return "Смотри на большую сову, чтобы она открыла глаза.";
});

let blinkTimer: number | undefined;
let moveTimer: number | undefined;

function eyeOpenValue(active: boolean, progress: number) {
  const activeBoost = active ? progress * 0.72 : 0;
  return Math.max(0.08, Math.min(1, awakeRatio.value + activeBoost));
}

function owlStyle(active: boolean, progress: number) {
  const open = eyeOpenValue(active, progress);
  return {
    "--eye-height": `${24 + open * 74}px`,
    "--eye-glow": `${12 + open * 24}px`,
    "--pupil-size": `${14 + open * 26}px`,
    "--pupil-opacity": String(0.35 + open * 0.65)
  } as CSSProperties;
}

function wakeOwl() {
  if (session.status !== "running") return;
  recordSuccess({ targetId: "wake-owl:owl", label: "большая сова" });
  void playWakeOwlHoot(session.settings.sound);
  blinking.value = true;
  window.clearTimeout(blinkTimer);
  blinkTimer = window.setTimeout(() => {
    blinking.value = false;
  }, 520);
  window.clearTimeout(moveTimer);
  if (session.step < session.maxSteps) {
    moveTimer = window.setTimeout(() => {
      owlPositionIndex.value = (owlPositionIndex.value + 1 + session.step % 2) % owlPositions.length;
    }, 720);
  }
}

function restart() {
  blinking.value = false;
  owlPositionIndex.value = 0;
  window.clearTimeout(blinkTimer);
  window.clearTimeout(moveTimer);
  startSession();
}

onMounted(() => {
  warmWakeOwlAudio(session.settings.sound);
});

onUnmounted(() => {
  window.clearTimeout(blinkTimer);
  window.clearTimeout(moveTimer);
  disposeWakeOwlAudio();
});
</script>

<template>
  <div class="wake-owl-shell">
    <div class="wake-owl-night" aria-hidden="true">
      <span class="wake-owl-moon" />
      <span class="wake-owl-star wake-owl-star--one" />
      <span class="wake-owl-star wake-owl-star--two" />
      <span class="wake-owl-star wake-owl-star--three" />
    </div>

    <GameHud
      title="Разбуди сову"
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

    <section class="wake-owl-playfield" aria-label="Игровая область: разбуди сову">
      <v-card class="wake-owl-copy-card px-4 py-3 text-center" color="transparent" elevation="0">
        <div class="text-overline text-blue-lighten-4">фиксация взглядом</div>
        <h1 class="text-h4 text-sm-h3 font-weight-bold">Разбуди сонную сову</h1>
        <p class="text-body-1 text-sm-h6 text-blue-grey-lighten-4 mb-0">Удерживай взгляд на сове. Здесь нет ошибок.</p>
      </v-card>

      <div class="wake-owl-target-zone" :style="owlTargetStyle">
        <GameDwellButton
          target-id="wake-owl:owl"
          :dwell-ms="session.settings.dwellMs"
          :disabled="session.status !== 'running'"
          :min-height="320"
          color="transparent"
          class="wake-owl-target"
          @select="wakeOwl"
        >
          <template #default="{ active, progress }">
            <div
              :class="['wake-owl-owl', { 'wake-owl-owl--active': active, 'wake-owl-owl--blink': blinking, 'wake-owl-owl--awake': session.step >= session.maxSteps }]"
              :style="owlStyle(active, progress)"
              role="img"
              :aria-label="owlStateText"
            >
              <div class="wake-owl-ear wake-owl-ear--left" />
              <div class="wake-owl-ear wake-owl-ear--right" />
              <div class="wake-owl-face">
                <div class="wake-owl-eye wake-owl-eye--left">
                  <span class="wake-owl-pupil" />
                </div>
                <div class="wake-owl-eye wake-owl-eye--right">
                  <span class="wake-owl-pupil" />
                </div>
                <div class="wake-owl-beak" />
              </div>
              <div class="wake-owl-wing wake-owl-wing--left" />
              <div class="wake-owl-wing wake-owl-wing--right" />
              <div class="wake-owl-belly">
                <v-icon icon="mdi-weather-night" size="34" />
              </div>
            </div>
          </template>
        </GameDwellButton>
      </div>

      <v-card class="wake-owl-progress px-4 py-3" color="surface" rounded="xl" variant="tonal">
        <div class="text-body-2 font-weight-medium">Пробуждение: {{ session.step }} из {{ session.maxSteps }}</div>
        <div class="text-caption text-medium-emphasis">{{ owlStateText }}</div>
      </v-card>
    </section>

    <GameResultDialog
      :model-value="resultVisible"
      title="Разбуди сову"
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
.wake-owl-shell {
  background: linear-gradient(180deg, #101a34 0%, #17294d 54%, #20344b 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.wake-owl-night {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.wake-owl-playfield {
  block-size: 100vh;
  inset: 0;
  padding: clamp(110px, 13vh, 148px) clamp(40px, 5vw, 92px) clamp(104px, 13vh, 136px);
  position: absolute;
  z-index: 1;
}

.wake-owl-copy-card {
  color: #f5f8ff;
  inset-block-start: clamp(102px, 11vh, 132px);
  inset-inline: clamp(22px, 7vw, 160px);
  pointer-events: none;
  position: absolute;
  text-shadow: 0 2px 18px rgb(6 11 28 / 52%);
  z-index: 2;
}

.wake-owl-moon {
  background: radial-gradient(circle at 36% 34%, #fff9d4 0 28%, #f1d98f 62%, #d4a84f 100%);
  border-radius: 999px;
  block-size: clamp(72px, 12vw, 124px);
  box-shadow: 0 0 70px rgb(255 225 150 / 34%);
  inline-size: clamp(72px, 12vw, 124px);
  inset-block-start: 12%;
  inset-inline-end: 12%;
  position: absolute;
}

.wake-owl-star {
  background: rgb(232 244 255 / 78%);
  border-radius: 999px;
  block-size: 0.55rem;
  box-shadow: 0 0 28px rgb(194 226 255 / 44%);
  inline-size: 0.55rem;
  position: absolute;
}

.wake-owl-star--one {
  inset-block-start: 20%;
  inset-inline-start: 14%;
}

.wake-owl-star--two {
  inset-block-start: 31%;
  inset-inline-start: 30%;
  transform: scale(0.72);
}

.wake-owl-star--three {
  inset-block-start: 16%;
  inset-inline-end: 34%;
  transform: scale(0.58);
}

.wake-owl-target-zone {
  --owl-x: 50%;
  --owl-y: 62%;
  inline-size: clamp(320px, 29vw, 500px);
  inset-block-start: var(--owl-y);
  inset-inline-start: var(--owl-x);
  position: absolute;
  transform: translate(-50%, -50%);
  transition: inset-block-start 620ms ease, inset-inline-start 620ms ease;
  z-index: 2;
}

.wake-owl-target {
  inline-size: 100%;
}

.wake-owl-target :deep(.dwell-button) {
  background: transparent !important;
  box-shadow: none !important;
}

.wake-owl-owl {
  --eye-glow: 18px;
  --eye-height: 30px;
  --pupil-opacity: 0.4;
  --pupil-size: 16px;
  aspect-ratio: 1 / 0.88;
  background: radial-gradient(circle at 50% 38%, #8a6742 0 30%, #6a4b31 62%, #4a3329 100%);
  border: clamp(8px, 1.6vw, 14px) solid rgb(238 203 140 / 72%);
  border-radius: 48% 48% 42% 42%;
  box-shadow: inset 0 -26px 56px rgb(42 26 22 / 34%), 0 34px 90px rgb(5 10 25 / 44%);
  margin-inline: auto;
  max-inline-size: 100%;
  min-inline-size: 100%;
  position: relative;
  transition: filter 220ms ease, transform 220ms ease;
}

.wake-owl-owl--active {
  filter: drop-shadow(0 0 34px rgb(255 226 150 / 34%));
  transform: translateY(-4px) scale(1.015);
}

.wake-owl-ear {
  background: #5a3d2d;
  block-size: 30%;
  border-radius: 26% 72% 20% 64%;
  inline-size: 24%;
  inset-block-start: -8%;
  position: absolute;
  z-index: -1;
}

.wake-owl-ear--left {
  inset-inline-start: 13%;
  transform: rotate(-26deg);
}

.wake-owl-ear--right {
  inset-inline-end: 13%;
  transform: scaleX(-1) rotate(-26deg);
}

.wake-owl-face {
  align-items: center;
  display: grid;
  gap: clamp(18px, 5vw, 44px);
  grid-template-columns: 1fr 1fr;
  inset-block-start: 18%;
  inset-inline: 14%;
  justify-items: center;
  position: absolute;
}

.wake-owl-eye {
  align-items: center;
  animation: wake-owl-slow-blink 7.5s ease-in-out infinite;
  background: radial-gradient(circle at 50% 48%, #ffeaa6 0 40%, #d69a3a 70%, #7e5128 100%);
  block-size: var(--eye-height);
  border: clamp(5px, 1vw, 9px) solid #f8d891;
  border-radius: 999px;
  box-shadow: inset 0 0 24px rgb(95 58 24 / 32%), 0 0 var(--eye-glow) rgb(255 220 128 / 34%);
  display: flex;
  inline-size: clamp(78px, 18vw, 128px);
  justify-content: center;
  overflow: hidden;
  transform-origin: center;
  transition: block-size 180ms ease, box-shadow 180ms ease;
}

.wake-owl-owl--blink.wake-owl-eye {
  animation: wake-owl-eye-blink 520ms ease-out;
}

.wake-owl-owl--awake.wake-owl-eye {
  animation: wake-owl-awake-blink 5.8s ease-in-out infinite;
}

.wake-owl-pupil {
  background: radial-gradient(circle at 38% 34%, #ffffff 0 10%, #1c2531 12% 100%);
  border-radius: 999px;
  block-size: var(--pupil-size);
  box-shadow: 0 0 18px rgb(255 246 202 / 42%);
  inline-size: var(--pupil-size);
  opacity: var(--pupil-opacity);
  transition: block-size 180ms ease, inline-size 180ms ease, opacity 180ms ease;
}

.wake-owl-beak {
  background: linear-gradient(180deg, #ffc85f, #d88929);
  block-size: clamp(30px, 5vw, 46px);
  clip-path: polygon(50% 100%, 0 0, 100% 0);
  grid-column: 1 / -1;
  inline-size: clamp(42px, 7vw, 62px);
  margin-block-start: -8px;
}

.wake-owl-wing {
  background: rgb(65 43 34 / 58%);
  block-size: 40%;
  border-radius: 60% 28% 56% 36%;
  inline-size: 22%;
  inset-block-start: 43%;
  position: absolute;
}

.wake-owl-wing--left {
  inset-inline-start: 4%;
  transform: rotate(10deg);
}

.wake-owl-wing--right {
  inset-inline-end: 4%;
  transform: scaleX(-1) rotate(10deg);
}

.wake-owl-belly {
  align-items: center;
  background: rgb(240 206 147 / 28%);
  block-size: 24%;
  border-radius: 50% 50% 46% 46%;
  color: rgb(255 236 185 / 78%);
  display: flex;
  inline-size: 34%;
  inset-block-end: 8%;
  inset-inline-start: 33%;
  justify-content: center;
  position: absolute;
}

.wake-owl-progress {
  inset-block-end: max(24px, env(safe-area-inset-bottom));
  inset-inline: clamp(22px, 28vw, 520px);
  inline-size: min(520px, 100%);
  margin-inline: auto;
  position: absolute;
  z-index: 3;
}

@keyframes wake-owl-slow-blink {
  0%, 88%, 100% {
    transform: scaleY(1);
  }

  92% {
    transform: scaleY(0.18);
  }
}

@keyframes wake-owl-awake-blink {
  0%, 90%, 100% {
    transform: scaleY(1);
  }

  94% {
    transform: scaleY(0.12);
  }
}

@keyframes wake-owl-eye-blink {
  0%, 100% {
    transform: scaleY(1);
  }

  44% {
    transform: scaleY(0.1);
  }
}

@media (max-width: 600px) {
 .wake-owl-playfield {
    padding: 120px 18px 116px;
  }

 .wake-owl-copy-card {
    inset-block-start: 96px;
    inset-inline: 14px;
  }

 .wake-owl-target-zone {
    inline-size: min(74vw, 330px);
  }

 .wake-owl-progress {
    inset-inline: 16px;
  }
}
</style>
