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
import { generateSudoku2x2Round, sudoku2x2Choices, type Sudoku2x2Choice, type Sudoku2x2Value } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("sudoku-2x2", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "sudoku-2x2", soundEnabled, warmAssetIds: ["sudoku-2x2.prompt", "sudoku-2x2.correct", "sudoku-2x2.mistake", "sudoku-2x2.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateSudoku2x2Round(roundIndex)
});

const mistakesInRound = ref(0);
const lastMistakeId = ref<string>();
const isSpeaking = ref(false);
const boardStyle = computed(() => ({
  "--sudoku-size": round.value.size.toString(),
  "--sudoku-cell-vh": round.value.size >= 5 ? "8vh" : round.value.size >= 4 ? "9vh" : round.value.size >= 3 ? "11vh" : "14vh"
}));
const choiceMinHeight = computed(() => round.value.size >= 4 ? "clamp(5.5rem, 13vh, 8.5rem)" : "clamp(7rem, 18vh, 11rem)");

const feedbackText = computed(() => {
  if (mistakesInRound.value === 0) return `Посмотри на строку и столбик. В каждом должны быть числа от 1 до ${round.value.size}.`;
  return "Посмотри на строку и столбик ещё раз и выбери другую карточку.";
});

function choiceTargetId(choiceId: string) {
  return `sudoku-2x2:choice:${choiceId}`;
}

function cellTone(value: Sudoku2x2Value) {
  return `sudoku-cell--${sudoku2x2Choices.find((choice) => choice.value === value)?.tone ?? "sky"}`;
}

async function answer(choice: Sudoku2x2Choice) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.correctChoice.id);
  if (choice.id === round.value.correctChoice.id) {
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      expected: round.value.correctChoice.label,
      actual: choice.label,
      missingCellId: round.value.missingCell.id,
      isCorrect: true
    });
    mistakesInRound.value = 0;
    lastMistakeId.value = undefined;
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["sudoku-2x2.correct", "sudoku-2x2.complete"] : ["sudoku-2x2.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.step < session.maxSteps) nextRound();
    promptAudio.play("sudoku-2x2.prompt", 180);
    isSpeaking.value = false;
    return;
  }

  mistakesInRound.value += 1;
  lastMistakeId.value = choice.id;
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId,
    answerId: choice.id,
    expected: round.value.correctChoice.label,
    actual: choice.label,
    missingCellId: round.value.missingCell.id,
    isCorrect: false
  });
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["sudoku-2x2.mistake"], 80);
  isSpeaking.value = false;
}

function restart() {
  promptAudio.cancelPending();
  mistakesInRound.value = 0;
  lastMistakeId.value = undefined;
  isSpeaking.value = false;
  restartRoundGame();
  promptAudio.play("sudoku-2x2.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("sudoku-2x2.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="sudoku-shell">
    <GameHud title="Судоку" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="8">
          <v-card class="sudoku-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Судоку {{ round.size }}×{{ round.size }}</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-5 text-body-1 text-md-h6 font-weight-bold" :color="mistakesInRound > 0 ? 'secondary' : 'primary'" :icon="mistakesInRound > 0 ? 'mdi-heart-outline' : 'mdi-check'" rounded="xl" variant="tonal">
              {{ feedbackText }}
            </v-alert>

            <div class="sudoku-layout">
              <div class="sudoku-board" :style="boardStyle" :aria-label="`Поле судоку ${round.size} на ${round.size}`">
                <div v-for="cell in round.board" :key="cell.id" :class="['sudoku-cell', cell.hidden ? 'sudoku-cell--missing' : cellTone(cell.value)]">
                  <template v-if="cell.hidden">
                    <v-icon icon="mdi-help" size="54" />
                    <span class="text-h6 font-weight-bold">пусто</span>
                  </template>
                  <template v-else>
                    <span class="sudoku-cell__number">{{ cell.value }}</span>
                    <span class="sudoku-cell__caption text-body-2 font-weight-bold">{{ sudoku2x2Choices.find((choice) => choice.value === cell.value)?.colorName }}</span>
                  </template>
                </div>
              </div>

              <div class="choice-panel">
                <div class="text-h5 text-md-h4 font-weight-bold text-center mb-3">Выбери карточку</div>
                <div class="choice-grid">
                  <GameDwellButton v-for="choice in round.choices" :key="choice.id" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="choiceMinHeight" color="surface" @select="answer(choice)">
                    <template #default>
                      <div :class="['choice-card', `choice-card--${choice.tone}`, { 'choice-card--mistake': choice.id === lastMistakeId }]">
                        <span class="choice-card__number">{{ choice.label }}</span>
                        <span class="choice-card__caption text-body-1 text-md-h6 font-weight-bold">{{ choice.colorName }} карточка</span>
                      </div>
                    </template>
                  </GameDwellButton>
                </div>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Судоку" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.sudoku-shell {
  background: linear-gradient(135deg, #eef8ff 0%, #fff7de 52%, #f4efff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: clamp(5rem, 8vh, 8.75rem);
}

.sudoku-card {
  padding: clamp(0.875rem, 2.4vh, 1.75rem) !important;
}

.sudoku-card > h1 {
  font-size: clamp(1.8rem, 5.6vh, 3.6rem) !important;
  line-height: 1.05;
}

.sudoku-layout {
  align-items: center;
  display: grid;
  gap: clamp(0.75rem, 2vw, 1.25rem);
  grid-template-columns: minmax(17rem, 0.85fr) minmax(18rem, 1fr);
}

.sudoku-board {
  background: rgb(var(--v-theme-surface-variant));
  border: 0.35rem solid rgb(var(--v-theme-primary));
  border-radius: 2rem;
  display: grid;
  gap: clamp(0.25rem, 0.8vh, 0.55rem);
  grid-template-columns: repeat(var(--sudoku-size), minmax(0, var(--sudoku-cell-size)));
  inline-size: max-content;
  justify-content: center;
  margin-inline: auto;
  max-inline-size: 100%;
  padding: clamp(0.45rem, 1.1vh, 0.7rem);
  --sudoku-cell-size: clamp(3.2rem, min(var(--sudoku-cell-vh), calc(40vw / var(--sudoku-size))), 8rem);
}

.sudoku-cell,
.choice-card {
  align-items: center;
  border: 0.25rem solid rgb(255 255 255 / 88%);
  border-radius: 1.5rem;
  color: #1e2d46;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: var(--sudoku-cell-size, clamp(5.5rem, 13vh, 10.5rem));
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.choice-grid {
  display: grid;
  gap: clamp(0.5rem, 1.2vh, 0.75rem);
  grid-template-columns: repeat(auto-fit, minmax(clamp(5.75rem, 13vw, 9rem), 1fr));
}

.choice-card {
  min-block-size: 100%;
}

.sudoku-cell__number,
.choice-card__number {
  font-size: clamp(2.35rem, min(9vw, 11vh), 6.5rem);
  font-weight: 900;
  line-height: 0.95;
}

.sudoku-cell__caption,
.choice-card__caption {
  line-height: 1.1;
  text-align: center;
}

.sudoku-cell__caption {
  display: none;
}

.sudoku-cell--sky,
.choice-card--sky {
  background: linear-gradient(145deg, #e0f4ff, #9edbf7);
}

.sudoku-cell--sun,
.choice-card--sun {
  background: linear-gradient(145deg, #fff1bd, #ffd36f);
}

.sudoku-cell--mint,
.choice-card--mint {
  background: linear-gradient(145deg, #dff8ec, #8fd9b6);
}

.sudoku-cell--rose,
.choice-card--rose {
  background: linear-gradient(145deg, #ffe3ee, #ff9fc1);
}

.sudoku-cell--violet,
.choice-card--violet {
  background: linear-gradient(145deg, #efe4ff, #baa1ff);
}

.sudoku-cell--missing {
  background: repeating-linear-gradient(135deg, #ffffff 0 1.2rem, #eef1f8 1.2rem 2.4rem);
  color: rgb(var(--v-theme-secondary));
}

.choice-card--mistake {
  filter: saturate(0.72) brightness(0.96);
  outline: 0.35rem solid rgb(var(--v-theme-secondary));
}

@media (max-width: 56rem) {
  .sudoku-layout {
    grid-template-columns: 1fr;
  }

  .sudoku-board {
    --sudoku-cell-size: clamp(3.2rem, min(var(--sudoku-cell-vh), calc(78vw / var(--sudoku-size))), 7rem);
  }
}

@media (max-height: 44rem) {
  .sudoku-card > h1 {
    margin-block-end: 0.5rem !important;
  }
}

@media (max-height: 42.5rem) {
  .game-container {
    padding-block-start: 6.5rem;
  }

  .sudoku-card > .text-overline,
  .sudoku-card > .v-alert {
    display: none;
  }

  .sudoku-layout {
    gap: 0.75rem;
  }

  .sudoku-board {
    --sudoku-cell-size: clamp(2.65rem, min(var(--sudoku-cell-vh), calc(40vw / var(--sudoku-size))), 5.4rem);
  }

  .choice-panel .text-h5 {
    display: none;
  }

  .sudoku-cell__number,
  .choice-card__number {
    font-size: clamp(2rem, 7vh, 4rem);
  }
}
</style>
