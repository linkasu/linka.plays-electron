<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameSquareChoiceGrid, { type GameSquareChoice } from "../../components/game/GameSquareChoiceGrid.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { cancelSceneSpeech, speakSceneText } from "../sceneSpeech";
import { disposeTypeWordAudio, playTypeWordMistakeMelody, playTypeWordSuccessMelody, warmTypeWordAudio } from "./audio";
import { createTypeWordDeck, evaluateTypeWordChoice, generateTypeWordRound, type TypeWordRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("type-word", {
  maxSteps: 5,
  overrides: { dwellMs: 1200, sessionSeconds: 120 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

let roundIndex = 1;
let deckIndex = 0;
let deck = createTypeWordDeck(session.settings);

function createRound(): TypeWordRound {
  const item = deck[deckIndex];
  if (!item) throw new Error("Колода слов закончилась раньше сессии.");
  return generateTypeWordRound(session.settings, item, roundIndex);
}

const round = ref<TypeWordRound>(createRound());
const currentIndex = ref(0);
const isChangingWord = ref(false);
const wrongKey = ref<string>();
const feedbackMessage = ref("Послушай название и выбери следующую букву.");
const resultVisible = computed(() => session.status === "finished");
const currentLetter = computed(() => round.value.letters[currentIndex.value]);
const currentChoices = computed(() => round.value.letterChoices[currentIndex.value] ?? []);

const promptAudio = useGamePromptAudio({
  gameId: "type-word",
  soundEnabled: toRef(session.settings, "sound"),
  volume: 0.34,
  warmAssetIds: ["type-word.correct", "type-word.mistake", "type-word.complete"]
});
const wordNameAudio = useGamePromptAudio({
  gameId: "word-categories",
  soundEnabled: toRef(session.settings, "sound"),
  volume: 0.34,
  warmAssetIds: deck.slice(0, session.maxSteps).map((item) => `word-categories.item.${item.id}`)
});

function keyTargetId(key: string) {
  return `${round.value.roundId}:letter:${currentIndex.value}:${key}`;
}

async function playWordName(delayMs = 0) {
  await wordNameAudio.playSequenceAndWait([round.value.wordAudioAssetId], delayMs);
}

async function playRoundPrompt(withInstruction: boolean, delayMs = 0) {
  isChangingWord.value = true;
  if (withInstruction) await speakSceneText("Собери название предмета. Выбирай буквы слева направо.", session.settings.sound, delayMs);
  await playWordName(withInstruction ? 0 : delayMs);
  isChangingWord.value = false;
}

async function repeatWordName() {
  if (session.status !== "running" || isChangingWord.value) return;
  isChangingWord.value = true;
  await playWordName();
  isChangingWord.value = false;
}

function nextWord() {
  roundIndex += 1;
  deckIndex += 1;
  round.value = createRound();
  currentIndex.value = 0;
  wrongKey.value = undefined;
  feedbackMessage.value = "Послушай название и выбери следующую букву.";
}

async function pressKey(key: string) {
  if (session.status !== "running" || isChangingWord.value || !currentLetter.value) return;
  const targetId = keyTargetId(key);
  const expectedTargetId = keyTargetId(currentLetter.value);
  const selection = evaluateTypeWordChoice(round.value, currentIndex.value, key);

  if (!selection.isCorrect) {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: currentLetter.value, actual: key, wordId: round.value.item.id, letterIndex: currentIndex.value, isCorrect: false });
    wrongKey.value = key;
    feedbackMessage.value = "Это другая буква. Попробуй ещё раз.";
    isChangingWord.value = true;
    await playTypeWordMistakeMelody(session.settings.sound);
    await promptAudio.playSequenceAndWait(["type-word.mistake"], 80);
    wrongKey.value = undefined;
    feedbackMessage.value = "Продолжай с того же места.";
    isChangingWord.value = false;
    return;
  }

  currentIndex.value = selection.nextIndex;
  wrongKey.value = undefined;
  feedbackMessage.value = selection.complete ? "Слово собрано." : "Верно. Выбери следующую букву.";
  if (!selection.complete) return;

  recordSuccess({ roundId: round.value.roundId, targetId, wordId: round.value.item.id, expected: round.value.item.word, actual: round.value.item.word, isCorrect: true });
  isChangingWord.value = true;
  await playTypeWordSuccessMelody(session.settings.sound);
  await promptAudio.playSequenceAndWait(["type-word.correct"], 80);
  await playWordName();
  const finishedAfterSuccess = session.step >= session.maxSteps;

  if (finishedAfterSuccess) {
    await promptAudio.playSequenceAndWait(["type-word.complete"], 120);
    finishSession("game-complete");
    isChangingWord.value = false;
    return;
  }

  nextWord();
  await playRoundPrompt(false, 260);
}

function selectKey(choice: GameSquareChoice) {
  void pressKey(String(choice));
}

function restart() {
  startSession();
  roundIndex = 1;
  deckIndex = 0;
  deck = createTypeWordDeck(session.settings);
  round.value = createRound();
  currentIndex.value = 0;
  wrongKey.value = undefined;
  feedbackMessage.value = "Послушай название и выбери следующую букву.";
  isChangingWord.value = false;
  promptAudio.cancelPending();
  wordNameAudio.cancelPending();
  cancelSceneSpeech();
  void playRoundPrompt(true, 260);
}

onMounted(() => {
  warmTypeWordAudio(session.settings.sound);
  promptAudio.warm();
  wordNameAudio.warm();
  void playRoundPrompt(true, 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  wordNameAudio.cancelPending();
  cancelSceneSpeech();
  disposeTypeWordAudio();
});
</script>

<template>
  <div class="type-shell">
    <GameHud title="Печать слов" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="type-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="learning-panel">
              <GameDwellButton
                class="word-picture"
                :target-id="`${round.roundId}:listen`"
                :aria-label="`Прослушать название: ${round.item.word}`"
                :disabled="session.status !== 'running' || isChangingWord"
                :dwell-ms="session.settings.dwellMs"
                min-height="0"
                color="blue-lighten-5"
                @select="repeatWordName"
              >
                <template #default>
                  <GameWordImage class="word-image" :word-id="round.item.id" :word="round.item.word" :emoji="round.item.emoji" decorative />
                  <div class="listen-label font-weight-bold mt-2">
                    <v-icon icon="mdi-volume-high" class="mr-1" />
                    Послушать название
                  </div>
                </template>
              </GameDwellButton>

              <div class="word-work">
                <h1 class="work-title font-weight-bold">Собери название предмета</h1>
                <p class="feedback text-medium-emphasis" aria-live="polite">{{ feedbackMessage }}</p>
                <div class="letters" role="group" :aria-label="`Собрано букв: ${currentIndex} из ${round.letters.length}`">
                  <span
                    v-for="(letter, index) in round.letters"
                    :key="`${letter}-${index}`"
                    :class="['letter-slot', { 'letter-slot--done': index < currentIndex, 'letter-slot--current': index === currentIndex }]"
                  >
                    {{ index < currentIndex ? letter : "" }}
                  </span>
                </div>
              </div>
            </div>

            <div class="choice-caption font-weight-bold text-center">Выбери следующую букву</div>
            <GameSquareChoiceGrid
              :key="`${round.roundId}:${currentIndex}`"
              class="type-keyboard"
              :items="currentChoices"
              :columns="currentChoices.length"
              :target-id="(choice) => keyTargetId(String(choice))"
              :disabled="session.status !== 'running' || isChangingWord"
              :dwell-ms="session.settings.dwellMs"
              min-size="3.5rem"
              max-size="12rem"
              compact-size="min(7.5rem, 16vw)"
              width-factor="16vw"
              grid-offset="25rem"
              aria-label="Варианты следующей буквы"
              @select="selectKey"
            >
              <template #default="{ choice }">
                <div :class="['letter-choice', { 'letter-choice--wrong': wrongKey === String(choice) }]">{{ choice }}</div>
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
  min-block-size: 100dvh;
}

.game-container {
  padding-block-end: clamp(1rem, 2dvh, 2rem);
  padding-block-start: clamp(9.25rem, 18dvh, 10rem);
}

.learning-panel {
  align-items: stretch;
  display: grid;
  gap: clamp(1rem, 2.5vw, 2rem);
  grid-template-columns: minmax(11rem, 0.75fr) minmax(0, 1.25fr);
}

.word-picture,
.word-picture :deep(.dwell-hitbox),
.word-picture :deep(.dwell-button) {
  block-size: 100%;
}

.word-image {
  font-size: clamp(7.5rem, 22dvh, 13rem);
  line-height: 1;
}

.listen-label {
  color: #17324d;
  font-size: clamp(0.95rem, 1.8vw, 1.2rem);
}

.word-work {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-inline-size: 0;
  text-align: center;
}

.work-title {
  color: #26345d;
  font-size: clamp(1.5rem, 3.2vw, 2.4rem);
  line-height: 1.15;
}

.feedback {
  font-size: clamp(1rem, 2vw, 1.25rem);
  margin-block: clamp(0.5rem, 1.5dvh, 1rem);
  min-block-size: 1.5em;
}

.letters {
  display: flex;
  flex-wrap: nowrap;
  gap: clamp(0.35rem, 1vw, 0.75rem);
  justify-content: center;
  max-inline-size: 100%;
}

.letter-slot {
  align-items: center;
  background: #fff;
  block-size: clamp(3.25rem, 8dvh, 4.75rem);
  border: 0.1875rem solid #c8cdea;
  border-radius: 0.9rem;
  color: #173f28;
  display: inline-flex;
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 800;
  inline-size: clamp(2.9rem, 6vw, 4.5rem);
  justify-content: center;
  text-transform: uppercase;
}

.letter-slot--done {
  background: #ddf7e2;
  border-color: #4caf65;
}

.letter-slot--current {
  background: #fff8dc;
  border-color: #eea81a;
  box-shadow: 0 0 0 0.2rem rgb(238 168 26 / 18%);
}

.choice-caption {
  color: #31405f;
  font-size: clamp(1.05rem, 2vw, 1.3rem);
  margin-block: clamp(0.75rem, 2dvh, 1.25rem) clamp(0.5rem, 1.2dvh, 0.9rem);
}

.letter-choice {
  align-items: center;
  border-radius: 1rem;
  display: flex;
  font-size: clamp(2.4rem, 6vw, 4.5rem);
  font-weight: 800;
  inline-size: 100%;
  justify-content: center;
  padding: 0.35rem;
  text-transform: uppercase;
}

.letter-choice--wrong {
  background: #fff0df;
  box-shadow: 0 0 0 0.3rem #ef8b23;
  color: #7a2f00;
}

.type-keyboard :deep(.dwell-button--active) {
  color: #102c2b;
}

@media (max-width: 42rem) {
  .learning-panel {
    grid-template-columns: minmax(0, 1fr);
  }

  .word-image {
    font-size: clamp(6.5rem, 20dvh, 9rem);
  }
}

@media (max-height: 40rem) {
  .game-container {
    padding-block-start: 9.25rem;
  }

  .word-image {
    font-size: clamp(6.5rem, 20dvh, 8rem);
  }
}
</style>
