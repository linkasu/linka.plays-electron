<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { colorCircleFeedback } from "./audio";
import { generateColorCircleRound, type ColorCircleColor } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("color-circle", { maxSteps: 8, finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateColorCircleRound(roundIndex)
});

const feedbackText = ref("Смотри на сектор нужного цвета.");
const revealedTargetId = ref<string>();
const selectedMistakeId = ref<string>();
const advancing = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "color-circle", soundEnabled: toRef(session.settings, "sound") });
const responseAudio = useGamePromptAudio({ gameId: "color-circle", soundEnabled: toRef(session.settings, "sound") });
let advanceTimer = 0;

const targetStyle = computed(() => ({
  "--target-color": round.value.target.hex,
  "--target-text": round.value.target.textColor
}));

function sectorTargetId(color: ColorCircleColor) {
  return `color-circle:sector:${round.value.roundId}:${color.id}`;
}

function sectorStyle(color: ColorCircleColor) {
  return {
    "--sector-color": color.hex,
    "--sector-text": color.textColor
  };
}

function clearAdvanceTimer() {
  window.clearTimeout(advanceTimer);
  promptAudio.cancelPending();
  advanceTimer = 0;
}

function playTargetPrompt(delayMs = 0) {
  promptAudio.play(`color-circle.prompt.${round.value.target.id}`, delayMs);
}

function playResponseTts(id: string, delayMs = 920) {
  responseAudio.cancelPending();
  responseAudio.play(id, delayMs);
}

function prepareNextRound() {
  clearAdvanceTimer();
  advancing.value = true;
  advanceTimer = window.setTimeout(() => {
    advancing.value = false;
    revealedTargetId.value = undefined;
    selectedMistakeId.value = undefined;
    feedbackText.value = "Смотри на сектор нужного цвета.";
    if (session.status === "running") {
      nextRound();
      playTargetPrompt(160);
    }
  }, 2100);
}

function answer(color: ColorCircleColor) {
  if (session.status !== "running" || advancing.value) return;

  const targetId = sectorTargetId(color);
  const expectedTargetId = sectorTargetId(round.value.target);

  if (color.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: color.id, expected: round.value.target.label, actual: color.label, isCorrect: true });
    feedbackText.value = `Да, это ${color.label}.`;
    void colorCircleFeedback.playSuccess(session.settings.sound);
    playResponseTts(`color-circle.${color.id}`);
    revealedTargetId.value = color.id;
    selectedMistakeId.value = undefined;
    if (session.status === "running" && session.step < session.maxSteps) prepareNextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: color.id, expected: round.value.target.label, actual: color.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, message: "Показан нужный цвет перед следующим кругом." });
  feedbackText.value = `Это ${color.label}. Нужен был ${round.value.target.label}. Следующий круг спокойно.`;
  void colorCircleFeedback.playMistake(session.settings.sound);
  playResponseTts(`color-circle.${color.id}`);
  revealedTargetId.value = round.value.target.id;
  selectedMistakeId.value = color.id;
  prepareNextRound();
}

function restart() {
  clearAdvanceTimer();
  responseAudio.cancelPending();
  feedbackText.value = "Смотри на сектор нужного цвета.";
  revealedTargetId.value = undefined;
  selectedMistakeId.value = undefined;
  advancing.value = false;
  restartRoundGame();
  playTargetPrompt(160);
}

onMounted(() => {
  colorCircleFeedback.warm(session.settings.sound);
  promptAudio.warm();
  responseAudio.warm();
  playTargetPrompt(450);
});

watch(() => session.settings.sound, (enabled) => {
  colorCircleFeedback.warm(enabled);
});

onUnmounted(() => {
  clearAdvanceTimer();
  responseAudio.dispose();
  colorCircleFeedback.dispose();
});
</script>

<template>
  <div class="color-circle-shell">
    <GameHud title="Цветной круг" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="color-circle-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="color-circle-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="color-circle-overline text-overline text-secondary text-center mb-2">Первый выбор цвета</div>
            <h1 class="color-circle-title text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <div class="target-chip mx-auto mb-4" :style="targetStyle">
              <span class="target-chip__dot" aria-hidden="true" />
              <span>{{ round.target.label }}</span>
            </div>
            <p class="color-circle-feedback text-h6 text-md-h5 text-medium-emphasis text-center mb-6">{{ feedbackText }}</p>

            <div class="color-circle-board mx-auto" role="group" :aria-label="round.prompt">
              <GameDwellButton v-for="color in round.sectors" :key="`${round.roundId}-${color.id}`" class="color-sector-button" :target-id="sectorTargetId(color)" :disabled="session.status !== 'running' || advancing" :dwell-ms="session.settings.dwellMs" min-height="0" color="surface" @select="answer(color)">
                <template #default>
                  <div :class="['color-sector', { 'color-sector--target': color.id === revealedTargetId, 'color-sector--mistake': color.id === selectedMistakeId }]" :style="sectorStyle(color)">
                    <span class="text-h5 text-md-h4 font-weight-bold color-sector__label">{{ color.label }}</span>
                  </div>
                </template>
              </GameDwellButton>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Цветной круг" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.color-circle-shell {
  background: radial-gradient(circle at 50% 20%, #fff9e8 0%, #edf8ff 46%, #f7f0ff 100%);
  min-block-size: 100vh;
}

.color-circle-container {
  min-block-size: 100vh;
  padding-block-start: 7.5rem;
}

.color-circle-card {
  overflow: hidden;
}

.target-chip {
  align-items: center;
  background: var(--target-color);
  border: 0.25rem solid rgb(255 255 255 / 84%);
  border-radius: 999px;
  box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 14%);
  color: var(--target-text);
  display: flex;
  font-size: clamp(1.25rem, 3vw, 1.9rem);
  font-weight: 800;
  gap: 0.75rem;
  inline-size: fit-content;
  padding: 0.65rem 1.25rem;
}

.target-chip__dot {
  background: currentColor;
  border-radius: 999px;
  block-size: 1.1rem;
  box-shadow: 0 0 0 0.35rem rgb(255 255 255 / 26%);
  inline-size: 1.1rem;
}

.color-circle-board {
  aspect-ratio: 1;
  background: rgb(255 255 255 / 86%);
  border: 0.75rem solid rgb(255 255 255 / 90%);
  border-radius: 50%;
  box-shadow: 0 1.25rem 3.5rem rgb(61 55 89 / 22%);
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  inline-size: min(78vw, 52vh, 30rem);
  overflow: hidden;
}

.color-sector-button {
  block-size: 100%;
  min-block-size: 0;
}

.color-sector-button :deep(.dwell-button) {
  border-radius: 0 !important;
  box-shadow: none;
  padding: 0 !important;
}

.color-sector-button :deep(.dwell-hitbox) {
  block-size: 100%;
}

.color-sector {
  align-items: center;
  background: var(--sector-color);
  block-size: 100%;
  color: var(--sector-text);
  display: flex;
  justify-content: center;
  min-block-size: clamp(8.25rem, 24vw, 16rem);
  padding: 0.6rem;
  position: relative;
  transition: filter 180ms ease, transform 180ms ease;
}

.color-sector__label {
  font-size: clamp(1.05rem, min(2.7vw, 3.8vh), 1.75rem) !important;
  line-height: 1.05;
  overflow-wrap: anywhere;
  text-align: center;
  text-shadow: 0 0.125rem 0.5rem rgb(0 0 0 / 28%);
}

.color-sector--target::after {
  border: 0.45rem solid rgb(255 255 255 / 88%);
  border-radius: 1.25rem;
  content: "";
  inset: 1.2rem;
  position: absolute;
}

.color-sector--mistake {
  filter: saturate(0.72) brightness(0.96);
}

@media (max-height: 920px) {
  .color-circle-container {
    align-items: flex-start !important;
    padding-block-start: 5.9rem;
  }

  .color-circle-card {
    padding-block: 0.9rem !important;
  }

  .color-circle-overline,
  .color-circle-feedback {
    display: none;
  }

  .color-circle-title {
    font-size: clamp(2rem, 5vw, 3rem) !important;
    margin-block-end: 0.45rem !important;
  }

  .target-chip {
    font-size: clamp(1rem, 2.1vw, 1.45rem);
    margin-block-end: 0.75rem !important;
    padding: 0.45rem 1rem;
  }

  .color-circle-board {
    border-width: 0.5rem;
    gap: 0.35rem;
    inline-size: min(76vw, 43vh, 27rem);
  }

  .color-sector {
    min-block-size: 0;
  }
}

@media (max-width: 600px) {
  .color-circle-container {
    padding-block-start: 6.75rem;
  }

  .color-circle-board {
    inline-size: min(88vw, 31rem);
  }
}
</style>
