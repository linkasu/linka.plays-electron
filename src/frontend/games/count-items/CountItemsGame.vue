<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameSquareChoiceGrid, { type GameSquareChoice } from "../../components/game/GameSquareChoiceGrid.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateCountItemsRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("count-items", {
  maxSteps: 8,
  overrides: { dwellMs: 1100, sessionSeconds: 120, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "count-items", soundEnabled, warmAssetIds: ["count-items.prompt", "count-items.correct", "count-items.mistake", "count-items.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);
const feedback = ref("Посчитай предметы и выбери число.");
const isSpeaking = ref(false);

const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateCountItemsRound(session.settings, roundIndex)
});

function choiceTargetId(choice: number) {
  return `count-items:choice:${choice}`;
}

async function answer(index: number) {
  if (session.status !== "running" || isSpeaking.value) return;
  const actual = round.value.choices[index];
  const targetId = choiceTargetId(actual);
  const expectedTargetId = choiceTargetId(round.value.targetCount);
  if (index === round.value.correctIndex) {
    isSpeaking.value = true;
    feedback.value = "Верно.";
    recordSuccess({ roundId: round.value.roundId, targetId, actual, isCorrect: true });
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["count-items.correct", "count-items.complete"] : ["count-items.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    nextRound();
    feedback.value = "Посчитай предметы и выбери число.";
    promptAudio.play("count-items.prompt", 180);
    isSpeaking.value = false;
    return;
  }
  isSpeaking.value = true;
  feedback.value = "Посчитай предметы ещё раз и выбери другое число.";
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: round.value.targetCount, actual, isCorrect: false });
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["count-items.mistake"], 80);
  isSpeaking.value = false;
}

function answerChoice(choice: GameSquareChoice) {
  const index = round.value.choices.indexOf(Number(choice));
  if (index >= 0) void answer(index);
}

function restartGame() {
  promptAudio.cancelPending();
  feedback.value = "Посчитай предметы и выбери число.";
  isSpeaking.value = false;
  restart();
  promptAudio.play("count-items.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("count-items.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});

</script>

<template>
  <div class="count-shell">
    <GameHud title="Счёт" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="count-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="count-prompt mb-3 mb-md-5">
              <h1 class="text-h4 text-md-h3 font-weight-bold">Сколько предметов?</h1>
              <p class="text-h6 text-medium-emphasis mb-0">{{ feedback }}</p>
            </div>
            <div class="items-grid mb-3 mb-md-5">
              <span v-for="index in round.targetCount" :key="index" class="item-emoji emoji-glyph">{{ round.itemEmoji }}</span>
            </div>
            <GameSquareChoiceGrid :items="round.choices" grid-offset="21rem" compact-size="7.75rem" :target-id="(choice) => choiceTargetId(Number(choice))" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" @select="answerChoice">
              <template #default="{ choice }">
                <div class="text-h2 font-weight-bold">{{ choice }}</div>
              </template>
            </GameSquareChoiceGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Счёт" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.count-shell {
  background: linear-gradient(135deg, #fff5dc 0%, #e4f5ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.count-prompt {
  text-align: center;
}

.items-grid {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  justify-content: center;
}

.item-emoji {
  font-size: clamp(2.6rem, min(6vw, 8vh), 4.8rem);
  line-height: 1;
}

@media (min-width: 68.75rem) {
 .game-container {
    padding-block-start: 7.25rem;
  }
}

@media (max-height: 40rem) {
 .game-container {
    padding-block-start: 7.25rem;
  }

 .count-card {
    padding: 1rem !important;
  }

 .count-prompt,
 .items-grid {
    margin-block-end: 0.75rem !important;
  }

 .item-emoji {
    font-size: clamp(2.1rem, min(5vw, 7vh), 3.6rem);
  }
}
</style>
