<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateYesNoRound, type YesNoAnswer, type YesNoRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, finishSession, startSession } = useGameSessionFor("yes-no", { maxSteps: 8, finishOnMaxSteps: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<YesNoRound>({
  session,
  startSession,
  generateRound: generateYesNoRound
});

const feedback = ref("Выбери ответ взглядом.");
const isChangingRound = ref(false);

function answerTargetId(value: YesNoAnswer) {
  return `yes-no:answer:${value}`;
}

function expectedLabel(value: YesNoAnswer) {
  return value === "yes" ? "Да" : "Нет";
}

function completeRound(wasCorrect: boolean) {
  if (!wasCorrect) session.step += 1;
  if (session.status !== "running") return;
  if (session.step >= session.maxSteps) finishSession("max-steps");
  else nextRound();
}

function answer(value: YesNoAnswer) {
  if (session.status !== "running" || isChangingRound.value) return;

  const targetId = answerTargetId(value);
  const expectedTargetId = answerTargetId(round.value.answer);
  isChangingRound.value = true;

  const wasCorrect = value === round.value.answer;
  if (wasCorrect) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: value, expected: round.value.answer, actual: value, isCorrect: true });
    feedback.value = "Да, так и есть.";
  } else {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: value, expected: round.value.answer, actual: value, isCorrect: false });
    recordHint({ roundId: round.value.roundId, text: `Можно ответить: ${expectedLabel(round.value.answer)}.` });
    feedback.value = `Ничего страшного. Здесь подходит: ${expectedLabel(round.value.answer)}.`;
  }

  window.setTimeout(() => {
    completeRound(wasCorrect);
    feedback.value = session.status === "finished" ? "Спасибо за ответы." : "Следующий вопрос.";
    isChangingRound.value = false;
  }, 900);
}

function restart() {
  feedback.value = "Выбери ответ взглядом.";
  isChangingRound.value = false;
  restartRoundGame();
}
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #eef7ff 0%, #fff4e9 100%)" padding-top="8.25rem">
    <template #hud>
      <GameHud title="Да / нет" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Отвечаем спокойно</div>
            <div class="item-display mb-6">
              <div class="item-emoji emoji-glyph">{{ round.item.emoji }}</div>
              <h1 class="text-h3 font-weight-bold mb-2">{{ round.prompt }}</h1>
              <div class="text-h6 text-medium-emphasis">{{ feedback }}</div>
            </div>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => answerTargetId(choice.id)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="220" :cols="12" :md="6" @select="(choice) => answer(choice.id)">
              <template #default="{ choice }">
                <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                <div class="text-h3 font-weight-bold">{{ choice.title }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Да / нет" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.item-display {
  text-align: center;
}

.item-emoji,
.choice-emoji {
  font-size: clamp(4.5rem, 11vw, 8rem);
  line-height: 1;
}
</style>
