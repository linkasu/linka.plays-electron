<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("lighthouse", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1400,
  sessionSeconds: 85,
  targetScale: 1.75,
  motionSpeed: 0.34,
  distractors: "none",
  hints: "high",
  sound: false
}, {
  finishOnMistakes: false
});

const beamActive = ref(false);
const beamKey = ref(0);
const resultVisible = computed(() => session.status === "finished");
const litStepsLabel = computed(() => `${Math.min(session.step, session.maxSteps)} из ${session.maxSteps}`);
const glowRatio = computed(() => Math.min(1, session.step / session.maxSteps));
let beamTimer: number | undefined;

function lighthouseText(active: boolean, progress: number) {
  if (session.step >= session.maxSteps) return "Маяк светит ровно";
  if (!active) return "Смотри на маяк";
  return progress > 0.72 ? "Луч почти готов" : "Держи спокойный взгляд";
}

function clearBeamTimer() {
  if (beamTimer === undefined) return;
  window.clearTimeout(beamTimer);
  beamTimer = undefined;
}

function lightBeacon() {
  if (session.status !== "running") return;

  clearBeamTimer();
  beamActive.value = true;
  beamKey.value += 1;
  recordSuccess({ targetId: `lighthouse:beacon:${session.step + 1}`, label: "луч маяка" });
  beamTimer = window.setTimeout(() => {
    beamActive.value = false;
    beamTimer = undefined;
  }, 1850);
}

function restart() {
  clearBeamTimer();
  beamActive.value = false;
  beamKey.value = 0;
  startSession();
}

onUnmounted(clearBeamTimer);
</script>

<template>
  <div class="lighthouse-shell">
    <div class="lighthouse-sky" aria-hidden="true">
      <span class="lighthouse-star lighthouse-star--one" />
      <span class="lighthouse-star lighthouse-star--two" />
      <span class="lighthouse-star lighthouse-star--three" />
      <span class="lighthouse-moon" />
    </div>

    <GameHud
      title="Маяк"
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

    <v-container class="lighthouse-container d-flex align-center justify-center" fluid>
      <v-card class="lighthouse-scene pa-4 pa-sm-6 pa-md-8" color="transparent" elevation="0">
        <div class="text-center mb-5 mb-md-6 lighthouse-copy">
          <div class="text-overline text-cyan-lighten-3">первая цель для фиксации</div>
          <h1 class="text-h4 text-sm-h3 font-weight-bold">Зажги большой маяк</h1>
          <p class="text-body-1 text-sm-h6 text-blue-grey-lighten-5 mb-0">Удерживай взгляд на башне. Луч мягко пройдёт по морю, ошибок здесь нет.</p>
        </div>

        <GameDwellButton
          :target-id="`lighthouse:beacon:${session.step + 1}`"
          :dwell-ms="session.settings.dwellMs"
          :disabled="session.status !== 'running' || session.step >= session.maxSteps"
          :min-height="420"
          color="transparent"
          class="lighthouse-target mx-auto"
          @select="lightBeacon"
        >
          <template #default="{ active, progress }">
            <div class="lighthouse-stage" :style="{ '--lighthouse-glow': String(Math.max(glowRatio, active ? progress : 0)) }">
              <div :key="beamKey" :class="['lighthouse-beam', { 'lighthouse-beam--active': beamActive || active }]" aria-hidden="true" />
              <div class="lighthouse-sea" aria-hidden="true">
                <span class="lighthouse-wave lighthouse-wave--one" />
                <span class="lighthouse-wave lighthouse-wave--two" />
                <span class="lighthouse-wave lighthouse-wave--three" />
              </div>

              <div :class="['lighthouse-tower', { 'lighthouse-tower--active': active, 'lighthouse-tower--lit': beamActive || session.step > 0 }]" role="img" :aria-label="lighthouseText(active, progress)">
                <div class="lighthouse-roof" />
                <div class="lighthouse-lantern">
                  <v-icon icon="mdi-lightbulb-on-outline" class="lighthouse-icon" />
                </div>
                <div class="lighthouse-body">
                  <span class="lighthouse-stripe lighthouse-stripe--one" />
                  <span class="lighthouse-window" />
                  <span class="lighthouse-stripe lighthouse-stripe--two" />
                  <span class="lighthouse-door" />
                </div>
              </div>

              <div class="lighthouse-label text-body-1 text-sm-h6 font-weight-bold">
                {{ lighthouseText(active, progress) }}
              </div>
            </div>
          </template>
        </GameDwellButton>

        <v-card class="lighthouse-progress mt-5 mx-auto px-4 py-3" color="blue-grey-lighten-5" rounded="xl" variant="tonal">
          <div class="text-body-2 font-weight-medium">Проходов луча: {{ litStepsLabel }}</div>
          <div class="text-caption text-medium-emphasis">Если взгляд ушёл, маяк просто ждёт следующую спокойную фиксацию.</div>
        </v-card>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Маяк"
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
.lighthouse-shell {
  background: linear-gradient(180deg, #101936 0%, #162b4d 48%, #1f5570 72%, #163c59 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.lighthouse-container {
  min-block-size: 100vh;
  padding-block-start: 112px;
}

.lighthouse-sky {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.lighthouse-scene {
  inline-size: min(920px, 100%);
  position: relative;
  z-index: 1;
}

.lighthouse-copy {
  color: #f4fbff;
  text-shadow: 0 2px 18px rgb(7 13 29 / 58%);
}

.lighthouse-moon {
  background: radial-gradient(circle at 35% 32%, #fff7cf 0 28%, #e9d69a 68%, #c5a667 100%);
  block-size: clamp(62px, 10vw, 108px);
  border-radius: 999px;
  box-shadow: 0 0 72px rgb(255 226 165 / 28%);
  inline-size: clamp(62px, 10vw, 108px);
  inset-block-start: 16%;
  inset-inline-end: 13%;
  position: absolute;
}

.lighthouse-star {
  background: rgb(231 246 255 / 80%);
  block-size: 0.55rem;
  border-radius: 999px;
  box-shadow: 0 0 26px rgb(194 231 255 / 42%);
  inline-size: 0.55rem;
  position: absolute;
}

.lighthouse-star--one {
  inset-block-start: 20%;
  inset-inline-start: 12%;
}

.lighthouse-star--two {
  inset-block-start: 31%;
  inset-inline-start: 28%;
  transform: scale(0.72);
}

.lighthouse-star--three {
  inset-block-start: 18%;
  inset-inline-end: 34%;
  transform: scale(0.58);
}

.lighthouse-target {
  inline-size: min(680px, 100%);
}

.lighthouse-target :deep(.dwell-button) {
  background: linear-gradient(180deg, rgb(24 51 78 / 38%), rgb(16 41 65 / 28%)) !important;
  box-shadow: 0 28px 74px rgb(4 12 28 / 24%);
}

.lighthouse-stage {
  --lighthouse-glow: 0;
  align-items: center;
  color: #f9fbff;
  display: flex;
  justify-content: center;
  min-block-size: 420px;
  overflow: hidden;
  position: relative;
}

.lighthouse-beam {
  background: linear-gradient(90deg, rgb(255 235 166 / 0%) 0%, rgb(255 235 166 / 48%) 28%, rgb(194 237 255 / 30%) 58%, rgb(194 237 255 / 0%) 100%);
  block-size: clamp(76px, 15vw, 132px);
  border-radius: 999px;
  filter: blur(0.5px);
  inline-size: min(76vw, 620px);
  inset-block-start: 28%;
  inset-inline-start: 48%;
  opacity: calc(0.15 + var(--lighthouse-glow) * 0.58);
  position: absolute;
  transform: rotate(8deg) translateX(-16%) scaleX(0.56);
  transform-origin: left center;
}

.lighthouse-beam--active {
  animation: lighthouse-beam-sweep 1850ms ease-in-out both;
}

.lighthouse-sea {
  background: linear-gradient(180deg, rgb(68 144 168 / 28%), rgb(19 82 113 / 72%));
  block-size: 34%;
  border-radius: 50% 50% 0 0;
  inline-size: 120%;
  inset-block-end: -10%;
  inset-inline-start: -10%;
  position: absolute;
}

.lighthouse-wave {
  background: rgb(182 232 239 / 24%);
  block-size: 0.35rem;
  border-radius: 999px;
  inline-size: 42%;
  position: absolute;
}

.lighthouse-wave--one {
  inset-block-start: 26%;
  inset-inline-start: 9%;
}

.lighthouse-wave--two {
  inset-block-start: 44%;
  inset-inline-end: 12%;
  opacity: 0.8;
}

.lighthouse-wave--three {
  inset-block-start: 64%;
  inset-inline-start: 28%;
  opacity: 0.64;
}

.lighthouse-tower {
  align-items: center;
  display: flex;
  flex-direction: column;
  filter: drop-shadow(0 30px 44px rgb(0 10 24 / 34%));
  margin-block-start: 0.5rem;
  position: relative;
  transition: filter 220ms ease, transform 220ms ease;
  z-index: 2;
}

.lighthouse-tower--active {
  filter: drop-shadow(0 30px 44px rgb(0 10 24 / 34%)) drop-shadow(0 0 34px rgb(255 231 166 / 32%));
  transform: translateY(-3px) scale(1.02);
}

.lighthouse-roof {
  border-block-end: clamp(34px, 7vw, 48px) solid #ba4850;
  border-inline: clamp(42px, 8vw, 60px) solid transparent;
  inline-size: 0;
}

.lighthouse-lantern {
  align-items: center;
  background: radial-gradient(circle, rgb(255 245 196 / 95%) 0 42%, rgb(245 181 91 / 86%) 72%, rgb(132 64 52 / 82%) 100%);
  border: 7px solid rgb(108 54 54 / 82%);
  border-radius: 28px 28px 14px 14px;
  box-shadow: 0 0 calc(18px + var(--lighthouse-glow) * 36px) rgb(255 231 159 / 52%);
  display: flex;
  inline-size: clamp(104px, 22vw, 146px);
  justify-content: center;
  min-block-size: clamp(70px, 14vw, 96px);
}

.lighthouse-icon {
  color: #744234;
  font-size: clamp(3.2rem, 9vw, 5rem);
  opacity: calc(0.72 + var(--lighthouse-glow) * 0.28);
}

.lighthouse-body {
  align-items: center;
  background: linear-gradient(90deg, #d9edf2 0%, #fff8e8 47%, #bfdbe4 100%);
  block-size: clamp(210px, 35vw, 292px);
  border: 7px solid rgb(78 82 96 / 50%);
  border-radius: 16px 16px 34px 34px;
  display: flex;
  flex-direction: column;
  inline-size: clamp(142px, 27vw, 190px);
  overflow: hidden;
  position: relative;
}

.lighthouse-stripe {
  background: linear-gradient(90deg, #c84d56, #e26b6c, #b43d4d);
  block-size: 18%;
  inline-size: 118%;
  position: absolute;
  transform: rotate(-7deg);
}

.lighthouse-stripe--one {
  inset-block-start: 28%;
}

.lighthouse-stripe--two {
  inset-block-start: 62%;
}

.lighthouse-window {
  background: radial-gradient(circle, #ffe8a8 0 42%, #58454b 45% 100%);
  block-size: clamp(36px, 7vw, 48px);
  border: 5px solid #55485a;
  border-radius: 999px;
  box-shadow: 0 0 calc(10px + var(--lighthouse-glow) * 18px) rgb(255 230 166 / 36%);
  inline-size: clamp(36px, 7vw, 48px);
  margin-block-start: 22%;
  z-index: 1;
}

.lighthouse-door {
  background: linear-gradient(180deg, #5a3e41, #3d313a);
  block-size: 23%;
  border-radius: 999px 999px 0 0;
  inline-size: 34%;
  inset-block-end: 0;
  position: absolute;
  z-index: 1;
}

.lighthouse-label {
  inset-block-end: 1rem;
  position: absolute;
  text-shadow: 0 2px 14px rgb(4 14 26 / 62%);
  z-index: 3;
}

.lighthouse-progress {
  max-inline-size: 540px;
}

@keyframes lighthouse-beam-sweep {
  0% {
    opacity: 0;
    transform: rotate(8deg) translateX(-20%) scaleX(0.38);
  }

  42% {
    opacity: calc(0.4 + var(--lighthouse-glow) * 0.48);
    transform: rotate(2deg) translateX(-2%) scaleX(0.98);
  }

  100% {
    opacity: 0.18;
    transform: rotate(-7deg) translateX(4%) scaleX(0.72);
  }
}

@media (max-width: 640px) {
  .lighthouse-container {
    align-items: flex-start !important;
    padding-block-start: 96px;
  }

  .lighthouse-stage {
    min-block-size: 380px;
  }
}
</style>
