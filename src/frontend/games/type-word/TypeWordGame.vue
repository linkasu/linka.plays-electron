<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSession } from "../../core/session";
import { generateTypeWordRound, type TypeWordRound } from "./model";

const router = useRouter();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("type-word", {
  maxSteps: 5,
  dwellMs: 1200,
  sessionSeconds: 120
});

const round = ref<TypeWordRound>(generateTypeWordRound(session.settings));
const currentIndex = ref(0);
const resultVisible = computed(() => session.status === "finished");
const currentLetter = computed(() => round.value.letters[currentIndex.value]);

function nextWord() {
  round.value = generateTypeWordRound(session.settings);
  currentIndex.value = 0;
}

function pressKey(key: string) {
  if (session.status !== "running") return;
  if (key !== currentLetter.value) {
    recordMistake({ expected: currentLetter.value, actual: key });
    return;
  }
  if (currentIndex.value === round.value.letters.length - 1) {
    recordSuccess({ targetId: round.value.item.id });
    if (session.step < session.maxSteps) nextWord();
    return;
  }
  currentIndex.value += 1;
}

function restart() {
  startSession();
  nextWord();
}
</script>

<template>
  <div class="type-shell">
    <GameHud title="Печать слов" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="word-card mb-8">
              <div class="word-emoji">{{ round.item.emoji }}</div>
              <div class="letters">
                <span v-for="(letter, index) in round.letters" :key="`${letter}-${index}`" :class="['letter', { done: index < currentIndex, current: index === currentIndex }]">
                  {{ letter }}
                </span>
              </div>
            </div>
            <v-row>
              <v-col v-for="key in round.keyboardChoices" :key="key" cols="4" md="2">
                <GameDwellButton :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="110" @select="pressKey(key)">
                  <template #default>
                    <div class="text-h3 font-weight-bold">{{ key }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Печать слов" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.type-shell {
  background: linear-gradient(135deg, #eef6ff 0%, #fff0fa 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.word-card {
  text-align: center;
}

.word-emoji {
  font-size: clamp(4rem, 10vw, 7rem);
  line-height: 1;
}

.letters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-block-start: 24px;
}

.letter {
  background: #fff;
  border: 4px solid #d6d9ff;
  border-radius: 18px;
  font-size: clamp(2rem, 7vw, 4rem);
  font-weight: 800;
  min-inline-size: 72px;
  padding: 8px 18px;
  text-transform: uppercase;
}

.letter.done {
  background: #d8f8d8;
  border-color: #63c56a;
}

.letter.current {
  background: #fff3c4;
  border-color: #ffb300;
}
</style>
