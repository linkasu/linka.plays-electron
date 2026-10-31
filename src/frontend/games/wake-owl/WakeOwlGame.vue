<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import type { CSSProperties } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStartPromptAudio } from "../../composables/useStartPromptAudio";
import { gameArtSrc } from "../../core/gameArt";
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
  { x: 64, y: 42 },
];

const router = useRouter();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  recordSuccess,
  startSession,
} = useGameSessionFor("wake-owl", {
  maxSteps: 8,
  overrides: {
    preset: "gentle",
    targetScale: 1.75,
    motionSpeed: 0.32,
    distractors: "none",
    hints: "high",
    sound: true,
  },
  finishOnMistakes: false,
});
useStartPromptAudio({ gameId: "wake-owl", soundEnabled: toRef(session.settings, "sound") });

const blinking = ref(false);
const owlPositionIndex = ref(0);
const resultVisible = computed(() => session.status === "finished");
const awakeRatio = computed(() => Math.min(1, session.step / session.maxSteps));
const owlTargetStyle = computed(() => {
  const position = owlPositions[owlPositionIndex.value] ?? owlPositions[0];
  return {
    "--owl-x": `${position.x}%`,
    "--owl-y": `${position.y}%`,
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

// Drawn owl: the same body with sleeping, half-open and open eyes.
const owlFrames = {
  sleep: gameArtSrc("wake-owl/owl-sleep"),
  half: gameArtSrc("wake-owl/owl-half"),
  awake: gameArtSrc("wake-owl/owl-awake"),
};
const wingSrc = {
  left: gameArtSrc("wake-owl/wing-left"),
  right: gameArtSrc("wake-owl/wing-right"),
};

function owlFrame(active: boolean, progress: number) {
  if (blinking.value) return owlFrames.sleep;
  const open = eyeOpenValue(active, progress);
  if (open < 0.4) return owlFrames.sleep;
  if (open < 0.8) return owlFrames.half;
  return owlFrames.awake;
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
      owlPositionIndex.value =
        (owlPositionIndex.value + 1 + (session.step % 2)) % owlPositions.length;
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

    <section class="wake-owl-playfield game-hud-clear" aria-label="Игровая область: разбуди сову">
      <v-card class="wake-owl-copy-card px-4 py-3 text-center" color="transparent" elevation="0">
        <div class="text-overline text-blue-lighten-4">фиксация взглядом</div>
        <h1 class="text-h4 text-sm-h3 font-weight-bold">Разбуди сонную сову</h1>
        <p class="text-body-1 text-sm-h6 text-blue-grey-lighten-4 mb-0">
          Удерживай взгляд на сове. Здесь нет ошибок.
        </p>
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
              :class="[
                'wake-owl-owl',
                {
                  'wake-owl-owl--active': active,
                  'wake-owl-owl--blink': blinking,
                  'wake-owl-owl--awake': session.step >= session.maxSteps,
                },
              ]"
              role="img"
              :aria-label="owlStateText"
            >
              <img
                v-for="side in ['left', 'right'] as const"
                :key="side"
                :class="['wake-owl-wing', `wake-owl-wing--${side}`]"
                :src="wingSrc[side]"
                alt=""
                draggable="false"
              />
              <img
                class="wake-owl-frame"
                :src="owlFrame(active, progress)"
                alt=""
                draggable="false"
              />
            </div>
          </template>
        </GameDwellButton>
      </div>

      <v-card class="wake-owl-progress px-4 py-3" color="surface" rounded="xl" variant="tonal">
        <div class="text-body-2 font-weight-medium">
          Пробуждение: {{ session.step }} из {{ session.maxSteps }}
        </div>
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
  background: var(--linka-scene-night);
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
  padding: clamp(6.875rem, 13vh, 9.25rem) clamp(2.5rem, 5vw, 5.75rem) clamp(6.5rem, 13vh, 8.5rem);
  position: absolute;
  z-index: 1;
}

.wake-owl-copy-card {
  color: #f5f8ff;
  inset-block-start: var(--game-hud-clearance, 10rem);
  inset-inline: clamp(22px, 7vw, 160px);
  pointer-events: none;
  position: absolute;
  text-shadow: 0 2px 18px rgb(6 11 28 / 52%);
  z-index: 2;
}

.wake-owl-moon {
  background: radial-gradient(circle at 36% 34%, #fff9d4 0 28%, #f1d98f 62%, #d4a84f 100%);
  border-radius: 999px;
  block-size: clamp(4.5rem, 12vw, 7.75rem);
  box-shadow: 0 0 70px rgb(255 225 150 / 34%);
  inline-size: clamp(4.5rem, 12vw, 7.75rem);
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
  inline-size: clamp(20rem, 29vw, 31.25rem);
  inset-block-start: var(--owl-y);
  inset-inline-start: var(--owl-x);
  position: absolute;
  transform: translate(-50%, -50%);
  transition:
    inset-block-start 620ms ease,
    inset-inline-start 620ms ease;
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
  aspect-ratio: 1;
  filter: drop-shadow(0 2rem 3rem rgb(5 10 25 / 44%));
  margin-inline: auto;
  max-inline-size: 100%;
  min-inline-size: 100%;
  position: relative;
  transition:
    filter 220ms ease,
    transform 220ms ease;
}

.wake-owl-owl--active {
  filter: drop-shadow(0 0 2rem rgb(255 226 150 / 34%));
  transform: translateY(-0.25rem) scale(1.015);
}

.wake-owl-frame,
.wake-owl-wing {
  position: absolute;
}

.wake-owl-frame {
  block-size: 100%;
  inline-size: 100%;
  inset: 0;
  object-fit: contain;
}

/* Wings sit behind the body at the shoulders and flap when the owl wakes. */
.wake-owl-wing {
  block-size: 30%;
  inline-size: 30%;
  inset-block-start: 42%;
  object-fit: contain;
}

.wake-owl-wing--left {
  inset-inline-start: 6%;
  transform-origin: 85% 30%;
}

.wake-owl-wing--right {
  inset-inline-end: 6%;
  transform-origin: 15% 30%;
}

.wake-owl-owl--blink .wake-owl-wing--left,
.wake-owl-owl--awake .wake-owl-wing--left {
  animation: wake-owl-flap-left 520ms ease-in-out 2;
}

.wake-owl-owl--blink .wake-owl-wing--right,
.wake-owl-owl--awake .wake-owl-wing--right {
  animation: wake-owl-flap-right 520ms ease-in-out 2;
}

.wake-owl-progress {
  inset-block-end: max(24px, env(safe-area-inset-bottom));
  inset-inline: clamp(22px, 28vw, 520px);
  inline-size: min(32.5rem, 100%);
  margin-inline: auto;
  position: absolute;
  z-index: 3;
}

@keyframes wake-owl-flap-left {
  50% {
    transform: rotate(28deg);
  }
}

@keyframes wake-owl-flap-right {
  50% {
    transform: rotate(-28deg);
  }
}

@media (max-width: 37.5rem) {
  .wake-owl-playfield {
    padding: 7.5rem 1.125rem 7.25rem;
  }

  .wake-owl-copy-card {
    inset-block-start: var(--game-hud-clearance, 10rem);
    inset-inline: 14px;
  }

  .wake-owl-target-zone {
    inline-size: min(74vw, 20.625rem);
  }

  .wake-owl-progress {
    inset-inline: 16px;
  }
}
</style>
