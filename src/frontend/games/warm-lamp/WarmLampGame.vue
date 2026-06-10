<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import type { CSSProperties } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("warm-lamp", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1350,
  sessionSeconds: 86,
  targetScale: 1.72,
  motionSpeed: 0.3,
  distractors: "none",
  hints: "high",
  sound: false
}, {
  finishOnMistakes: false
});

const glowPulse = ref(false);
const resultVisible = computed(() => session.status === "finished");
const warmthRatio = computed(() => Math.min(1, session.step / session.maxSteps));
const lampStateText = computed(() => {
  if (session.status === "paused") return "Лампа спокойно ждёт паузу.";
  if (session.step >= session.maxSteps) return "Лампа светит ровно и тепло.";
  if (session.step >= 5) return "Лампа уже почти полностью тёплая.";
  if (session.step >= 2) return "Свет становится мягче и теплее.";
  return "Смотри на большую лампу, чтобы она зажглась.";
});

let glowTimer: number | undefined;

function lampStyle(active: boolean, progress: number) {
  const warmth = Math.min(1, warmthRatio.value + (active ? progress * 0.42 : 0));
  return {
    "--lamp-warmth": String(warmth),
    "--lamp-glow": `${22 + warmth * 120}px`,
    "--glow-height": `${190 + warmth * 170}px`,
    "--glow-width": `${210 + warmth * 210}px`,
    "--glow-inner-alpha": String(0.2 + warmth * 0.48),
    "--glow-outer-alpha": String(0.1 + warmth * 0.26),
    "--shade-light": `${58 + warmth * 24}%`,
    "--room-alpha": String(0.12 + warmth * 0.42)
  } as CSSProperties;
}

function warmLamp() {
  if (session.status !== "running") return;
  recordSuccess({ targetId: "warm-lamp:lamp", label: "большая лампа" });
  glowPulse.value = true;
  window.clearTimeout(glowTimer);
  glowTimer = window.setTimeout(() => {
    glowPulse.value = false;
  }, 560);
}

function restart() {
  glowPulse.value = false;
  window.clearTimeout(glowTimer);
  startSession();
}

onUnmounted(() => {
  window.clearTimeout(glowTimer);
});
</script>

<template>
  <div class="warm-lamp-shell" :style="lampStyle(false, 0)">
    <div class="warm-lamp-room" aria-hidden="true">
      <span class="warm-lamp-rug" />
      <span class="warm-lamp-picture warm-lamp-picture--left" />
      <span class="warm-lamp-picture warm-lamp-picture--right" />
    </div>

    <GameHud
      title="Тёплая лампа"
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

    <v-container class="warm-lamp-container d-flex align-center justify-center" fluid>
      <v-card class="warm-lamp-scene pa-4 pa-sm-6 pa-md-8" color="transparent" elevation="0">
        <div class="text-center mb-5 warm-lamp-copy">
          <div class="text-overline text-amber-lighten-3">первая спокойная фиксация</div>
          <h1 class="text-h4 text-sm-h3 font-weight-bold">Зажги тёплую лампу</h1>
          <p class="text-body-1 text-sm-h6 text-brown-lighten-4 mb-0">Удерживай взгляд на большой лампе. Здесь нет ошибок.</p>
        </div>

        <GameDwellButton
          target-id="warm-lamp:lamp"
          :dwell-ms="session.settings.dwellMs"
          :disabled="session.status !== 'running'"
          :min-height="360"
          color="transparent"
          class="warm-lamp-target mx-auto"
          @select="warmLamp"
        >
          <template #default="{ active, progress }">
            <div
              :class="['warm-lamp-lamp', { 'warm-lamp-lamp--active': active, 'warm-lamp-lamp--pulse': glowPulse, 'warm-lamp-lamp--complete': session.step >= session.maxSteps }]"
              :style="lampStyle(active, progress)"
              role="img"
              :aria-label="lampStateText"
            >
              <div class="warm-lamp-glow" />
              <div class="warm-lamp-shade">
                <v-icon icon="mdi-lamp" class="warm-lamp-icon" />
              </div>
              <div class="warm-lamp-neck" />
              <div class="warm-lamp-base" />
              <div class="warm-lamp-caption text-h6 text-sm-h5 font-weight-bold">
                {{ active && progress > 0.82 ? "Почти тепло" : session.step >= session.maxSteps ? "Светит" : "Смотри сюда" }}
              </div>
            </div>
          </template>
        </GameDwellButton>

        <v-card class="warm-lamp-progress mt-5 mx-auto px-4 py-3" color="surface" rounded="xl" variant="tonal">
          <div class="text-body-2 font-weight-medium">Тепло лампы: {{ session.step }} из {{ session.maxSteps }}</div>
          <div class="text-caption text-medium-emphasis">Каждая спокойная фиксация делает свет мягче.</div>
        </v-card>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Тёплая лампа"
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
.warm-lamp-shell {
  --lamp-warmth: 0;
  --room-alpha: 0.12;
  background: radial-gradient(circle at 50% 50%, rgb(255 194 96 / var(--room-alpha)) 0 24%, transparent 56%), linear-gradient(180deg, #2b1d27 0%, #3e2b2d 58%, #4a3328 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.warm-lamp-room {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.warm-lamp-container {
  min-block-size: 100vh;
  padding-block-start: 112px;
}

.warm-lamp-scene {
  inline-size: min(920px, 100%);
  position: relative;
  z-index: 1;
}

.warm-lamp-copy {
  color: #fff5df;
  text-shadow: 0 2px 20px rgb(24 13 16 / 48%);
}

.warm-lamp-rug {
  background: radial-gradient(ellipse at center, rgb(138 82 52 / 46%) 0 42%, rgb(88 48 42 / 18%) 67%, transparent 70%);
  block-size: clamp(160px, 24vw, 260px);
  inline-size: min(720px, 82vw);
  inset-block-end: 5%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.warm-lamp-picture {
  background: linear-gradient(145deg, rgb(255 232 173 / 16%), rgb(113 72 66 / 22%));
  border: 8px solid rgb(123 82 58 / 42%);
  border-radius: 22px;
  block-size: clamp(72px, 12vw, 112px);
  box-shadow: inset 0 0 0 2px rgb(255 237 186 / 10%);
  inline-size: clamp(94px, 16vw, 148px);
  position: absolute;
}

.warm-lamp-picture--left {
  inset-block-start: 22%;
  inset-inline-start: 10%;
  transform: rotate(-4deg);
}

.warm-lamp-picture--right {
  inset-block-start: 19%;
  inset-inline-end: 10%;
  transform: rotate(5deg) scale(0.84);
}

.warm-lamp-target {
  inline-size: min(620px, 100%);
}

.warm-lamp-target :deep(.dwell-button) {
  background: transparent !important;
  box-shadow: none !important;
}

.warm-lamp-lamp {
  --glow-height: 190px;
  --glow-inner-alpha: 0.2;
  --glow-outer-alpha: 0.1;
  --glow-width: 210px;
  --lamp-glow: 22px;
  --shade-light: 58%;
  align-items: center;
  aspect-ratio: 1 / 0.9;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-inline: auto;
  max-inline-size: 520px;
  min-inline-size: min(78vw, 320px);
  position: relative;
  transition: filter 220ms ease, transform 220ms ease;
}

.warm-lamp-lamp--active {
  filter: drop-shadow(0 0 34px rgb(255 204 118 / 34%));
  transform: translateY(-4px) scale(1.015);
}

.warm-lamp-lamp--pulse .warm-lamp-glow {
  animation: warm-lamp-soft-pulse 560ms ease-out;
}

.warm-lamp-glow {
  background: radial-gradient(circle, rgb(255 231 161 / var(--glow-inner-alpha)) 0 18%, rgb(255 185 87 / var(--glow-outer-alpha)) 42%, transparent 70%);
  border-radius: 999px;
  block-size: var(--glow-height);
  filter: blur(1px);
  inline-size: var(--glow-width);
  inset-block-start: 8%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.warm-lamp-shade {
  align-items: center;
  background: radial-gradient(circle at 50% 16%, hsl(44deg 100% var(--shade-light)) 0 28%, hsl(32deg 92% calc(var(--shade-light) - 12%)) 68%, #8b4d31 100%);
  border: clamp(8px, 1.6vw, 14px) solid rgb(255 231 169 / 62%);
  border-radius: 44% 44% 28% 28%;
  box-shadow: inset 0 -28px 46px rgb(115 58 31 / 22%), 0 0 var(--lamp-glow) rgb(255 198 91 / 44%);
  clip-path: polygon(19% 8%, 81% 8%, 95% 100%, 5% 100%);
  color: #683619;
  display: flex;
  inline-size: clamp(220px, 46vw, 360px);
  justify-content: center;
  min-block-size: clamp(160px, 28vw, 230px);
  position: relative;
  z-index: 1;
}

.warm-lamp-icon {
  font-size: clamp(4.6rem, 12vw, 7.4rem);
  opacity: 0.62;
}

.warm-lamp-neck {
  background: linear-gradient(180deg, #c17a3d, #7e482b);
  block-size: clamp(58px, 11vw, 88px);
  border-radius: 999px;
  box-shadow: inset 0 0 0 4px rgb(255 218 145 / 20%);
  inline-size: clamp(34px, 8vw, 52px);
  margin-block-start: -2px;
  position: relative;
  z-index: 1;
}

.warm-lamp-base {
  background: radial-gradient(ellipse at 50% 20%, #d69a55 0 32%, #8a5033 68%, #563124 100%);
  border: 7px solid rgb(255 213 139 / 28%);
  border-radius: 50% 50% 38% 38%;
  block-size: clamp(58px, 11vw, 82px);
  box-shadow: 0 20px 48px rgb(34 18 13 / 34%);
  inline-size: clamp(190px, 38vw, 300px);
  position: relative;
  z-index: 1;
}

.warm-lamp-caption {
  color: #fff3cf;
  margin-block-start: 18px;
  position: relative;
  text-shadow: 0 2px 18px rgb(66 28 15 / 48%);
  z-index: 1;
}

.warm-lamp-progress {
  max-inline-size: 440px;
}

@keyframes warm-lamp-soft-pulse {
  0% {
    opacity: 0.78;
    transform: translateX(-50%) scale(0.96);
  }

  55% {
    opacity: 1;
    transform: translateX(-50%) scale(1.04);
  }

  100% {
    opacity: 0.92;
    transform: translateX(-50%) scale(1);
  }
}

@media (max-width: 640px) {
  .warm-lamp-container {
    align-items: flex-start !important;
    padding-block-start: 96px;
  }

  .warm-lamp-picture {
    display: none;
  }

  .warm-lamp-target {
    inline-size: 100%;
  }
}
</style>
