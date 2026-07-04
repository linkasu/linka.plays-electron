<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateChoosePictureRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("choose-picture", { maxSteps: 8, finishOnMaxSteps: false, finishOnMistakes: false });
const soundEnabled = toRef(session.settings, "sound");
const feedback = useStandardGameFeedback(soundEnabled);
const promptAudio = useGamePromptAudio({ gameId: "choose-picture", soundEnabled, warmAssetIds: ["choose-picture.intro", "choose-picture.correct", "choose-picture.mistake", "choose-picture.complete"] });
const feedbackText = ref("Посмотри на слово и выбери картинку.");
const isSpeaking = ref(false);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateChoosePictureRound(session.settings, roundIndex)
});

function choiceTargetId(choiceId: string) {
  return `choose-picture:choice:${choiceId}`;
}

async function choose(choice: (typeof round.value.choices)[number]) {
  if (session.status !== "running" || isSpeaking.value) return;
  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: true });
    void feedback.playSuccess();
    feedbackText.value = "Верно. Это нужная картинка.";
    isSpeaking.value = true;
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["choose-picture.correct", "choose-picture.complete"] : ["choose-picture.correct"], 80, 170);
    isSpeaking.value = false;
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      return;
    }
    nextRound();
    feedbackText.value = "Посмотри на слово и выбери картинку.";
    promptAudio.play("choose-picture.intro", 180);
  } else {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: false });
    void feedback.playMistake();
    feedbackText.value = "Посмотри на слово ещё раз и выбери другую картинку.";
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(["choose-picture.mistake"], 80);
    isSpeaking.value = false;
  }
}

function restart() {
  feedbackText.value = "Посмотри на слово и выбери картинку.";
  isSpeaking.value = false;
  promptAudio.cancelPending();
  restartRoundGame();
  promptAudio.play("choose-picture.intro", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("choose-picture.intro", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #f3ecff 0%, #e4fbff 100%)" padding-top="8.25rem">
    <template #hud>
      <GameHud title="Выбери картинку" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="choose-picture-card pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Слушаем и выбираем</div>
            <h1 class="text-h3 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-medium-emphasis text-center mb-6">{{ feedbackText }}</p>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="13.125rem" :cols="6" :md="6" @select="choose">
              <template #default="{ choice }">
                <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                <div class="text-h5 font-weight-bold mt-2">{{ choice.word }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Выбери картинку" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.choice-emoji {
  font-size: clamp(4rem, 9vw, 7rem);
  line-height: 1;
}

@media (max-height: 42rem) {
 .choose-picture-card {
    padding: 1rem !important;
  }

 .choose-picture-card >.text-overline {
    display: none;
  }

 .choose-picture-card h1 {
    font-size: clamp(2rem, 6vh, 2.45rem) !important;
    line-height: 1.05;
  }

 .choose-picture-card p {
    font-size: 1rem !important;
    margin-block-end: 0.85rem !important;
  }

 .choice-emoji {
    font-size: clamp(2.9rem, 9vh, 4rem);
  }

 .game-container :deep(.game-choice-grid) {
    row-gap: 0.35rem;
  }

 .game-container :deep(.dwell-button) {
    min-block-size: 8rem !important;
  }

 .game-container :deep(.dwell-button .text-h5) {
    font-size: clamp(1.35rem, 4.5vh, 1.8rem) !important;
  }
}
</style>
