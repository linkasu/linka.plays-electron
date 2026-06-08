<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSession } from "../../core/session";
import { generateCountItemsRound, type CountItemsRound } from "./model";

const router = useRouter();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("count-items", {
  maxSteps: 8,
  dwellMs: 1100,
  sessionSeconds: 120
});

const round = ref<CountItemsRound>(generateCountItemsRound(session.settings));
const resultVisible = computed(() => session.status === "finished");

function nextRound() {
  round.value = generateCountItemsRound(session.settings);
}

function answer(index: number) {
  if (session.status !== "running") return;
  if (index === round.value.correctIndex) recordSuccess({ actual: round.value.choices[index] });
  else recordMistake({ expected: round.value.targetCount, actual: round.value.choices[index] });
  if (session.step < session.maxSteps) nextRound();
}

function restart() {
  startSession();
  nextRound();
}
</script>

<template>
  <div class="count-shell">
    <GameHud title="Счёт" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <h1 class="text-h4 text-md-h3 font-weight-bold mb-6 text-center">Сколько предметов?</h1>
            <div class="items-grid mb-8">
              <span v-for="index in round.targetCount" :key="index" class="item-emoji">{{ round.itemEmoji }}</span>
            </div>
            <v-row>
              <v-col v-for="(choice, index) in round.choices" :key="choice" cols="6" md="3">
                <GameDwellButton :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" @select="answer(index)">
                  <template #default>
                    <div class="text-h2 font-weight-bold">{{ choice }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Счёт" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.count-shell {
  background: linear-gradient(135deg, #fff5dc 0%, #e4f5ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.items-grid {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  justify-content: center;
  min-block-size: 180px;
}

.item-emoji {
  font-size: clamp(3rem, 8vw, 5.5rem);
  line-height: 1;
}
</style>
