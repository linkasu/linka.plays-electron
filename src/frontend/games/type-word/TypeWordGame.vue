<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameSquareChoiceGrid, { type GameSquareChoice } from "../../components/game/GameSquareChoiceGrid.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeTypeWordAudio, playTypeWordMistakeMelody, playTypeWordSuccessMelody, warmTypeWordAudio } from "./audio";
import { generateTypeWordRound, type TypeWordRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("type-word", {
  maxSteps: 5,
  overrides: { dwellMs: 1200, sessionSeconds: 120 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({
  gameId: "type-word",
  soundEnabled: toRef(session.settings, "sound"),
  volume: 0.34,
  warmAssetIds: ["type-word.prompt", "type-word.correct", "type-word.mistake", "type-word.complete"]
});

let roundIndex = 1;
const round = ref<TypeWordRound>(generateTypeWordRound(session.settings, roundIndex));
const currentIndex = ref(0);
const isChangingWord = ref(false);
const resultVisible = computed(() => session.status === "finished");
const currentLetter = computed(() => round.value.letters[currentIndex.value]);

function keyTargetId(key: string) {
  return `type-word:key:${key}`;
}

function nextWord() {
  roundIndex += 1;
  round.value = generateTypeWordRound(session.settings, roundIndex);
  currentIndex.value = 0;
}

async function pressKey(key: string) {
  if (session.status !== "running" || isChangingWord.value) return;
  if (key !== currentLetter.value) {
    recordMistake({ roundId: round.value.roundId, targetId: keyTargetId(key), expectedTargetId: keyTargetId(currentLetter.value), expected: currentLetter.value, actual: key, isCorrect: false });
    isChangingWord.value = true;
    await playTypeWordMistakeMelody(session.settings.sound);
    await promptAudio.playSequenceAndWait(["type-word.mistake"], 80);
    isChangingWord.value = false;
    return;
  }
  if (currentIndex.value === round.value.letters.length - 1) {
    recordSuccess({ roundId: round.value.roundId, targetId: keyTargetId(key), wordId: round.value.item.id, expected: round.value.item.word, actual: round.value.item.word, isCorrect: true });
    isChangingWord.value = true;
    await playTypeWordSuccessMelody(session.settings.sound);
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["type-word.correct", "type-word.complete"] : ["type-word.correct"], 80, 160);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isChangingWord.value = false;
      return;
    }
    nextWord();
    isChangingWord.value = false;
    return;
  }
  currentIndex.value += 1;
}

function selectKey(choice: GameSquareChoice) {
  void pressKey(String(choice));
}

function restart() {
  startSession();
  roundIndex = 1;
  round.value = generateTypeWordRound(session.settings, roundIndex);
  currentIndex.value = 0;
  isChangingWord.value = false;
  promptAudio.cancelPending();
  promptAudio.play("type-word.prompt", 260);
}

onMounted(() => {
  warmTypeWordAudio(session.settings.sound);
  promptAudio.warm();
  promptAudio.play("type-word.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  disposeTypeWordAudio();
});
</script>

<template>
  <div class="type-shell">
    <GameHud title="Печать слов" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="type-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="word-card mb-3 mb-md-5">
              <GameWordImage class="word-emoji" :word-id="round.item.id" :word="round.item.word" :emoji="round.item.emoji" />
              <div class="letters">
                <span v-for="(letter, index) in round.letters" :key="`${letter}-${index}`" :class="['letter', { done: index < currentIndex, current: index === currentIndex }]">
                  {{ letter }}
                </span>
              </div>
            </div>
            <GameSquareChoiceGrid class="type-keyboard" :items="round.keyboardChoices" :target-id="(choice) => keyTargetId(String(choice))" :disabled="session.status !== 'running' || isChangingWord" :dwell-ms="session.settings.dwellMs" compact-size="8.5rem" @select="selectKey">
              <template #default="{ choice }">
                <div class="text-h3 font-weight-bold">{{ choice }}</div>
              </template>
            </GameSquareChoiceGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Печать слов" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.type-shell {
  background: linear-gradient(135deg, #eef6ff 0%, #fff0fa 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.word-card {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 1.125rem 1.75rem;
  justify-content: center;
  text-align: center;
}

.word-emoji {
  font-size: clamp(3rem, 6vw, 5rem);
  line-height: 1;
}

.letters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
  justify-content: center;
}

.letter {
  background: #fff;
  border: 0.1875rem solid #d6d9ff;
  border-radius: 1rem;
  font-size: clamp(1.8rem, 4.8vw, 3.4rem);
  font-weight: 800;
  min-inline-size: 3.5rem;
  padding: 0.25rem 0.75rem;
  text-transform: uppercase;
}

.type-keyboard {
  --choice-grid-offset: 17.75rem;
}

.type-keyboard :deep(.dwell-button--active) {
  color: #102c2b;
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

.letter.done {
  background: #d8f8d8;
  border-color: #63c56a;
}

.letter.current {
  background: #fff3c4;
  border-color: #ffb300;
}
</style>
