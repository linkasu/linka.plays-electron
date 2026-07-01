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
import { generatePizzaFractionsRound, type PizzaFractionChoice, type PizzaFractionsRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("pizza-fractions", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 130, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "pizza-fractions",
  soundEnabled,
  warmAssetIds: ["pizza-fractions.prompt.half", "pizza-fractions.prompt.quarter", "pizza-fractions.prompt.whole", "pizza-fractions.correct", "pizza-fractions.mistake", "pizza-fractions.complete"]
});
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const mistakenChoiceId = ref<string>();
const isSpeaking = ref(false);
const { round, resultVisible, nextRound, restart } = useRoundGame<PizzaFractionsRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generatePizzaFractionsRound(session.settings, roundIndex)
});

const feedbackText = computed(() => {
  if (!mistakenChoiceId.value) return "Посмотри на пиццу и выбери нужную долю.";
  return "Посмотри на пиццу ещё раз и выбери другую долю.";
});

const pizzaSlices = [
  { id: "top-left", path: "M50 50 L50 8 A42 42 0 0 0 8 50 Z" },
  { id: "top-right", path: "M50 50 L92 50 A42 42 0 0 0 50 8 Z" },
  { id: "bottom-right", path: "M50 50 L50 92 A42 42 0 0 0 92 50 Z" },
  { id: "bottom-left", path: "M50 50 L8 50 A42 42 0 0 0 50 92 Z" }
] as const;

const filledSliceIds: Record<PizzaFractionChoice["id"], Set<string>> = {
  whole: new Set(pizzaSlices.map((slice) => slice.id)),
  half: new Set(["top-left", "bottom-left"]),
  quarter: new Set(["top-right"])
};

function choiceTargetId(choice: PizzaFractionChoice) {
  return `pizza-fractions:choice:${choice.id}`;
}

function isSliceFilled(choice: PizzaFractionChoice, sliceId: string) {
  return filledSliceIds[choice.id].has(sliceId);
}

function promptAssetId() {
  return `pizza-fractions.prompt.${round.value.targetId}`;
}

async function choose(index: number) {
  if (session.status !== "running" || isSpeaking.value) return;

  const choice = round.value.choices[index];
  const expectedChoice = round.value.choices[round.value.correctIndex];
  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(expectedChoice);

  if (index === round.value.correctIndex) {
    mistakenChoiceId.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.targetId, actual: choice.id, isCorrect: true });
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["pizza-fractions.correct", "pizza-fractions.complete"] : ["pizza-fractions.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.step < session.maxSteps) {
      nextRound();
      await promptAudio.playSequenceAndWait([promptAssetId()], 180);
    }
    isSpeaking.value = false;
    return;
  }

  mistakenChoiceId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, expected: round.value.targetId, actual: choice.id, isCorrect: false });
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["pizza-fractions.mistake"], 80);
  isSpeaking.value = false;
}

function restartGame() {
  promptAudio.cancelPending();
  mistakenChoiceId.value = undefined;
  isSpeaking.value = false;
  restart();
  promptAudio.play(promptAssetId(), 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play(promptAssetId(), 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="pizza-fractions-shell">
    <GameHud title="Доли пиццы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="11">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Половина, четверть и целое</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-5 text-body-1 font-weight-bold" :color="mistakenChoiceId ? 'secondary' : 'primary'" :icon="mistakenChoiceId ? 'mdi-heart-outline' : 'mdi-lightbulb-outline'" rounded="xl" variant="tonal">
              {{ feedbackText }}
            </v-alert>

            <v-row class="choice-row" dense>
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" class="pizza-choice-col" cols="12" md="4">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="270" color="surface" @select="choose(index)">
                  <template #default>
                    <div :class="['pizza-choice', { 'pizza-choice--mistake': mistakenChoiceId === choice.id }]">
                      <svg class="pizza-plate" viewBox="0 0 100 100" role="img" :aria-label="`Пицца: ${choice.label}`">
                        <circle class="pizza-plate__shadow" cx="50" cy="50" r="46" />
                        <circle class="pizza-plate__crust" cx="50" cy="50" r="44" />
                        <g class="pizza-plate__slices">
                          <path v-for="slice in pizzaSlices" :key="slice.id" :class="['pizza-plate__slice', { 'pizza-plate__slice--filled': isSliceFilled(choice, slice.id) }]" :d="slice.path" />
                        </g>
                        <path class="pizza-plate__cut" d="M50 8 V92" />
                        <path class="pizza-plate__cut" d="M8 50 H92" />
                        <circle class="pizza-plate__center" cx="50" cy="50" r="3.2" />
                        <circle v-if="choice.id !== 'whole'" class="pizza-plate__focus" cx="50" cy="50" r="42" />
                      </svg>
                      <div class="pizza-choice__label text-h4 text-md-h3 font-weight-bold mt-4">{{ choice.label }}</div>
                      <v-chip class="pizza-choice__chip mt-2" color="deep-purple-darken-3" size="large" variant="flat">{{ choice.shortLabel }}</v-chip>
                      <div class="pizza-choice__helper text-body-1 text-medium-emphasis mt-3">{{ choice.helperText }}</div>
                      <div class="sr-only">Доля: {{ choice.label }}.</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Доли пиццы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.pizza-fractions-shell {
  background: linear-gradient(135deg, #fff4df 0%, #fffaf1 48%, #e5f6ee 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.choice-row {
  row-gap: 1rem;
}

.pizza-choice {
  align-items: center;
  block-size: 100%;
  color: #17212b;
  border: 0.25rem solid transparent;
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 14.5rem;
  padding: 0.75rem;
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.pizza-choice__label,
.pizza-choice__helper,
.pizza-choice__chip {
  color: #0b1117 !important;
}

.pizza-choice__chip {
  color: #ffffff !important;
}

.pizza-choice--mistake {
  filter: saturate(0.72) brightness(0.98);
  outline: 0.35rem solid rgb(var(--v-theme-warning) / 44%);
}

.choice-row :deep(.dwell-button--active) {
  background: #315f57 !important;
}

.choice-row :deep(.dwell-button--active) .pizza-choice__label,
.choice-row :deep(.dwell-button--active) .pizza-choice__helper {
  color: #ffffff !important;
}

.pizza-plate {
  display: block;
  filter: drop-shadow(0 0.55rem 0.9rem rgb(91 57 11 / 14%));
  inline-size: clamp(8.5rem, min(18vw, 23vh), 13.5rem);
  block-size: clamp(8.5rem, min(18vw, 23vh), 13.5rem);
}

.pizza-plate__shadow {
  fill: #fffdf7;
}

.pizza-plate__crust {
  fill: #d88939;
}

.pizza-plate__slice {
  fill: #fff6db;
  stroke: #9f6524;
  stroke-linejoin: round;
  stroke-width: 1.4;
}

.pizza-plate__slice--filled {
  fill: #f5bf52;
}

.pizza-plate__cut {
  fill: none;
  stroke: #7b4b1c;
  stroke-linecap: round;
  stroke-width: 2.4;
}

.pizza-plate__center {
  fill: #7b4b1c;
}

.pizza-plate__focus {
  fill: none;
  stroke: rgb(var(--v-theme-secondary));
  stroke-dasharray: 4 4;
  stroke-width: 2.4;
}

.sr-only {
  block-size: 1px;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 10.5rem;
  }
}

@media (max-height: 43rem) and (min-width: 60rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .pizza-plate {
    inline-size: 8rem;
    min-block-size: 8rem;
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
  .game-container .v-alert {
    display: none;
  }

  .pizza-choice-col {
    flex: 0 0 33.3333% !important;
    max-inline-size: 33.3333% !important;
  }

  .choice-row :deep(.dwell-button) {
    min-block-size: 15rem !important;
    padding: 0.5rem !important;
  }

  .pizza-choice {
    min-block-size: 11rem;
    padding: 0.35rem;
  }

  .pizza-plate {
    inline-size: 6.4rem;
    min-block-size: 6.4rem;
  }

  .pizza-choice__label {
    font-size: 1.75rem !important;
    margin-block-start: 0.5rem !important;
  }

  .pizza-choice__helper {
    display: none;
  }
}
</style>
