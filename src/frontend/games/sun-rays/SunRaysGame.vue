<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

const rayIndexes = Array.from({ length: 8 }, (_, index) => index);

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("sun-rays", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1400,
  sessionSeconds: 80,
  targetScale: 1.7,
  motionSpeed: 0.35,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const resultVisible = computed(() => session.status === "finished");
const targetId = computed(() => `sun-rays:sun:${Math.min(session.step + 1, session.maxSteps)}`);
const raysLabel = computed(() => `${Math.min(session.step, session.maxSteps)} из ${session.maxSteps}`);

function rayProgress(index: number, dwellProgress: number) {
  if (index < session.step) return 1;
  if (index === session.step) return dwellProgress;
  return 0;
}

function rayStyle(index: number, dwellProgress: number) {
  return {
    "--ray-angle": `${index * 45 - 90}deg`,
    "--ray-progress": `${rayProgress(index, dwellProgress)}`,
    "--ray-delay": `${index * 45}ms`
  };
}

function sunText(active: boolean, progress: number) {
  if (session.step >= session.maxSteps) return "Все лучи открыты";
  if (!active) return "Смотри на солнце";
  return progress > 0.72 ? "Луч раскрывается" : "Держи взгляд";
}

function selectSun() {
  if (session.status !== "running" || session.step >= session.maxSteps) return;
  recordSuccess({
    targetId: targetId.value,
    label: `Луч ${session.step + 1}`
  });
}

function restart() {
  startSession();
}
</script>

<template>
  <div class="sun-rays-shell">
    <GameHud
      title="Солнце и лучи"
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

    <v-container class="sun-rays-container d-flex align-center justify-center" fluid>
      <v-card class="sun-rays-card pa-4 pa-sm-6 pa-md-8" color="transparent" elevation="0">
        <div class="text-center mb-4 mb-md-6 sun-rays-copy">
          <div class="text-overline text-amber-darken-2">первая спокойная фиксация</div>
          <h1 class="text-h4 text-sm-h3 font-weight-bold">Открой лучи солнца</h1>
          <p class="text-body-1 text-sm-h6 text-medium-emphasis mb-0">Смотри в центр. Если взгляд ушёл, солнце просто подождёт.</p>
        </div>

        <GameDwellButton
          :target-id="targetId"
          :disabled="session.status !== 'running' || session.step >= session.maxSteps"
          :dwell-ms="session.settings.dwellMs"
          :min-height="460"
          color="amber-lighten-5"
          class="sun-rays-target"
          @select="selectSun"
        >
          <template #default="{ active, progress }">
            <div class="sun-rays-visual">
              <div class="sun-rays-rays" aria-hidden="true">
                <span
                  v-for="index in rayIndexes"
                  :key="index"
                  class="sun-rays-ray"
                  :class="{ 'sun-rays-ray--visible': rayProgress(index, progress) > 0 }"
                  :style="rayStyle(index, progress)"
                />
              </div>

              <div class="sun-rays-disc" :class="{ 'sun-rays-disc--active': active }">
                <v-icon icon="mdi-white-balance-sunny" class="sun-rays-icon" />
                <div class="text-h5 text-sm-h4 font-weight-black mt-2">{{ sunText(active, progress) }}</div>
                <div class="text-body-1 text-sm-h6 mt-2 opacity-80">Лучи: {{ raysLabel }}</div>
              </div>
            </div>
          </template>
        </GameDwellButton>

        <v-card class="sun-rays-note mt-5 mx-auto px-4 py-3" color="amber-lighten-5" rounded="xl" variant="tonal">
          <div class="text-body-2 font-weight-medium">Открыто лучей: {{ raysLabel }}</div>
          <div class="text-caption text-medium-emphasis">Уход взгляда не считается ошибкой, прогресс мягко начнётся заново.</div>
        </v-card>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Солнце и лучи"
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
.sun-rays-shell {
  background: radial-gradient(circle at 50% 34%, #fff4ba 0%, #ffe4a3 26%, #f6c98f 56%, #c7dff1 100%);
  min-block-size: 100vh;
  overflow: hidden;
}

.sun-rays-container {
  min-block-size: 100vh;
  padding-block-start: 112px;
}

.sun-rays-card {
  inline-size: min(940px, 100%);
}

.sun-rays-copy {
  color: #4d3216;
  text-shadow: 0 2px 24px rgb(255 255 255 / 42%);
}

.sun-rays-target :deep(.dwell-button) {
  background: linear-gradient(180deg, rgb(255 250 218 / 92%), rgb(255 232 161 / 78%)) !important;
  box-shadow: 0 24px 70px rgb(173 112 38 / 22%);
  color: #59340e;
}

.sun-rays-visual {
  align-items: center;
  display: flex;
  justify-content: center;
  min-block-size: clamp(320px, 52vh, 520px);
  overflow: hidden;
  position: relative;
}

.sun-rays-rays {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.sun-rays-ray {
  background: linear-gradient(90deg, rgb(255 184 54 / 88%), rgb(255 227 117 / 70%), rgb(255 244 186 / 0%));
  block-size: clamp(16px, 2.5vw, 28px);
  border-radius: 999px;
  inline-size: clamp(120px, 28vw, 270px);
  inset-block-start: 50%;
  inset-inline-start: 50%;
  opacity: calc(0.12 + var(--ray-progress) * 0.88);
  position: absolute;
  transform: rotate(var(--ray-angle)) translateX(clamp(92px, 13vw, 138px)) scaleX(var(--ray-progress));
  transform-origin: left center;
  transition: opacity 220ms ease var(--ray-delay), transform 260ms ease var(--ray-delay);
}

.sun-rays-ray--visible {
  box-shadow: 0 0 28px rgb(255 193 68 / 30%);
}

.sun-rays-disc {
  align-items: center;
  aspect-ratio: 1;
  background: radial-gradient(circle at 38% 32%, #fff8c7 0%, #ffd86a 42%, #f5a829 100%);
  border: 8px solid rgb(255 244 184 / 72%);
  border-radius: 999px;
  box-shadow: 0 22px 70px rgb(233 153 32 / 36%), inset 0 -16px 34px rgb(186 99 16 / 18%);
  display: flex;
  flex-direction: column;
  inline-size: clamp(180px, 34vw, 290px);
  justify-content: center;
  padding: 1.25rem;
  position: relative;
  transition: transform 220ms ease, box-shadow 220ms ease;
  z-index: 1;
}

.sun-rays-disc--active {
  box-shadow: 0 28px 86px rgb(233 153 32 / 48%), 0 0 0 18px rgb(255 213 91 / 18%), inset 0 -16px 34px rgb(186 99 16 / 14%);
  transform: scale(1.04);
}

.sun-rays-icon {
  font-size: clamp(4.5rem, 12vw, 7.5rem);
}

.sun-rays-note {
  max-inline-size: 560px;
}

@media (max-width: 600px) {
  .sun-rays-container {
    padding-block-start: 96px;
  }

  .sun-rays-target :deep(.dwell-button) {
    padding-inline: 0.75rem !important;
  }
}
</style>
