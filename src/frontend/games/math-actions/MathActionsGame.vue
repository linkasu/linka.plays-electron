<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameSquareChoiceGrid, { type GameSquareChoice } from "../../components/game/GameSquareChoiceGrid.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateMathRound, type MathRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("math-actions", {
  maxSteps: 8,
  overrides: { dwellMs: 1000, sessionSeconds: 120, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "math-actions", soundEnabled, warmAssetIds: ["math-actions.prompt", "math-actions.correct", "math-actions.mistake", "math-actions.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

let roundIndex = 1;
const round = ref<MathRound>(generateMathRound(session.settings, roundIndex));
const answer = ref("");
const feedback = ref("Введи ответ и нажми галочку.");
const isSpeaking = ref(false);
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

async function pressKey(key: string) {
  if (session.status !== "running" || isSpeaking.value) return;
  if (key === "⌫") {
    answer.value = answer.value.slice(0, -1);
    return;
  }
  if (key === "✓") {
    if (!answer.value) return;
    const targetId = keyTargetId(key);
    if (answer.value === round.value.answerText) {
      recordSuccess({ roundId: round.value.roundId, targetId, expression: round.value.expression, expected: round.value.answerText, actual: answer.value, isCorrect: true });
      feedback.value = "Верно.";
      isSpeaking.value = true;
      void feedbackAudio.playSuccess();
      const finishedAfterSuccess = session.step >= session.maxSteps;
      await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["math-actions.correct", "math-actions.complete"] : ["math-actions.correct"], 80, 170);
      if (finishedAfterSuccess) {
        finishSession("game-complete");
        isSpeaking.value = false;
        return;
      }
      if (session.step < session.maxSteps) nextRound();
      feedback.value = "Введи ответ и нажми галочку.";
      promptAudio.play("math-actions.prompt", 180);
      isSpeaking.value = false;
      return;
    }
    recordMistake({ roundId: round.value.roundId, targetId, expression: round.value.expression, expected: round.value.answerText, actual: answer.value, isCorrect: false });
    answer.value = "";
    feedback.value = "Попробуй ещё раз и введи другой ответ.";
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(["math-actions.mistake"], 80);
    isSpeaking.value = false;
    return;
  }
  if (answer.value.length < 3) answer.value += key;
}

function selectKey(choice: GameSquareChoice) {
  void pressKey(String(choice));
}

function restart() {
  promptAudio.cancelPending();
  startSession();
  roundIndex = 1;
  round.value = generateMathRound(session.settings, roundIndex);
  answer.value = "";
  feedback.value = "Введи ответ и нажми галочку.";
  isSpeaking.value = false;
  promptAudio.play("math-actions.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("math-actions.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
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
            <v-alert class="mb-4 text-body-1 font-weight-bold" color="primary" icon="mdi-lightbulb-outline" rounded="xl" variant="tonal">
              {{ feedback }}
            </v-alert>
            <GameSquareChoiceGrid :items="keys" :columns="4" grid-offset="14.5rem" min-size="5.5rem" max-size="10.5rem" compact-size="5rem" width-factor="12vw" :target-id="(choice) => keyTargetId(String(choice))" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" @select="selectKey">
              <template #default="{ choice }">
                <div class="text-h3 font-weight-bold">{{ choice }}</div>
              </template>
            </GameSquareChoiceGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Математика" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
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
    padding-block-start: 5rem;
  }

 .math-card {
    padding: 1rem !important;
  }

 .math-card .v-alert {
    display: none;
  }

 .expression {
    font-size: 3rem;
    margin-block-end: 0.75rem !important;
  }
}
</style>
