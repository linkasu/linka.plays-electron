<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSession } from "../../core/session";
import { generateEatOrNotEatRound, type EatOrNotEatAnswer, type EatOrNotEatRound } from "./model";

const router = useRouter();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("eat-or-not-eat", {
  maxSteps: 8,
  dwellMs: 1200,
  sessionSeconds: 120
});

const round = ref<EatOrNotEatRound>(generateEatOrNotEatRound());
const resultVisible = computed(() => session.status === "finished");

const answers: Array<{ id: EatOrNotEatAnswer; title: string; emoji: string }> = [
  { id: "food", title: "Можно есть", emoji: "🍽️" },
  { id: "thing", title: "Нельзя есть", emoji: "📦" }
];

function nextRound() {
  round.value = generateEatOrNotEatRound();
}

function answer(value: EatOrNotEatAnswer) {
  if (session.status !== "running") return;
  if (value === round.value.correctAnswer) recordSuccess({ targetId: round.value.item.id });
  else recordMistake({ expected: round.value.correctAnswer, actual: value });
  if (session.step < session.maxSteps) nextRound();
}

function restart() {
  startSession();
  nextRound();
}
</script>

<template>
  <div class="eat-shell">
    <GameHud title="Съедобное" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Куда положим?</div>
            <div class="item-display mb-8">
              <div class="item-emoji">{{ round.item.emoji }}</div>
              <h1 class="text-h3 font-weight-bold">{{ round.item.word }}</h1>
            </div>
            <v-row>
              <v-col v-for="option in answers" :key="option.id" cols="12" md="6">
                <GameDwellButton :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="210" @select="answer(option.id)">
                  <template #default>
                    <div class="choice-emoji">{{ option.emoji }}</div>
                    <div class="text-h4 font-weight-bold">{{ option.title }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Съедобное" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
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
