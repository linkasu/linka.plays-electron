<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { choosePictureFeedback } from "./audio";
import { generateChoosePictureRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("choose-picture", { maxSteps: 8 });

const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateChoosePictureRound(session.settings, roundIndex)
});

function choiceTargetId(choiceId: string) {
  return `choose-picture:choice:${choiceId}`;
}

function choose(choice: (typeof round.value.choices)[number]) {
  if (session.status !== "running") return;
  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: true });
    void choosePictureFeedback.playSuccess(session.settings.sound);
  } else {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: false });
    void choosePictureFeedback.playMistake(session.settings.sound);
  }
  if (session.step < session.maxSteps) nextRound();
}

onMounted(() => {
  choosePictureFeedback.warm(session.settings.sound);
});

watch(() => session.settings.sound, (enabled) => {
  choosePictureFeedback.warm(enabled);
});

onUnmounted(() => {
  choosePictureFeedback.dispose();
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
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Слушаем и выбираем</div>
            <h1 class="text-h3 font-weight-bold text-center mb-8">{{ round.prompt }}</h1>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" min-height="210" :cols="6" :md="6" @select="choose">
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
</style>
