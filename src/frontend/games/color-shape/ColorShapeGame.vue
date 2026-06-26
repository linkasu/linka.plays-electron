<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateColorShapeRound, type ColorShapeItem, type ColorShapeRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("color-shape", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "color-shape", soundEnabled, warmAssetIds: ["color-shape.prompt", "color-shape.correct", "color-shape.mistake", "color-shape.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<ColorShapeRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateColorShapeRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistake = ref<ColorShapeItem>();
const isSpeaking = ref(false);

const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Выбери карточку, где совпадают и цвет, и форма.";
  return "Проверь цвет и форму ещё раз, потом выбери другую карточку.";
});

function choiceTargetId(choiceId: string) {
  return `color-shape:choice:${choiceId}`;
}

function isMistakeChoice(choice: ColorShapeItem) {
  return hintedRoundId.value === round.value.roundId && choice.id === lastMistake.value?.id;
}

async function answer(choice: ColorShapeItem) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistake.value = undefined;
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["color-shape.correct", "color-shape.complete"] : ["color-shape.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.step < session.maxSteps) nextRound();
    promptAudio.play("color-shape.prompt", 180);
    isSpeaking.value = false;
    return;
  }

  hintedRoundId.value = round.value.roundId;
  lastMistake.value = choice;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["color-shape.mistake"], 80);
  isSpeaking.value = false;
}

function restart() {
  promptAudio.cancelPending();
  hintedRoundId.value = undefined;
  lastMistake.value = undefined;
  isSpeaking.value = false;
  restartRoundGame();
  promptAudio.play("color-shape.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("color-shape.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="color-shape-shell">
    <GameHud title="Цвет + форма" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="color-shape-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Два признака вместе</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5" role="status">{{ hintText }}</p>

            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" class="color-shape-choice-col" cols="12" sm="6" :md="round.choices.length <= 3 ? 4 : 3">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="round.choices.length >= 5 ? 215 : 235" @select="answer(choice)">
                  <template #default>
                      <div :class="['object-choice', { 'object-choice--mistake': isMistakeChoice(choice) }]">
                       <div class="shape-panel">
                        <svg class="shape-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                          <circle v-if="choice.shape.id === 'circle'" cx="60" cy="60" r="42" :fill="choice.color.hex" />
                          <rect v-else-if="choice.shape.id === 'square'" x="22" y="22" width="76" height="76" rx="10" :fill="choice.color.hex" />
                          <polygon v-else-if="choice.shape.id === 'triangle'" points="60,16 104,98 16,98" :fill="choice.color.hex" />
                          <polygon v-else points="60,12 74,43 108,46 82,68 90,102 60,84 30,102 38,68 12,46 46,43" :fill="choice.color.hex" />
                        </svg>
                      </div>
                      <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ choice.label }}</div>
                      <div class="trait-row mt-3">
                        <v-chip class="text-white" color="deep-purple-darken-3" variant="flat" size="large" rounded="lg">
                          <span class="color-dot mr-2" :style="{ backgroundColor: choice.color.hex }" />
                          {{ choice.color.label }}
                        </v-chip>
                        <v-chip class="text-white" color="deep-purple-darken-3" variant="flat" size="large" rounded="lg">
                          {{ choice.shape.label }}
                        </v-chip>
                      </div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-shape-outline" rounded="xl" variant="tonal">
                Ошибка не завершает игру. Можно спокойно попробовать ещё раз.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Цвет + форма" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.color-shape-shell {
  background: linear-gradient(135deg, #fff7ed 0%, #eef8ff 52%, #f5f3ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.color-shape-card {
  overflow: hidden;
}

.choice-grid {
  row-gap: 0.75rem;
}

.object-choice {
  align-items: center;
  color: #263238;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: filter 160ms ease, transform 160ms ease;
}

.object-choice--mistake {
  filter: saturate(0.7) opacity(0.72);
  transform: scale(0.97);
}

.shape-panel {
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border: 0.25rem solid rgb(var(--v-theme-outline-variant));
  border-radius: 1.75rem;
  display: flex;
  justify-content: center;
  padding: 0.75rem;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.shape-svg {
  block-size: clamp(5.5rem, min(14vw, 18vh), 8.75rem);
  filter: drop-shadow(0 0.4rem 0.45rem rgb(15 23 42 / 16%));
  inline-size: clamp(5.5rem, min(14vw, 18vh), 8.75rem);
}

.trait-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.color-dot {
  border: 0.125rem solid rgb(255 255 255 / 80%);
  border-radius: 999px;
  block-size: 1rem;
  box-shadow: 0 0.125rem 0.25rem rgb(15 23 42 / 18%);
  display: inline-block;
  inline-size: 1rem;
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .color-shape-card {
    padding: 1rem !important;
  }

  .color-shape-card .text-overline,
  .color-shape-card p,
  .color-shape-card .v-alert {
    display: none;
  }

  .color-shape-card h1 {
    font-size: 2.45rem !important;
    line-height: 1.05;
    margin-block-end: 0.75rem !important;
  }

  .color-shape-choice-col {
    flex: 0 0 25% !important;
    max-inline-size: 25% !important;
  }

  .choice-grid :deep(.dwell-button) {
    min-block-size: 8.75rem !important;
    padding: 0.4rem !important;
  }

  .shape-svg {
    block-size: 4rem;
    inline-size: 4rem;
  }

  .shape-panel {
    border-radius: 1.1rem;
    padding: 0.35rem;
  }

  .object-choice .text-h5 {
    font-size: 1.05rem !important;
    line-height: 1.1;
    margin-block-start: 0.35rem !important;
  }

  .trait-row {
    display: none;
  }
}
</style>
