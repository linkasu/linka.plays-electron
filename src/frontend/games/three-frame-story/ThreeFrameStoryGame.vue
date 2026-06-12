<script setup lang="ts">
import { computed, onUnmounted, shallowRef, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateThreeFrameStoryRound, type ThreeFrameStoryFrame } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("three-frame-story", {
  maxSteps: 6,
  dwellMs: 1300,
  sessionSeconds: 140
}, { finishOnMistakes: false });

const round = shallowRef(generateThreeFrameStoryRound(session.step));
const feedbackMessage = ref("Выбери первый кадр истории.");
const pendingSelection = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
let feedbackTimer = 0;

const resultVisible = computed(() => session.status === "finished");
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

function resetFeedback(message = "Выбери следующий кадр истории.") {
  clearFeedbackTimer();
  feedbackMessage.value = message;
  pendingSelection.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
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

function choose(choice: ThreeFrameStoryFrame) {
  if (session.status !== "running" || pendingSelection.value) return;

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
    if (session.status === "running") scheduleNextFrame();
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = choice.id;
  feedbackMessage.value = `Этот кадр будет позже. Сейчас ищем: ${round.value.expectedFrame.label}.`;
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId,
    expected: round.value.expectedFrame.label,
    actual: choice.label,
    storyId: round.value.story.id,
    isCorrect: false
  });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, expected: round.value.expectedFrame.label });

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
  startSession();
  refreshRound();
  resetFeedback("Выбери первый кадр истории.");
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="story-shell">
    <GameHud title="История из 3 кадров" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
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
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" md="4">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="230" :color="choiceColor(choice)" @select="choose(choice)">
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
  </div>
</template>

<style scoped>
.story-shell {
  background: linear-gradient(135deg, #fff8e1 0%, #e3f2fd 54%, #f3e5f5 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.story-slots {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.story-slot {
  align-items: center;
  border: 3px solid rgb(var(--v-theme-primary) / 16%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: clamp(170px, 20vw, 240px);
  position: relative;
  text-align: center;
}

.slot-number {
  background: rgb(var(--v-theme-surface) / 78%);
  border-radius: 999px;
  font-weight: 800;
  inset-block-start: 12px;
  inset-inline-start: 12px;
  min-inline-size: 34px;
  padding: 4px 10px;
  position: absolute;
}

.frame-emoji {
  filter: drop-shadow(0 10px 12px rgb(0 0 0 / 14%));
  font-size: clamp(4.5rem, 9vw, 7rem);
  line-height: 1;
}

.empty-icon {
  font-size: clamp(3.5rem, 7vw, 5.5rem);
}

@media (max-width: 700px) {
  .game-container {
    padding-block-start: 156px;
  }

  .story-slots {
    gap: 10px;
  }
}

@media (max-height: 920px) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .story-slots {
    display: none;
  }
}
</style>
