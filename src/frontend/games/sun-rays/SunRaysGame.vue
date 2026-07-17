<script setup lang="ts">
import { computed, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStartPromptAudio } from "../../composables/useStartPromptAudio";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import SunRaysCanvas from "./SunRaysCanvas.vue";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSessionFor("sun-rays", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 1400, sessionSeconds: 80, targetScale: 1.7, motionSpeed: 0.35, distractors: "none", hints: "high", sound: true },
  finishOnMistakes: false
});
useStartPromptAudio({ gameId: "sun-rays", soundEnabled: toRef(session.settings, "sound") });

const resultVisible = computed(() => session.status === "finished");
const targetId = computed(() => `sun-rays:sun:${Math.min(session.step + 1, session.maxSteps)}`);
const raysLabel = computed(() => `${Math.min(session.step, session.maxSteps)} из ${session.maxSteps}`);
const feedback = useStandardGameFeedback(toRef(session.settings, "sound"));

function sunText(active: boolean, progress: number) {
  if (session.step >= session.maxSteps) return "Все лучи открыты";
  if (!active) return "Смотри на солнце";
  return progress > 0.72 ? "Луч раскрывается" : "Держи взгляд";
}

function selectSun() {
  if (session.status !== "running" || session.step >= session.maxSteps) return;
  void feedback.playSuccess();
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
          <div class="text-overline text-amber-darken-2">первая фиксация</div>
          <h1 class="text-h4 text-sm-h3 font-weight-bold">Открой лучи солнца</h1>
          <p class="text-body-1 text-sm-h6 text-medium-emphasis mb-0">Смотри в центр. Если взгляд ушёл, солнце просто подождёт.</p>
        </div>

        <GameDwellButton
          :target-id="targetId"
          :disabled="session.status !== 'running' || session.step >= session.maxSteps"
          :dwell-ms="session.settings.dwellMs"
          min-height="clamp(16rem, 44vh, 22rem)"
          color="amber-lighten-5"
          class="sun-rays-target"
          @select="selectSun"
        >
          <template #default="{ active, progress }">
            <SunRaysCanvas
              :active="active"
              :max-steps="session.maxSteps"
              :progress="progress"
              :rays-label="raysLabel"
              :step="session.step"
              :title="sunText(active, progress)"
            />
          </template>
        </GameDwellButton>

        <v-card class="sun-rays-note mt-5 mx-auto px-4 py-3" color="amber-lighten-5" rounded="xl" variant="tonal">
          <div class="text-body-2 font-weight-medium">Открыто лучей: {{ raysLabel }}</div>
          <div class="text-caption text-medium-emphasis">Уход взгляда не считается ошибкой, прогресс начнётся заново.</div>
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
  min-block-size: 100dvh;
  overflow: hidden;
}

.sun-rays-container {
  min-block-size: 100dvh;
  padding-block-start: 4.75rem;
}

.sun-rays-card {
  inline-size: min(58.75rem, 100%);
}

.sun-rays-copy {
  color: #4d3216;
  text-shadow: 0 0.125rem 1.5rem rgb(255 255 255 / 42%);
}

.sun-rays-target :deep(.dwell-button) {
  background: transparent !important;
  box-shadow: 0 1.5rem 4.375rem rgb(173 112 38 / 22%);
  color: #59340e;
  padding: 0 !important;
}

.sun-rays-note {
  max-inline-size: 35rem;
}
</style>
