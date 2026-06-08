<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
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
const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];

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
      <v-row justify="center">
        <v-col cols="12" md="10" lg="8">
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="expression mb-8">
              {{ round.expression }} = <span class="answer">{{ answer || "?" }}</span>
            </div>
            <v-row>
              <v-col v-for="key in keys" :key="key" cols="4">
                <GameDwellButton :target-id="keyTargetId(key)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="96" @select="pressKey(key)">
                  <template #default>
                    <div class="text-h3 font-weight-bold">{{ key }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
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
  padding-block-start: 132px;
}

.expression {
  font-size: clamp(3rem, 9vw, 6rem);
  font-weight: 900;
  text-align: center;
}

.answer {
  color: #6c5ce7;
}
</style>
