<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateSudoku2x2Round, sudoku2x2Choices, type Sudoku2x2Choice, type Sudoku2x2Value } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("sudoku-2x2", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 130
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateSudoku2x2Round(roundIndex)
});

const mistakesInRound = ref(0);
const lastMistakeId = ref<string>();

const feedbackText = computed(() => {
  if (mistakesInRound.value === 0) return "Посмотри на строку и столбик. В каждом месте должны быть 1 и 2.";
  return `Почти. В пустой клетке нужна ${round.value.correctChoice.colorName} карточка ${round.value.correctChoice.label}.`;
});

function choiceTargetId(choiceId: string) {
  return `sudoku-2x2:choice:${choiceId}`;
}

function cellTone(value: Sudoku2x2Value) {
  return `sudoku-cell--${sudoku2x2Choices.find((choice) => choice.value === value)?.tone ?? "sky"}`;
}

function answer(choice: Sudoku2x2Choice) {
  if (session.status !== "running") return;

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
    if (session.step < session.maxSteps) nextRound();
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
}

function restart() {
  mistakesInRound.value = 0;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="sudoku-shell">
    <GameHud title="Судоку 2x2" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="8">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Маленькое судоку</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-5 text-body-1 text-md-h6 font-weight-bold" :color="mistakesInRound > 0 ? 'secondary' : 'primary'" :icon="mistakesInRound > 0 ? 'mdi-heart-outline' : 'mdi-check'" rounded="xl" variant="tonal">
              {{ feedbackText }}
            </v-alert>

            <div class="sudoku-layout">
              <div class="sudoku-board" aria-label="Поле судоку 2 на 2">
                <div v-for="cell in round.board" :key="cell.id" :class="['sudoku-cell', cell.hidden ? 'sudoku-cell--missing' : cellTone(cell.value), { 'sudoku-cell--hinted': cell.hidden && mistakesInRound > 0 }]">
                  <template v-if="cell.hidden">
                    <v-icon icon="mdi-help" size="54" />
                    <span class="text-h6 font-weight-bold">пусто</span>
                  </template>
                  <template v-else>
                    <span class="sudoku-cell__number">{{ cell.value }}</span>
                    <span class="text-body-1 font-weight-bold">{{ cell.value === 1 ? 'синяя' : 'жёлтая' }}</span>
                  </template>
                </div>
              </div>

              <div class="choice-panel">
                <div class="text-h5 text-md-h4 font-weight-bold text-center mb-3">Выбери карточку</div>
                <v-row dense>
                  <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6">
                    <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="190" color="surface" @select="answer(choice)">
                      <template #default>
                        <div :class="['choice-card', `choice-card--${choice.tone}`, { 'choice-card--hinted': mistakesInRound > 0 && choice.id === round.correctChoice.id, 'choice-card--mistake': choice.id === lastMistakeId }]">
                          <span class="choice-card__number">{{ choice.label }}</span>
                          <span class="text-h6 font-weight-bold">{{ choice.colorName }} карточка</span>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Судоку 2x2" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.sudoku-shell {
  background: linear-gradient(135deg, #eef8ff 0%, #fff7de 52%, #f4efff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.sudoku-layout {
  align-items: stretch;
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(18rem, 0.92fr) minmax(18rem, 1fr);
}

.sudoku-board {
  background: rgb(var(--v-theme-surface-variant));
  border: 0.35rem solid rgb(var(--v-theme-primary));
  border-radius: 2rem;
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 0.7rem;
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
  min-block-size: 10.5rem;
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.sudoku-cell__number,
.choice-card__number {
  font-size: clamp(4.5rem, min(13vw, 16vh), 8rem);
  font-weight: 900;
  line-height: 0.95;
}

.sudoku-cell--sky,
.choice-card--sky {
  background: linear-gradient(145deg, #e0f4ff, #9edbf7);
}

.sudoku-cell--sun,
.choice-card--sun {
  background: linear-gradient(145deg, #fff1bd, #ffd36f);
}

.sudoku-cell--missing {
  background: repeating-linear-gradient(135deg, #ffffff 0 1.2rem, #eef1f8 1.2rem 2.4rem);
  color: rgb(var(--v-theme-secondary));
}

.sudoku-cell--hinted,
.choice-card--hinted {
  outline: 0.42rem solid rgb(var(--v-theme-primary));
  transform: scale(1.02);
}

.choice-card--mistake {
  filter: saturate(0.72) brightness(0.96);
  outline: 0.35rem solid rgb(var(--v-theme-secondary));
}

@media (max-width: 56rem) {
  .sudoku-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.75rem;
  }

  .sudoku-cell,
  .choice-card {
    min-block-size: 8.75rem;
  }
}
</style>
