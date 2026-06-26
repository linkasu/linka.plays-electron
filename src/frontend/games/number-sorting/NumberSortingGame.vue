<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useRoundGame } from "../../composables/useRoundGame";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateNumberSortingRound, type NumberSortingCard } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("number-sorting", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 130, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "number-sorting", soundEnabled, warmAssetIds: ["number-sorting.prompt", "number-sorting.correct", "number-sorting.mistake", "number-sorting.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRounds } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateNumberSortingRound(session.settings, roundIndex)
});

const selectedNumbers = ref<number[]>([]);
const wrongNumber = ref<number>();
const pendingFeedback = ref(false);

const targetNumber = computed(() => round.value.correctOrder[selectedNumbers.value.length] ?? round.value.correctOrder[0]);
const remainingCount = computed(() => Math.max(0, round.value.correctOrder.length - selectedNumbers.value.length));
const directionLabel = computed(() => round.value.direction === "ascending" ? "по возрастанию" : "по убыванию");
const feedbackText = computed(() => {
  if (wrongNumber.value !== undefined) return "Посмотри на порядок ещё раз и выбери другое число.";
  if (selectedNumbers.value.length > 0) return "Хорошо. Продолжай выбирать числа в нужном порядке.";
  return round.value.helperText;
});

function cardTargetId(card: NumberSortingCard) {
  return `number-sorting:choice:${round.value.roundId}:${card.value}`;
}

function isSelected(value: number) {
  return selectedNumbers.value.includes(value);
}

function clearSoftFeedback() {
  pendingFeedback.value = false;
  wrongNumber.value = undefined;
}

function resetChoices() {
  clearSoftFeedback();
  selectedNumbers.value = [];
}

async function choose(card: NumberSortingCard) {
  if (session.status !== "running" || pendingFeedback.value || isSelected(card.value)) return;

  const expectedNumber = targetNumber.value;
  const targetId = cardTargetId(card);
  const expectedTargetId = `number-sorting:choice:${round.value.roundId}:${expectedNumber}`;

  if (card.value === expectedNumber) {
    const nextSelected = [...selectedNumbers.value, card.value];
    wrongNumber.value = undefined;
    pendingFeedback.value = true;
    selectedNumbers.value = nextSelected;
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, direction: round.value.direction, expected: expectedNumber, actual: card.value, sequence: [...nextSelected], isCorrect: true });
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["number-sorting.correct", "number-sorting.complete"] : ["number-sorting.correct"], 80, 170);

    if (finishedAfterSuccess) {
      finishSession("game-complete");
      pendingFeedback.value = false;
      return;
    }

    if (nextSelected.length >= round.value.correctOrder.length) {
      nextRound();
      resetChoices();
      promptAudio.play("number-sorting.prompt", 180);
      return;
    }

    pendingFeedback.value = false;
    return;
  }

  wrongNumber.value = card.value;
  pendingFeedback.value = true;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, direction: round.value.direction, expected: expectedNumber, actual: card.value, sequence: [...selectedNumbers.value], isCorrect: false });
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["number-sorting.mistake"], 80);
  pendingFeedback.value = false;
  wrongNumber.value = undefined;
}

function cardColor(card: NumberSortingCard) {
  if (isSelected(card.value)) return "green-lighten-4";
  if (wrongNumber.value === card.value) return "orange-lighten-4";
  return "surface";
}

function restart() {
  promptAudio.cancelPending();
  resetChoices();
  restartRounds();
  promptAudio.play("number-sorting.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("number-sorting.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="number-sorting-shell">
    <GameHud title="Сортировка чисел" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Сортируй {{ directionLabel }}</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-4">{{ feedbackText }}</p>

            <v-sheet class="pa-3 pa-md-4 mb-5" color="blue-grey-lighten-5" rounded="xl">
              <div class="d-flex flex-wrap justify-center align-center ga-2">
                <v-chip v-for="number in round.correctOrder" :key="number" :color="selectedNumbers.includes(number) ? 'success' : undefined" :variant="selectedNumbers.includes(number) ? 'flat' : 'tonal'" size="large">
                  {{ selectedNumbers.includes(number) ? number : "..." }}
                </v-chip>
              </div>
              <div class="text-body-2 text-medium-emphasis text-center mt-2">Осталось выбрать: {{ remainingCount }}</div>
            </v-sheet>

            <v-row class="card-grid" justify="center" dense>
              <v-col v-for="card in round.cards" :key="card.id" cols="12" sm="6" md="4" class="number-card-col">
                <GameDwellButton :class="{ 'number-choice--wrong': wrongNumber === card.value, 'number-choice--selected': selectedNumbers.includes(card.value) }" :target-id="cardTargetId(card)" :disabled="session.status !== 'running' || pendingFeedback || isSelected(card.value)" :dwell-ms="session.settings.dwellMs" :min-height="210" :color="cardColor(card)" @select="choose(card)">
                  <template #default>
                    <div class="number-card-content">
                      <v-icon v-if="selectedNumbers.includes(card.value)" class="number-card-icon" icon="mdi-check-circle" color="success" size="34" />
                      <div class="number-card-value">{{ card.value }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Сортировка чисел" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.number-sorting-shell {
  background: linear-gradient(135deg, #f4fbff 0%, #fff3dc 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 9.25rem;
}

.card-grid {
  row-gap: 1rem;
}

.number-card-col {
  flex-basis: 20%;
  max-inline-size: 20%;
}

.number-card-content {
  align-items: center;
  display: flex;
  justify-content: center;
  min-block-size: 10.5rem;
  position: relative;
}

.number-card-value {
  color: #18324a;
  font-size: clamp(4.8rem, min(10vw, 15vh), 8.8rem);
  font-weight: 900;
  line-height: 0.9;
}

.number-card-icon {
  inset-block-start: 0.1rem;
  inset-inline-end: 0.1rem;
  position: absolute;
}

.number-choice--wrong {
  filter: saturate(0.78) brightness(0.98);
  outline: 0.35rem solid rgb(var(--v-theme-warning) / 48%);
  outline-offset: 0.2rem;
}

.number-choice--selected {
  opacity: 0.82;
}

@media (max-width: 79.9375rem) {
  .number-card-col {
    flex-basis: 33.3333%;
    max-inline-size: 33.3333%;
  }
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 11rem;
  }

  .number-card-col {
    flex-basis: 50%;
    max-inline-size: 50%;
  }

  .number-card-content {
    min-block-size: 8rem;
  }
}

@media (max-height: 43rem) and (min-width: 60rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .number-card-content {
    min-block-size: 7rem;
  }
}

@media (max-height: 42.5rem) {
  .game-container {
    padding-block-start: 4.75rem;
  }

  .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .game-container .text-overline,
  .game-container h1,
  .game-container p {
    display: none;
  }

  .game-container .v-sheet {
    margin-block-end: 0.75rem !important;
    padding: 0.75rem !important;
  }

  .number-card-col {
    flex-basis: 20% !important;
    max-inline-size: 20% !important;
  }

  .card-grid :deep(.dwell-button) {
    min-block-size: 8rem !important;
    padding: 0.5rem !important;
  }

  .number-card-content {
    min-block-size: 6.5rem;
  }

  .number-card-value {
    font-size: 4.2rem;
  }
}
</style>
