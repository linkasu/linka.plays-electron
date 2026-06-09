<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameSquareChoiceGrid, { type GameSquareChoice } from "../../components/game/GameSquareChoiceGrid.vue";
import { useGameSession } from "../../core/session";
import { generateMathRound, type MathRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("math-actions", {
  maxSteps: 8,
  dwellMs: 1000,
  sessionSeconds: 120
});

let roundIndex = 1;
const round = ref<MathRound>(generateMathRound(session.settings, roundIndex));
const answer = ref("");
const resultVisible = computed(() => session.status === "finished");
const keys = ["1", "2", "3", "⌫", "4", "5", "6", "0", "7", "8", "9", "✓"];

function keyTargetId(key: string) {
  if (key === "⌫") return "math-actions:key:backspace";
  if (key === "✓") return "math-actions:key:confirm";
  return `math-actions:key:${key}`;
}

function nextRound() {
  roundIndex += 1;
  round.value = generateMathRound(session.settings, roundIndex);
  answer.value = "";
}

function pressKey(key: string) {
  if (session.status !== "running") return;
  if (key === "⌫") {
    answer.value = answer.value.slice(0, -1);
    return;
  }
  if (key === "✓") {
    if (!answer.value) return;
    const targetId = keyTargetId(key);
    if (answer.value === round.value.answerText) recordSuccess({ roundId: round.value.roundId, targetId, expression: round.value.expression, expected: round.value.answerText, actual: answer.value, isCorrect: true });
    else recordMistake({ roundId: round.value.roundId, targetId, expression: round.value.expression, expected: round.value.answerText, actual: answer.value, isCorrect: false });
    if (session.step < session.maxSteps) nextRound();
    return;
  }
  if (answer.value.length < 3) answer.value += key;
}

function selectKey(choice: GameSquareChoice) {
  pressKey(String(choice));
}

function restart() {
  startSession();
  roundIndex = 1;
  round.value = generateMathRound(session.settings, roundIndex);
  answer.value = "";
}
</script>

<template>
  <div class="math-shell">
    <GameHud title="Математика" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="math-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="expression mb-3">
              {{ round.expression }} = <span class="answer">{{ answer || "?" }}</span>
            </div>
            <GameSquareChoiceGrid :items="keys" :columns="4" grid-offset="16.5rem" min-size="6rem" max-size="11rem" compact-size="6.5rem" width-factor="13vw" :target-id="(choice) => keyTargetId(String(choice))" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" @select="selectKey">
              <template #default="{ choice }">
                <div class="text-h3 font-weight-bold">{{ choice }}</div>
              </template>
            </GameSquareChoiceGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Математика" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.math-shell {
  background: linear-gradient(135deg, #eaf7ff 0%, #fff8dc 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.expression {
  font-size: clamp(2.6rem, min(8vw, 10vh), 5.25rem);
  font-weight: 900;
  line-height: 1.05;
  text-align: center;
}

.answer {
  color: #6c5ce7;
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
}
</style>
