<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { useGameSession } from "../../core/session";
import { disposeEatOrNotEatAudio, playEatOrNotEatMistakeMelody, warmEatOrNotEatAudio } from "./audio";
import { generateEatOrNotEatRound, type EatOrNotEatAnswer, type EatOrNotEatRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("eat-or-not-eat", {
  maxSteps: 8,
  dwellMs: 1200,
  sessionSeconds: 120
});

const { round, resultVisible, nextRound, restart } = useRoundGame<EatOrNotEatRound>({
  session,
  startSession,
  generateRound: generateEatOrNotEatRound
});

const answers: Array<{ id: EatOrNotEatAnswer; title: string; emoji: string }> = [
  { id: "food", title: "Можно есть", emoji: "🍽️" },
  { id: "thing", title: "Нельзя есть", emoji: "📦" }
];

function answerTargetId(value: EatOrNotEatAnswer) {
  return `eat-or-not-eat:answer:${value}`;
}

function answer(value: EatOrNotEatAnswer) {
  if (session.status !== "running") return;
  const targetId = answerTargetId(value);
  const expectedTargetId = answerTargetId(round.value.correctAnswer);
  if (value === round.value.correctAnswer) recordSuccess({ roundId: round.value.roundId, targetId, itemId: round.value.item.id, expected: round.value.correctAnswer, actual: value, isCorrect: true });
  else {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, itemId: round.value.item.id, expected: round.value.correctAnswer, actual: value, isCorrect: false });
    void playEatOrNotEatMistakeMelody(session.settings.sound);
  }
  if (session.step < session.maxSteps) nextRound();
}

onMounted(() => {
  warmEatOrNotEatAudio(session.settings.sound);
});

onUnmounted(() => {
  disposeEatOrNotEatAudio();
});

</script>

<template>
  <div class="eat-shell">
    <GameHud title="Съедобное" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Куда положим?</div>
            <div class="item-display mb-8">
              <div class="item-emoji emoji-glyph">{{ round.item.emoji }}</div>
              <h1 class="text-h3 font-weight-bold">{{ round.item.word }}</h1>
            </div>
            <v-row>
              <v-col v-for="option in answers" :key="option.id" cols="12" md="6">
                <GameDwellButton :target-id="answerTargetId(option.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="210" @select="answer(option.id)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ option.emoji }}</div>
                    <div class="text-h4 font-weight-bold">{{ option.title }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Съедобное" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.eat-shell {
  background: linear-gradient(135deg, #fff3df 0%, #ecfff5 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.item-display {
  text-align: center;
}

.item-emoji,
.choice-emoji {
  font-size: clamp(4rem, 10vw, 7rem);
  line-height: 1;
}
</style>
