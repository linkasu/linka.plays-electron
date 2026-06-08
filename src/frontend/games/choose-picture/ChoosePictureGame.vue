<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSession } from "../../core/session";
import { generateChoosePictureRound, type ChoosePictureRound } from "./model";

const router = useRouter();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("choose-picture", {
  maxSteps: 8,
  dwellMs: 1200,
  sessionSeconds: 120
});

const round = ref<ChoosePictureRound>(generateChoosePictureRound(session.settings));
const resultVisible = computed(() => session.status === "finished");

function nextRound() {
  round.value = generateChoosePictureRound(session.settings);
}

function choose(index: number) {
  if (session.status !== "running") return;
  const choice = round.value.choices[index];
  if (index === round.value.correctIndex) recordSuccess({ targetId: choice.id });
  else recordMistake({ expected: round.value.target.word, actual: choice.word });
  if (session.step < session.maxSteps) nextRound();
}

function restart() {
  startSession();
  nextRound();
}
</script>

<template>
  <div class="choose-shell">
    <GameHud title="Выбери картинку" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Слушаем и выбираем</div>
            <h1 class="text-h3 font-weight-bold text-center mb-8">{{ round.prompt }}</h1>
            <v-row>
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="6" md="3">
                <GameDwellButton :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" @select="choose(index)">
                  <template #default>
                    <div class="choice-emoji">{{ choice.emoji }}</div>
                    <div class="text-h5 font-weight-bold mt-2">{{ choice.word }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Выбери картинку" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.choose-shell {
  background: linear-gradient(135deg, #f3ecff 0%, #e4fbff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.choice-emoji {
  font-size: clamp(4rem, 9vw, 7rem);
  line-height: 1;
}
</style>
