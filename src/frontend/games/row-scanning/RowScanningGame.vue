<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateRowScanningRound, type RowScanningItem } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("row-scanning", {
  maxSteps: 8,
  dwellMs: 1250,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateRowScanningRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);
const helperText = computed(() => {
  if (hintedChoiceId.value) return "Почти. Цель подсвечена мягкой рамкой, попробуй ещё раз.";
  return "Веди взгляд слева направо и остановись на нужной картинке.";
});

function choiceTargetId(choiceId: string) {
  return `row-scanning:choice:${choiceId}`;
}

function isTarget(choice: RowScanningItem) {
  return choice.id === round.value.target.id;
}

function cardColor(choice: RowScanningItem) {
  if (hintedChoiceId.value === choice.id) return "primary";
  if (lastMistakeId.value === choice.id) return "warning";
  return "surface";
}

function answer(index: number) {
  if (session.status !== "running") return;

  const choice = round.value.choices[index];
  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);

  if (index === round.value.correctIndex) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "row-scan-mistake" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="row-scanning-shell">
    <GameHud title="Сканирование ряда" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="11">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Сканируй ряд спокойно</div>
            <div class="target-sample mx-auto mb-3">
              <v-icon class="target-sample-icon" :icon="round.target.icon" :color="round.target.color" />
            </div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ helperText }}</p>

            <div class="row-strip" role="list" aria-label="Ряд объектов для сканирования">
              <GameDwellButton
                v-for="(choice, index) in round.choices"
                :key="choice.id"
                :class="['row-choice', { 'row-choice--hinted': hintedChoiceId === choice.id }]"
                :target-id="choiceTargetId(choice.id)"
                :disabled="session.status !== 'running'"
                :dwell-ms="session.settings.dwellMs"
                :min-height="230"
                :color="cardColor(choice)"
                role="listitem"
                @select="answer(index)"
              >
                <template #default="{ active, progress }">
                  <v-icon :class="['choice-icon', { 'choice-icon--mistake': lastMistakeId === choice.id }]" :icon="choice.icon" :color="choice.color" />
                  <div class="text-h6 text-md-h5 font-weight-bold mt-3">{{ choice.label }}</div>
                  <v-chip v-if="isTarget(choice) && (hintedChoiceId === choice.id || (active && progress > 0.8))" class="mt-3" color="primary" variant="flat" size="large">
                    цель
                  </v-chip>
                </template>
              </GameDwellButton>
            </div>

            <v-expand-transition>
              <v-alert v-if="hintedChoiceId" class="mt-5 text-h6" color="primary" icon="mdi-view-sequential" rounded="xl" variant="tonal">
                Ошибка не завершает игру. Вернись к подсвеченной цели и удержи взгляд.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Сканирование ряда" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.row-scanning-shell {
  background: linear-gradient(135deg, #f3f7ff 0%, #fff7ed 50%, #eefaf4 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.target-sample {
  align-items: center;
  background: rgb(var(--v-theme-primary) / 9%);
  border: 0.25rem solid rgb(var(--v-theme-primary) / 22%);
  border-radius: 1.75rem;
  display: flex;
  inline-size: min(12rem, 42vw);
  justify-content: center;
  min-block-size: min(9.5rem, 20vh);
}

.target-sample-icon {
  font-size: clamp(4.5rem, min(12vw, 16vh), 7rem);
}

.row-strip {
  display: flex;
  gap: 0.875rem;
  justify-content: center;
  overflow-x: auto;
  padding: 0.5rem 0.25rem 1rem;
}

.row-choice {
  flex: 0 0 clamp(10.5rem, 14vw, 14rem);
}

.row-choice--hinted {
  filter: drop-shadow(0 0 1.1rem rgb(var(--v-theme-primary) / 44%));
  transform: scale(1.03);
}

.choice-icon {
  font-size: clamp(4.75rem, min(9vw, 14vh), 7rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-icon--mistake {
  filter: saturate(0.7) opacity(0.74);
  transform: scale(0.95);
}

@media (max-width: 720px) {
  .row-strip {
    justify-content: flex-start;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .target-sample {
    min-block-size: 7rem;
  }
}
</style>
