<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateThreeFrameStoryRound, type ThreeFrameStoryFrame } from "./model";

const threeFrameStoryFeedback = createStandardGameFeedback();

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("three-frame-story", {
  maxSteps: 6,
  overrides: { sound: true },
  finishOnMistakes: false
});

const round = shallowRef(generateThreeFrameStoryRound(session.step));
const feedbackMessage = ref("Выбери первый кадр истории.");
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const promptAudio = useGamePromptAudio({ gameId: "three-frame-story", soundEnabled: toRef(session.settings, "sound") });
let feedbackTimer = 0;
let resultTimer = 0;

const resultVisible = ref(false);
const assembledFrames = computed(() => {
  if (successChoiceId.value === round.value.expectedFrame.id) return [...round.value.placedFrames, round.value.expectedFrame];
  return round.value.placedFrames;
});

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
  round.value = generateThreeFrameStoryRound(session.step);
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
    feedbackMessage.value = "Попробуй ещё раз спокойно.";
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
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Последовательность</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">{{ round.story.title }}</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">{{ round.story.prompt }}</p>

            <v-card class="pa-4 pa-md-5 mb-6" color="blue-lighten-5" rounded="xl" variant="flat">
              <div class="d-flex flex-wrap align-center justify-center ga-3 text-center">
                <v-icon icon="mdi-filmstrip" color="primary" size="36" />
                <div class="text-h6 font-weight-bold">{{ feedbackMessage }}</div>
              </div>
            </v-card>

            <div class="story-slots mb-7" aria-label="Собранная история">
              <v-card v-for="slotIndex in 3" :key="slotIndex" class="story-slot pa-4" :color="assembledFrames[slotIndex - 1]?.color ?? 'blue-grey-lighten-5'" rounded="xl" variant="flat">
                <template v-if="assembledFrames[slotIndex - 1]">
                  <div class="slot-number">{{ slotIndex }}</div>
                  <div class="frame-emoji emoji-glyph">{{ assembledFrames[slotIndex - 1].emoji }}</div>
                  <div class="text-h6 font-weight-bold mt-2">{{ assembledFrames[slotIndex - 1].label }}</div>
                </template>
                <template v-else>
                  <div class="slot-number">{{ slotIndex }}</div>
                  <v-icon class="empty-icon" icon="mdi-help" color="blue-grey-darken-1" />
                  <div class="text-body-1 font-weight-bold text-medium-emphasis mt-2">Ждёт кадр</div>
                </template>
              </v-card>
            </div>

            <v-row justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="4" sm="4">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="9rem" :color="choiceColor(choice)" @select="choose(choice)">
                  <template #default>
                    <div class="frame-emoji emoji-glyph">{{ choice.emoji }}</div>
                    <div class="text-h5 font-weight-bold mt-3">{{ choice.label }}</div>
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
  min-block-size: clamp(10.625rem, 20vw, 15rem);
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

.frame-emoji {
  filter: drop-shadow(0 0.625rem 0.75rem rgb(0 0 0 / 14%));
  font-size: clamp(4.5rem, 9vw, 7rem);
  line-height: 1;
}

.empty-icon {
  font-size: clamp(3.5rem, 7vw, 5.5rem);
}

@media (max-width: 43.75rem) {
  .story-slots {
    gap: 0.625rem;
  }
}

@media (max-height: 57.5rem) {
  .story-slots {
    display: none;
  }
}
</style>
