<script setup lang="ts">
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameSquareChoiceGrid, { type GameSquareChoice } from "../../components/game/GameSquareChoiceGrid.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { useGameSession } from "../../core/session";
import { generateCountItemsRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("count-items", {
  maxSteps: 8,
  dwellMs: 1100,
  sessionSeconds: 120
});

const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateCountItemsRound(session.settings, roundIndex)
});

function choiceTargetId(choice: number) {
  return `count-items:choice:${choice}`;
}

function answer(index: number) {
  if (session.status !== "running") return;
  const actual = round.value.choices[index];
  const targetId = choiceTargetId(actual);
  const expectedTargetId = choiceTargetId(round.value.targetCount);
  if (index === round.value.correctIndex) recordSuccess({ roundId: round.value.roundId, targetId, actual, isCorrect: true });
  else recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: round.value.targetCount, actual, isCorrect: false });
  if (session.step < session.maxSteps) nextRound();
}

function answerChoice(choice: GameSquareChoice) {
  const index = round.value.choices.indexOf(Number(choice));
  if (index >= 0) answer(index);
}

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
            </div>
            <div class="items-grid mb-3 mb-md-5">
              <span v-for="index in round.targetCount" :key="index" class="item-emoji emoji-glyph">{{ round.itemEmoji }}</span>
            </div>
            <GameSquareChoiceGrid :items="round.choices" grid-offset="21rem" compact-size="9.25rem" :target-id="(choice) => choiceTargetId(Number(choice))" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" @select="answerChoice">
              <template #default="{ choice }">
                <div class="text-h2 font-weight-bold">{{ choice }}</div>
              </template>
            </GameSquareChoiceGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Счёт" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
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
    padding-block-start: 9.25rem;
  }
}
</style>
