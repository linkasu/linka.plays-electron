<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { shuffleItems } from "../../core/random";
import { createThreeFrameStorySlots, generateThreeFrameStoryRound, threeFrameStories, type ThreeFrameStoryFrame } from "./model";

const threeFrameStoryFeedback = createStandardGameFeedback();

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("three-frame-story", {
  maxSteps: 6,
  overrides: { sound: true },
  finishOnMistakes: false
});

function createThreeFrameStoryOrder() {
  return shuffleItems(threeFrameStories.map((_, index) => index));
}

const storyOrder = shallowRef(createThreeFrameStoryOrder());
const choiceOrders = shallowRef<Record<string, string[]>>({});

function storyForStep(completedSteps: number) {
  const storyCycleIndex = Math.floor(Math.max(0, completedSteps) / 3) % threeFrameStories.length;
  return threeFrameStories[storyOrder.value[storyCycleIndex] ?? storyCycleIndex];
}

function choiceOrderForStep(completedSteps: number) {
  const story = storyForStep(completedSteps);
  if (!choiceOrders.value[story.id]) {
    choiceOrders.value = {
     ...choiceOrders.value,
      [story.id]: shuffleItems(story.frames).map((frame) => frame.id)
    };
  }
  return choiceOrders.value[story.id];
}

const round = shallowRef(generateThreeFrameStoryRound(session.step, { choiceOrder: choiceOrderForStep(session.step), storyOrder: storyOrder.value }));
const feedbackMessage = ref("Выбери первый кадр истории.");
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const promptAudio = useGamePromptAudio({ gameId: "three-frame-story", soundEnabled: toRef(session.settings, "sound") });
let feedbackTimer = 0;
let resultTimer = 0;

const resultVisible = ref(false);
const assembledFrames = computed(() => createThreeFrameStorySlots(round.value, successChoiceId.value));

function choiceTargetId(choice: ThreeFrameStoryFrame) {
  return `three-frame-story:choice:${round.value.story.id}:${choice.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearResultTimer() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
}

function resetFeedback(message = "Выбери следующий кадр истории.") {
  clearFeedbackTimer();
  feedbackMessage.value = message;
  pendingSelection.value = false;
  isSpeaking.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["three-frame-story.prompt"], delayMs);
  isSpeaking.value = false;
}

function showResultSoon(delayMs = 900) {
  clearResultTimer();
  resultTimer = window.setTimeout(() => {
    resultVisible.value = true;
  }, delayMs);
}

function refreshRound() {
  round.value = generateThreeFrameStoryRound(session.step, { choiceOrder: choiceOrderForStep(session.step), storyOrder: storyOrder.value });
}

function scheduleNextFrame() {
  clearFeedbackTimer();
  feedbackTimer = window.setTimeout(() => {
    if (session.status !== "running") return;
    refreshRound();
    const isNewStory = round.value.stepInStory === 0;
    resetFeedback(isNewStory ? "Новая история. Выбери первый кадр." : "Хорошо. Выбери следующий кадр.");
  }, 700);
}

async function choose(choice: ThreeFrameStoryFrame) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.expectedFrame);
  clearFeedbackTimer();

  if (choice.id === round.value.expectedFrame.id) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    feedbackMessage.value = choice.caption;
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      expectedTargetId,
      expected: round.value.expectedFrame.label,
      actual: choice.label,
      storyId: round.value.story.id,
      isCorrect: true
    });
    const finishedAfterSuccess = session.step >= session.maxSteps;
    void threeFrameStoryFeedback.playSuccess(session.settings.sound);
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["three-frame-story.correct", "three-frame-story.complete"] : ["three-frame-story.correct"], 80, 170);
    isSpeaking.value = false;
    if (session.status === "running") scheduleNextFrame();
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = choice.id;
  feedbackMessage.value = "Посмотри на начало истории и попробуй выбрать другой кадр.";
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId,
    expected: round.value.expectedFrame.label,
    actual: choice.label,
    storyId: round.value.story.id,
    isCorrect: false
  });
  void threeFrameStoryFeedback.playMistake(session.settings.sound);
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["three-frame-story.mistake"], 80);
  isSpeaking.value = false;

  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
    feedbackMessage.value = "Попробуй ещё раз.";
  }, 950);
}

function choiceColor(choice: ThreeFrameStoryFrame) {
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  return choice.color;
}

function restart() {
  clearResultTimer();
  promptAudio.cancelPending();
  resultVisible.value = false;
  storyOrder.value = createThreeFrameStoryOrder();
  choiceOrders.value = {};
  startSession();
  refreshRound();
  resetFeedback("Выбери первый кадр истории.");
  void playPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  threeFrameStoryFeedback.warm(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearFeedbackTimer();
  clearResultTimer();
  promptAudio.cancelPending();
  threeFrameStoryFeedback.dispose();
});

watch(() => session.status, (status) => {
  if (status === "finished") {
    if (!isSpeaking.value) showResultSoon();
  } else {
    clearResultTimer();
    resultVisible.value = false;
  }
});

watch(isSpeaking, (speaking) => {
  if (!speaking && session.status === "finished" && !resultVisible.value) showResultSoon();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #fff8e1 0%, #e3f2fd 54%, #f3e5f5 100%)" padding-top="5rem">
    <template #hud>
      <GameHud title="История из 3 кадров" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="story-card pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="story-overline text-overline text-secondary text-center mb-2">Последовательность</div>
            <h1 class="story-title text-h4 text-md-h3 font-weight-bold text-center mb-2">{{ round.story.title }}</h1>
            <p class="story-prompt text-body-1 text-medium-emphasis text-center mb-6">{{ round.story.prompt }}</p>

            <v-card class="feedback-card pa-4 pa-md-5 mb-6" color="blue-lighten-5" rounded="xl" variant="flat">
              <div class="d-flex flex-wrap align-center justify-center ga-3 text-center">
                <v-icon icon="mdi-filmstrip" color="primary" size="36" />
                <div class="text-h6 font-weight-bold">{{ feedbackMessage }}</div>
              </div>
            </v-card>

            <div class="story-slots mb-7" aria-label="Собранная история">
              <v-card v-for="(frame, slotIndex) in assembledFrames" :key="slotIndex" class="story-slot pa-4" :color="frame?.color ?? 'blue-grey-lighten-5'" rounded="xl" variant="flat">
                <template v-if="frame">
                  <div class="slot-number">{{ slotIndex + 1 }}</div>
                  <div class="story-scene" :class="`story-scene--${frame.scene.setting}`" role="img" :aria-label="frame.label">
                    <template v-for="(layer, layerIndex) in frame.scene.layers" :key="`${layer.kind}:${layerIndex}`">
                      <GameWordImage v-if="layer.kind === 'word'" :class="['scene-layer', `scene-layer--${layer.position}`, `scene-layer--${layer.size ?? 'medium'}`]" :word-id="layer.wordId" :word="layer.word" :emoji="layer.emoji" decorative />
                      <v-icon v-else :class="['scene-layer', `scene-layer--${layer.position}`, `scene-layer--${layer.size ?? 'medium'}`]" :icon="layer.icon" :color="layer.color" />
                    </template>
                  </div>
                  <div class="frame-label text-h6 font-weight-bold mt-2">{{ frame.label }}</div>
                </template>
                <template v-else>
                  <div class="slot-number">{{ slotIndex + 1 }}</div>
                  <v-icon class="empty-icon" icon="mdi-help" color="blue-grey-darken-1" />
                  <div class="text-body-1 font-weight-bold text-medium-emphasis mt-2">Ждёт кадр</div>
                </template>
              </v-card>
            </div>

            <v-row class="choice-row" justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="4" sm="4">
                <GameDwellButton class="story-choice" :aria-label="`Выбрать кадр: ${choice.label}`" :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="9rem" :color="choiceColor(choice)" @select="choose(choice)">
                  <template #default>
                    <div class="story-scene story-scene--choice" :class="`story-scene--${choice.scene.setting}`" aria-hidden="true">
                      <template v-for="(layer, layerIndex) in choice.scene.layers" :key="`${layer.kind}:${layerIndex}`">
                        <GameWordImage v-if="layer.kind === 'word'" :class="['scene-layer', `scene-layer--${layer.position}`, `scene-layer--${layer.size ?? 'medium'}`]" :word-id="layer.wordId" :word="layer.word" :emoji="layer.emoji" decorative />
                        <v-icon v-else :class="['scene-layer', `scene-layer--${layer.position}`, `scene-layer--${layer.size ?? 'medium'}`]" :icon="layer.icon" :color="layer.color" />
                      </template>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="История из 3 кадров" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.story-slots {
  display: grid;
  gap: 1.125rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.story-slot {
  align-items: center;
  border: 0.1875rem solid rgb(var(--v-theme-primary) / 16%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: clamp(9rem, 20vw, 13rem);
  position: relative;
  text-align: center;
}

.slot-number {
  background: rgb(var(--v-theme-surface) / 78%);
  border-radius: 999px;
  font-weight: 800;
  inset-block-start: 0.75rem;
  inset-inline-start: 0.75rem;
  min-inline-size: 2.125rem;
  padding: 0.25rem 0.625rem;
  position: absolute;
}

.story-scene {
  aspect-ratio: 16 / 9;
  background: linear-gradient(180deg, #dff3ff 0%, #f9fdff 100%);
  border: 0.125rem solid rgb(var(--v-theme-primary) / 10%);
  border-radius: 1rem;
  box-shadow: inset 0 0 1.5rem rgb(255 255 255 / 52%);
  inline-size: min(100%, 12rem);
  overflow: hidden;
  position: relative;
}

.story-scene::after {
  background: #a7d47b;
  block-size: 28%;
  content: "";
  inset-block-end: 0;
  inset-inline: 0;
  position: absolute;
}

.story-scene--earth {
  background: linear-gradient(180deg, #dff4ff 0%, #fff8d8 72%);
}

.story-scene--earth::after {
  background: linear-gradient(180deg, #8bc66a 0 22%, #9a6948 22% 100%);
  block-size: 34%;
}

.story-scene--table {
  background: linear-gradient(180deg, #fff8e9 0%, #fffdf7 100%);
}

.story-scene--table::after {
  background: linear-gradient(180deg, #d9aa72, #bd824e);
  block-size: 26%;
}

.story-scene--snow {
  background: linear-gradient(180deg, #dff4ff 0%, #f8fdff 100%);
}

.story-scene--snow::after {
  background: linear-gradient(180deg, #ffffff, #dceff7);
  block-size: 32%;
}

.scene-layer {
  filter: drop-shadow(0 0.35rem 0.45rem rgb(0 0 0 / 18%));
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.scene-layer--small {
  font-size: clamp(1.25rem, 3vw, 2rem) !important;
}

.scene-layer--medium {
  font-size: clamp(2rem, 5vw, 3.75rem) !important;
}

.scene-layer--large {
  font-size: clamp(3rem, 7vw, 5.25rem) !important;
}

.scene-layer--top-left { inset-block-start: 22%; inset-inline-start: 20%; }
.scene-layer--top-center { inset-block-start: 22%; inset-inline-start: 50%; }
.scene-layer--top-right { inset-block-start: 22%; inset-inline-start: 80%; }
.scene-layer--left { inset-block-start: 52%; inset-inline-start: 22%; }
.scene-layer--center { inset-block-start: 50%; inset-inline-start: 50%; }
.scene-layer--right { inset-block-start: 52%; inset-inline-start: 78%; }
.scene-layer--bottom-left { inset-block-start: 72%; inset-inline-start: 22%; }
.scene-layer--bottom-center { inset-block-start: 68%; inset-inline-start: 50%; }
.scene-layer--bottom-right { inset-block-start: 72%; inset-inline-start: 78%; }

.empty-icon {
  font-size: clamp(2.75rem, 6vw, 4.5rem);
}

@media (max-width: 43.75rem) {
  .story-slots {
    gap: 0.625rem;
  }
}

@media (max-height: 57.5rem) {
  .story-card {
    padding-block: 1rem !important;
  }

  .story-prompt {
    margin-block-end: 0.75rem !important;
  }

  .feedback-card {
    margin-block-end: 0.75rem !important;
    padding-block: 0.75rem !important;
  }

  .story-slots {
    gap: 0.75rem;
    margin-block-end: 0.75rem !important;
  }

  .story-slot {
    min-block-size: clamp(6.5rem, 18vh, 8.5rem);
    padding: 0.625rem !important;
  }

  .story-slot .story-scene {
    inline-size: min(100%, 8.5rem);
  }

  .story-slot .frame-label {
    display: none;
  }

  .story-choice :deep(.dwell-button) {
    min-block-size: 7rem !important;
    padding-block: 0.5rem !important;
  }

  .story-scene--choice {
    inline-size: min(100%, 9rem);
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block: 0.5rem;
  }

  .story-overline,
  .story-prompt {
    display: none;
  }

  .story-title {
    font-size: clamp(1.75rem, 5vh, 2.5rem) !important;
    line-height: 1 !important;
    margin-block-end: 0.5rem !important;
  }

  .feedback-card {
    padding: 0.5rem !important;
  }

  .feedback-card .text-h6 {
    font-size: 1rem !important;
  }

  .story-slot {
    min-block-size: 5.75rem;
  }

  .slot-number {
    inset-block-start: 0.35rem;
    inset-inline-start: 0.35rem;
    min-inline-size: 1.65rem;
    padding: 0.1rem 0.4rem;
  }

  .story-slot .story-scene {
    inline-size: min(100%, 7rem);
  }

  .story-choice :deep(.dwell-button) {
    min-block-size: 5.75rem !important;
  }

  .story-scene--choice {
    inline-size: min(100%, 7.5rem);
  }
}
</style>
