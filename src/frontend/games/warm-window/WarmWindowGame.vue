<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type WindowTarget = {
  id: string;
  label: string;
  gridColumn: number;
  gridRow: number;
  lit: boolean;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("warm-window", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1350,
  sessionSeconds: 80,
  targetScale: 1.6,
  motionSpeed: 0.35,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const windows = reactive<WindowTarget[]>([
  { id: "warm-window:window:1", label: "верхнее левое окно", gridColumn: 1, gridRow: 1, lit: false },
  { id: "warm-window:window:2", label: "верхнее среднее окно", gridColumn: 2, gridRow: 1, lit: false },
  { id: "warm-window:window:3", label: "верхнее правое окно", gridColumn: 3, gridRow: 1, lit: false },
  { id: "warm-window:window:4", label: "среднее левое окно", gridColumn: 1, gridRow: 2, lit: false },
  { id: "warm-window:window:5", label: "среднее окно", gridColumn: 2, gridRow: 2, lit: false },
  { id: "warm-window:window:6", label: "среднее правое окно", gridColumn: 3, gridRow: 2, lit: false },
  { id: "warm-window:window:7", label: "нижнее левое окно", gridColumn: 1, gridRow: 3, lit: false },
  { id: "warm-window:window:8", label: "нижнее правое окно", gridColumn: 3, gridRow: 3, lit: false }
]);

const resultVisible = computed(() => session.status === "finished");
const litCount = computed(() => windows.filter((windowTarget) => windowTarget.lit).length);

function lightWindow(windowTarget: WindowTarget) {
  if (session.status !== "running" || windowTarget.lit) return;
  windowTarget.lit = true;
  recordSuccess({ targetId: windowTarget.id, label: windowTarget.label });
}

function restart() {
  for (const windowTarget of windows) windowTarget.lit = false;
  startSession();
}
</script>

<template>
  <div class="warm-window-shell">
    <div class="warm-window-sky" aria-hidden="true">
      <span class="warm-window-star warm-window-star--one" />
      <span class="warm-window-star warm-window-star--two" />
      <span class="warm-window-star warm-window-star--three" />
    </div>

    <GameHud
      title="Тёплое окно"
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

    <v-container class="warm-window-container d-flex align-center justify-center" fluid>
      <v-card class="warm-window-scene pa-4 pa-sm-6 pa-md-8" color="transparent" elevation="0">
        <div class="text-center mb-4 mb-md-6 warm-window-copy">
          <div class="text-overline text-amber-lighten-3">спокойная фиксация взглядом</div>
          <h1 class="text-h4 text-sm-h3 font-weight-bold">Зажги тёплый свет в окнах</h1>
          <p class="text-body-1 text-sm-h6 text-blue-grey-lighten-4 mb-0">Смотри на любое тёмное окно. Здесь нет ошибок.</p>
        </div>

        <div class="warm-window-house" role="group" aria-label="Дом с окнами для игры Тёплое окно">
          <div class="warm-window-roof" aria-hidden="true" />
          <div class="warm-window-body">
            <div class="warm-window-grid">
              <GameDwellButton
                v-for="windowTarget in windows"
                :key="windowTarget.id"
                :target-id="windowTarget.id"
                :dwell-ms="session.settings.dwellMs"
                :disabled="session.status !== 'running' || windowTarget.lit"
                :min-height="92"
                :color="windowTarget.lit ? 'amber-lighten-4' : 'blue-grey-darken-3'"
                class="warm-window-target"
                :style="{ gridColumn: windowTarget.gridColumn, gridRow: windowTarget.gridRow }"
                @select="lightWindow(windowTarget)"
              >
                <template #default="{ active, progress }">
                  <div :class="['warm-window-pane', { 'warm-window-pane--lit': windowTarget.lit, 'warm-window-pane--active': active }]">
                    <v-icon :icon="windowTarget.lit ? 'mdi-weather-sunset' : 'mdi-window-closed'" class="warm-window-pane-icon" />
                    <div class="text-caption font-weight-medium mt-1">
                      {{ windowTarget.lit ? "Тепло" : active && progress > 0.75 ? "Почти" : "Смотри" }}
                    </div>
                  </div>
                </template>
              </GameDwellButton>

              <div class="warm-window-door" aria-hidden="true">
                <v-icon icon="mdi-home-heart" />
              </div>
            </div>
          </div>
        </div>

        <v-card class="warm-window-progress mt-5 mx-auto px-4 py-3" color="surface" rounded="xl" variant="tonal">
          <div class="text-body-2 font-weight-medium">Зажжено окон: {{ litCount }} из {{ session.maxSteps }}</div>
          <div class="text-caption text-medium-emphasis">Можно смотреть в любом порядке, дом просто становится светлее.</div>
        </v-card>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Тёплое окно"
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
.warm-window-shell {
  background: linear-gradient(180deg, #19213b 0%, #283655 48%, #3f4659 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.warm-window-container {
  min-block-size: 100vh;
  padding-block-start: 112px;
}

.warm-window-sky {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.warm-window-star {
  background: rgb(255 238 188 / 72%);
  border-radius: 999px;
  box-shadow: 0 0 34px rgb(255 226 163 / 42%);
  block-size: 0.6rem;
  inline-size: 0.6rem;
  position: absolute;
}

.warm-window-star--one {
  inset-block-start: 18%;
  inset-inline-start: 15%;
}

.warm-window-star--two {
  inset-block-start: 28%;
  inset-inline-end: 18%;
  transform: scale(0.75);
}

.warm-window-star--three {
  inset-block-start: 12%;
  inset-inline-end: 34%;
  transform: scale(0.55);
}

.warm-window-scene {
  inline-size: min(920px, 100%);
  position: relative;
  z-index: 1;
}

.warm-window-copy {
  color: #fff8e8;
  text-shadow: 0 2px 18px rgb(20 21 38 / 42%);
}

.warm-window-house {
  margin-inline: auto;
  max-inline-size: 680px;
  padding-block-start: clamp(54px, 9vw, 84px);
  position: relative;
}

.warm-window-roof {
  background: linear-gradient(135deg, #8f4b3f, #b96f4f 58%, #d09163);
  block-size: clamp(104px, 18vw, 150px);
  border-radius: 28px 28px 10px 10px;
  box-shadow: 0 22px 52px rgb(30 19 28 / 28%);
  inline-size: 72%;
  inset-block-start: 6px;
  inset-inline-start: 14%;
  position: absolute;
  transform: perspective(240px) rotateX(42deg) rotate(45deg);
  transform-origin: center;
}

.warm-window-body {
  background: linear-gradient(180deg, #f0c796 0%, #d7a26f 100%);
  border: 10px solid rgb(112 70 58 / 44%);
  border-radius: 36px 36px 24px 24px;
  box-shadow: inset 0 0 0 2px rgb(255 244 214 / 28%), 0 28px 70px rgb(16 18 32 / 36%);
  margin-inline: auto;
  max-inline-size: 560px;
  padding: clamp(22px, 4vw, 38px);
  position: relative;
}

.warm-window-grid {
  display: grid;
  gap: clamp(14px, 3vw, 26px);
  grid-template-columns: repeat(3, minmax(72px, 1fr));
  grid-template-rows: repeat(3, minmax(82px, 1fr));
}

.warm-window-target {
  min-block-size: clamp(82px, 13vw, 116px);
}

.warm-window-pane {
  align-items: center;
  color: rgb(222 232 238 / 92%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 100%;
  text-shadow: none;
  transition: color 180ms ease, filter 180ms ease, transform 180ms ease;
}

.warm-window-pane--active {
  color: #fff7dd;
  transform: scale(1.04);
}

.warm-window-pane--lit {
  color: #744118;
  filter: drop-shadow(0 0 18px rgb(255 200 102 / 64%));
}

.warm-window-pane-icon {
  font-size: clamp(2.2rem, 6vw, 3.8rem);
}

.warm-window-door {
  align-items: center;
  background: linear-gradient(180deg, #7c503d, #5c352d);
  border-radius: 24px 24px 8px 8px;
  block-size: 100%;
  color: #ffd88b;
  display: flex;
  font-size: clamp(2rem, 5vw, 3rem);
  grid-column: 2;
  grid-row: 3;
  justify-content: center;
  min-block-size: clamp(82px, 13vw, 116px);
}

.warm-window-progress {
  max-inline-size: 440px;
}

@media (max-width: 640px) {
  .warm-window-container {
    align-items: flex-start !important;
    padding-block-start: 96px;
  }

  .warm-window-body {
    border-width: 7px;
    padding: 18px;
  }

  .warm-window-grid {
    gap: 12px;
    grid-template-columns: repeat(3, minmax(58px, 1fr));
    grid-template-rows: repeat(3, minmax(72px, 1fr));
  }
}
</style>
