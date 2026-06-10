<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameSquareChoiceGrid, { type GameSquareChoice } from "../../components/game/GameSquareChoiceGrid.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { formatClockHour, generateClockRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("clock", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 130
}, { finishOnMistakes: false });

const hint = ref("");
const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateClockRound(session.settings, roundIndex)
});

function choiceTargetId(hour: number) {
  return `clock:choice:${hour}`;
}

function hourAngle(hour: number) {
  return `${(hour % 12) * 30}deg`;
}

function handStyle(hour: number) {
  return { transform: `translateX(-50%) rotate(${hourAngle(hour)})` };
}

function markStyle(mark: number) {
  const angle = (mark * 30 - 90) * Math.PI / 180;
  const radius = 39;
  return {
    insetBlockStart: `${50 + Math.sin(angle) * radius}%`,
    insetInlineStart: `${50 + Math.cos(angle) * radius}%`
  };
}

function choose(hour: number) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(hour);
  const expectedTargetId = choiceTargetId(round.value.targetHour);

  if (hour === round.value.targetHour) {
    hint.value = "";
    recordSuccess({ roundId: round.value.roundId, targetId, expected: round.value.targetHour, actual: hour, isCorrect: true });
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  hint.value = `Мягкая подсказка: короткая стрелка должна смотреть на ${round.value.targetHour}.`;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: round.value.targetHour, actual: hour, isCorrect: false });
  recordHint({ roundId: round.value.roundId, text: hint.value });
}

function answerChoice(choice: GameSquareChoice) {
  choose(Number(choice));
}

function restartGame() {
  hint.value = "";
  restart();
}
</script>

<template>
  <div class="clock-shell">
    <GameHud title="Часы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Полные часы</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert v-if="hint" class="mb-4 text-body-1 font-weight-bold" color="primary" icon="mdi-lightbulb-outline" rounded="xl" variant="tonal">
              {{ hint }}
            </v-alert>
            <GameSquareChoiceGrid :items="round.choices" grid-offset="23rem" compact-size="8.75rem" :target-id="(choice) => choiceTargetId(Number(choice))" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" @select="answerChoice">
              <template #default="{ choice }">
                <div class="clock-choice" :aria-label="formatClockHour(Number(choice))">
                  <div class="clock-face" aria-hidden="true">
                    <div v-for="mark in 12" :key="mark" class="clock-mark" :style="markStyle(mark)">
                      {{ mark }}
                    </div>
                    <div class="clock-hand clock-hand--hour" :style="handStyle(Number(choice))" />
                    <div class="clock-hand clock-hand--minute" />
                    <div class="clock-dot" />
                  </div>
                  <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ formatClockHour(Number(choice)) }}</div>
                </div>
              </template>
            </GameSquareChoiceGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Часы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.clock-shell {
  background: linear-gradient(135deg, #fff7e7 0%, #e7f5ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.clock-choice {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.clock-face {
  aspect-ratio: 1;
  background: radial-gradient(circle at 50% 50%, #ffffff 0 56%, #f0f7ff 57% 100%);
  border: 0.35rem solid rgb(var(--v-theme-primary));
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.35rem rgba(var(--v-theme-primary), 0.12);
  inline-size: min(82%, 8.5rem);
  position: relative;
}

.clock-mark {
  color: rgb(var(--v-theme-primary));
  font-size: clamp(0.8rem, 2.2vw, 1.25rem);
  font-weight: 800;
  position: absolute;
  transform: translate(-50%, -50%);
}

.clock-hand {
  background: rgb(var(--v-theme-on-surface));
  border-radius: 999px;
  inset-block-end: 50%;
  inset-inline-start: 50%;
  position: absolute;
  transform-origin: 50% 100%;
}

.clock-hand--hour {
  block-size: 28%;
  inline-size: 0.5rem;
}

.clock-hand--minute {
  block-size: 38%;
  inline-size: 0.3rem;
  transform: translateX(-50%);
}

.clock-dot {
  background: rgb(var(--v-theme-primary));
  border-radius: 50%;
  block-size: 0.9rem;
  inline-size: 0.9rem;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translate(-50%, -50%);
}

@media (min-width: 68.75rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }
}

@media (max-height: 40rem) {
  .game-container {
    padding-block-start: 9.25rem;
  }

  .clock-face {
    inline-size: min(72%, 7rem);
  }
}
</style>
