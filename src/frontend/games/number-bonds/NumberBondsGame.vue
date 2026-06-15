<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateNumberBondsRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("number-bonds", {
  maxSteps: 8,
  overrides: { sound: false },
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateNumberBondsRound(session.settings, roundIndex)
});

const hint = ref("Выбери недостающую часть.");
const lastMistakeTargetId = ref<string>();
const knownDots = computed(() => Array.from({ length: round.value.knownPart }, (_, index) => index));
const missingDots = computed(() => Array.from({ length: round.value.missingPart }, (_, index) => index));

function choiceTargetId(choice: number) {
  return `number-bonds:choice:${choice}`;
}

function answer(choice: number) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.missingPart);
  if (choice === round.value.missingPart) {
    lastMistakeTargetId.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, total: round.value.total, knownPart: round.value.knownPart, expected: round.value.missingPart, actual: choice, isCorrect: true });
    if (session.step < session.maxSteps) {
      hint.value = "Выбери недостающую часть.";
      nextRound();
    } else {
      hint.value = "Верно. Части вместе дают нужное число.";
    }
    return;
  }

  hint.value = `${round.value.knownPart} и ${choice} вместе дают ${round.value.knownPart + choice}. Нужно ${round.value.total}. Попробуй ещё.`;
  lastMistakeTargetId.value = targetId;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, total: round.value.total, knownPart: round.value.knownPart, expected: round.value.missingPart, actual: choice, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId, text: hint.value });
}

function restartGame() {
  hint.value = "Выбери недостающую часть.";
  lastMistakeTargetId.value = undefined;
  restart();
}
</script>

<template>
  <div class="number-bonds-shell">
    <GameHud title="Состав числа" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="number-bonds-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Составь число до {{ session.settings.preset === "gentle" ? 5 : 10 }}</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-4">{{ round.prompt }}</h1>

            <v-sheet class="bond-panel pa-4 pa-md-5 mb-4" color="primary" rounded="xl">
              <div class="bond-equation text-white" aria-label="Пример состава числа">
                <span>{{ round.knownPart }}</span>
                <span>+</span>
                <span>?</span>
                <span>=</span>
                <span>{{ round.total }}</span>
              </div>
              <div class="part-row mt-4" aria-hidden="true">
                <div class="part-card part-card--known">
                  <div class="text-overline">Уже есть</div>
                  <div class="dot-row">
                    <span v-for="dot in knownDots" :key="`known-${dot}`" class="bond-dot" />
                  </div>
                </div>
                <v-icon class="text-white" icon="mdi-plus" size="42" />
                <div class="part-card part-card--missing">
                  <div class="text-overline">Добавить</div>
                  <div class="dot-row">
                    <span v-for="dot in missingDots" :key="`missing-${dot}`" class="bond-dot bond-dot--ghost" />
                  </div>
                </div>
              </div>
            </v-sheet>

            <v-alert class="mb-4 text-body-1 font-weight-bold" :color="lastMistakeTargetId ? 'secondary' : 'primary'" :icon="lastMistakeTargetId ? 'mdi-heart-outline' : 'mdi-lightbulb-outline'" rounded="xl" variant="tonal">
              {{ hint }}
            </v-alert>

            <v-row class="choice-row" dense>
              <v-col v-for="choice in round.choices" :key="choice" cols="12" sm="6" md="3">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="190" color="surface" @select="answer(choice)">
                  <template #default>
                    <div :class="['choice-card', { 'choice-card--mistake': lastMistakeTargetId === choiceTargetId(choice) }]">
                      <div class="choice-card__number">{{ choice }}</div>
                      <div class="choice-card__caption text-body-1">часть</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Состав числа" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.number-bonds-shell {
  background: linear-gradient(135deg, #eef8ff 0%, #fff3dc 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.bond-panel {
  box-shadow: inset 0 -0.5rem 2rem rgb(255 255 255 / 18%);
}

.bond-equation {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  font-size: clamp(3.25rem, min(10vw, 12vh), 6.75rem);
  font-weight: 900;
  gap: 0.4em;
  justify-content: center;
  line-height: 1;
}

.part-row {
  align-items: stretch;
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.part-card {
  background: rgb(255 255 255 / 22%);
  border: 0.15rem solid rgb(255 255 255 / 42%);
  border-radius: 1.25rem;
  color: white;
  inline-size: min(22rem, 42%);
  padding: 1rem;
}

.dot-row {
  align-content: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  min-block-size: 4.5rem;
}

.bond-dot {
  background: #fff6be;
  border-radius: 999px;
  box-shadow: inset -0.2rem -0.25rem 0 rgb(107 75 0 / 16%);
  inline-size: 2rem;
  min-block-size: 2rem;
}

.bond-dot--ghost {
  background: transparent;
  border: 0.18rem dashed rgb(255 255 255 / 78%);
  box-shadow: none;
}

.choice-row {
  row-gap: 0.75rem;
}

.choice-card {
  align-items: center;
  block-size: 100%;
  border: 0.2rem solid rgb(255 255 255 / 85%);
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 8.75rem;
  transition: outline 160ms ease, transform 160ms ease;
}

.choice-card__number {
  color: #17212b;
  font-size: clamp(4rem, min(11vw, 13vh), 6.5rem);
  font-weight: 900;
  line-height: 0.95;
}

.choice-card__caption {
  color: #17212b !important;
}

.choice-card--mistake {
  outline: 0.35rem solid rgb(var(--v-theme-secondary));
  transform: scale(0.98);
}

@media (min-width: 68.75rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }
}

@media (max-width: 37.5rem) {
  .part-row {
    align-items: center;
    flex-direction: column;
  }

  .part-card {
    inline-size: 100%;
  }
}

@media (max-height: 40rem) {
  .game-container {
    padding-block-start: 9.25rem;
  }

  .bond-equation {
    font-size: clamp(2.75rem, min(9vw, 10vh), 5.25rem);
  }
}

@media (max-height: 680px) {
  .game-container {
    padding-block-start: 104px;
  }

  .number-bonds-card {
    display: flex;
    flex-direction: column;
    padding: 1rem !important;
  }

  .number-bonds-card > .text-overline,
  .number-bonds-card > .v-alert {
    display: none;
  }

  .choice-row {
    order: 1;
  }

  .bond-panel {
    margin-block-end: 0.75rem !important;
    order: 2;
    padding: 0.75rem !important;
  }

  .bond-equation {
    font-size: clamp(2.5rem, min(8vw, 9vh), 4.5rem);
  }

  .part-row {
    display: none;
  }
}
</style>
