<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposePyramidAudio, playPyramidCompleteMelody, playPyramidMistakeMelody, playPyramidPlaceMelody, warmPyramidAudio } from "./audio";
import { createPyramidRings, getCorrectPyramidOrder, getNextPyramidRing, getPlacedPyramidRings, selectPyramidRing, type PyramidRing } from "./model";

type PyramidMistakeReview = {
  step: number;
  selectedRing: PyramidRing;
  expectedRing?: PyramidRing;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("pyramid", {
  maxSteps: 4,
  overrides: { sound: true },
  finishOnMaxSteps: false
});

const rings = reactive<PyramidRing[]>([]);
const resultVisible = ref(false);
const reviewVisible = ref(false);
const reviewStep = ref(0);
const mistakeReviews = ref<PyramidMistakeReview[]>([]);
const nextRing = computed(() => getNextPyramidRing(rings));
const placedRings = computed(() => getPlacedPyramidRings(rings));
const correctOrder = computed(() => getCorrectPyramidOrder(rings));
const activeReview = computed(() => mistakeReviews.value[reviewStep.value]);
const feedbackMessage = ref("Можно выбирать любое кольцо. Посмотрим, какая пирамидка получится.");
const currentRoundId = computed(() => `pyramid:round:${session.step + 1}`);
const isSpeaking = ref(false);
const pendingSelection = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "pyramid", soundEnabled: toRef(session.settings, "sound") });
let resultTimer = 0;
let reviewTimer = 0;

function ringTargetId(ring: PyramidRing) {
  return `pyramid:ring:${ring.id}`;
}

function ringInlineSize(ring: PyramidRing) {
  return `${ring.size / 16}rem`;
}

function reviewRingLabel(ring?: PyramidRing) {
  if (!ring) return "кольцо не найдено";
  const order = getCorrectPyramidOrder(createPyramidRings()).findIndex((item) => item.id === ring.id);
  return ["самое большое", "второе", "третье", "самое маленькое"][order] ?? "кольцо";
}

function resetRings() {
  rings.splice(0, rings.length, ...createPyramidRings());
}

function clearResultTimer() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
}

function clearReviewTimer() {
  window.clearTimeout(reviewTimer);
  reviewTimer = 0;
}

function scheduleResultDialog() {
  clearResultTimer();
  resultTimer = window.setTimeout(() => {
    reviewVisible.value = false;
    resultVisible.value = true;
  }, 700);
}

function scheduleReviewStep() {
  clearReviewTimer();
  reviewTimer = window.setTimeout(() => {
    if (!reviewVisible.value) return;
    if (reviewStep.value < mistakeReviews.value.length - 1) {
      reviewStep.value += 1;
      scheduleReviewStep();
      return;
    }
    scheduleResultDialog();
  }, 2400);
}

async function startMistakeReview() {
  if (!mistakeReviews.value.length) {
    scheduleResultDialog();
    return;
  }

  reviewStep.value = 0;
  reviewVisible.value = true;
  resultVisible.value = false;
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["pyramid.review"], 250);
  isSpeaking.value = false;
  scheduleReviewStep();
}

function finishReview() {
  clearReviewTimer();
  promptAudio.cancelPending();
  isSpeaking.value = false;
  scheduleResultDialog();
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["pyramid.prompt"], delayMs);
  isSpeaking.value = false;
}

async function chooseRing(ring: PyramidRing) {
  if (session.status !== "running" || ring.placed || pendingSelection.value || isSpeaking.value) return;

  const roundId = currentRoundId.value;
  const outcome = selectPyramidRing(rings, ring.id);
  if (outcome.kind === "ignored") return;

  pendingSelection.value = true;
  rings.splice(0, rings.length, ...outcome.rings);

  if (outcome.isCorrect) {
    feedbackMessage.value = "Верно. Кольцо легло на пирамидку.";
    recordSuccess({ roundId, targetId: ringTargetId(outcome.selectedRing), expected: outcome.selectedRing.id, actual: outcome.selectedRing.id, isCorrect: true });
    void playPyramidPlaceMelody(session.settings.sound);
  } else {
    feedbackMessage.value = "Кольцо поставлено. Продолжай собирать пирамидку.";
    recordMistake({ roundId, targetId: ringTargetId(outcome.selectedRing), expectedTargetId: outcome.expectedRing ? ringTargetId(outcome.expectedRing) : undefined, expected: outcome.expectedRing?.id, actual: outcome.selectedRing.id, isCorrect: false });
    mistakeReviews.value.push({ step: outcome.selectedRing.placedIndex ?? placedRings.value.length, selectedRing: outcome.selectedRing, expectedRing: outcome.expectedRing });
    if (session.status === "running") session.step += 1;
    void playPyramidMistakeMelody(session.settings.sound);
  }

  isSpeaking.value = true;

  if (outcome.isComplete && session.status === "running") {
    feedbackMessage.value = "Пирамидка собрана. Посмотри, как стоят все кольца.";
    finishSession("game-complete");
    void playPyramidCompleteMelody(session.settings.sound);
    await promptAudio.playSequenceAndWait([outcome.isCorrect ? "pyramid.correct" : "pyramid.mistake", "pyramid.complete"], 80, 170);
    isSpeaking.value = false;
    pendingSelection.value = false;
    void startMistakeReview();
    return;
  }

  await promptAudio.playSequenceAndWait([outcome.isCorrect ? "pyramid.correct" : "pyramid.mistake"], 80);
  isSpeaking.value = false;
  pendingSelection.value = false;
}

function restart() {
  clearResultTimer();
  clearReviewTimer();
  promptAudio.cancelPending();
  pendingSelection.value = false;
  isSpeaking.value = false;
  reviewVisible.value = false;
  reviewStep.value = 0;
  mistakeReviews.value = [];
  resultVisible.value = false;
  resetRings();
  feedbackMessage.value = "Можно выбирать любое кольцо. Посмотрим, какая пирамидка получится.";
  startSession();
  void playPrompt(450);
}

resetRings();

onMounted(() => {
  promptAudio.warm();
  warmPyramidAudio(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearResultTimer();
  clearReviewTimer();
  disposePyramidAudio();
});

watch(() => session.status, (status) => {
  if (status !== "finished") {
    clearResultTimer();
    clearReviewTimer();
    reviewVisible.value = false;
    resultVisible.value = false;
  }
});
</script>

<template>
  <div class="pyramid-shell">
    <GameHud title="Пирамидка" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="pa-4 pa-md-5" rounded="xl" elevation="8">
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Собери пирамидку</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-4">Выбирай кольца спокойно. Даже если порядок другой, мы поставим каждое кольцо и покажем всю сборку.</p>
            <div class="play-area">
              <v-card class="stack-card pa-5" color="deep-purple-lighten-5" rounded="xl" variant="flat">
                <div class="stack" aria-label="Собранная пирамидка">
                  <div class="stem" />
                  <div class="stack-layers">
                    <div v-for="ring in placedRings" :key="`placed-${ring.id}`" class="stack-ring" :style="{ inlineSize: ringInlineSize(ring), background: ring.color }" />
                  </div>
                  <div class="base" />
                </div>
                <div class="text-body-1 text-center text-medium-emphasis mt-4">{{ feedbackMessage }}</div>
              </v-card>
              <div class="rings">
                <GameDwellButton v-for="ring in rings" :key="ring.id" :target-id="ringTargetId(ring)" :disabled="session.status !== 'running' || ring.placed || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="8rem" @select="chooseRing(ring)">
                  <template #default>
                    <div class="loose-ring" :style="{ inlineSize: ringInlineSize(ring), background: ring.color, opacity: ring.placed ? 0.25 : 1 }" />
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <v-dialog :model-value="reviewVisible" max-width="48rem" persistent transition="fade-transition">
      <v-card class="review-card pa-4 pa-md-6" rounded="xl" elevation="12">
        <v-card-title class="text-h4 font-weight-bold px-0 pt-0">Разбор порядка</v-card-title>
        <v-card-text class="px-0">
          <v-alert color="info" variant="tonal" rounded="lg" class="mb-4">
            Правило пирамидки: сначала большое кольцо, потом всё меньше и меньше.
          </v-alert>

          <v-row dense>
            <v-col cols="12" md="6">
              <v-card color="deep-purple-lighten-5" rounded="xl" variant="flat" class="pa-4 h-100">
                <div class="text-subtitle-1 font-weight-bold mb-3">Твой порядок</div>
                <div class="review-ring-row" aria-label="Порядок выбранных колец">
                  <span v-for="ring in placedRings" :key="`review-placed-${ring.id}`" class="review-ring" :style="{ inlineSize: ringInlineSize(ring), background: ring.color }" />
                </div>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card color="green-lighten-5" rounded="xl" variant="flat" class="pa-4 h-100">
                <div class="text-subtitle-1 font-weight-bold mb-3">Порядок по правилу</div>
                <div class="review-ring-row" aria-label="Правильный порядок колец">
                  <span v-for="ring in correctOrder" :key="`review-correct-${ring.id}`" class="review-ring" :style="{ inlineSize: ringInlineSize(ring), background: ring.color }" />
                </div>
              </v-card>
            </v-col>
          </v-row>

          <v-card v-if="activeReview" color="warning" variant="tonal" rounded="xl" class="mt-4 pa-4">
            <div class="text-overline">Сложный шаг {{ activeReview.step }}</div>
            <div class="text-body-1 font-weight-bold mb-3">Выбрано {{ reviewRingLabel(activeReview.selectedRing) }} кольцо, а по правилу ждали {{ reviewRingLabel(activeReview.expectedRing) }}.</div>
            <div class="review-comparison">
              <div>
                <div class="text-caption text-medium-emphasis mb-1">Выбрано</div>
                <span class="review-ring review-ring--single" :style="{ inlineSize: ringInlineSize(activeReview.selectedRing), background: activeReview.selectedRing.color }" />
              </div>
              <v-icon icon="mdi-arrow-right" aria-hidden="true" />
              <div>
                <div class="text-caption text-medium-emphasis mb-1">Ждали</div>
                <span v-if="activeReview.expectedRing" class="review-ring review-ring--single" :style="{ inlineSize: ringInlineSize(activeReview.expectedRing), background: activeReview.expectedRing.color }" />
              </div>
            </div>
          </v-card>
        </v-card-text>
        <v-card-actions class="px-0 pb-0">
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="finishReview">К итогам</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <GameResultDialog :model-value="resultVisible" title="Пирамидка" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.pyramid-shell {
  background: linear-gradient(135deg, #fff8e1 0%, #f1f0ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.play-area {
  align-items: center;
  display: grid;
  gap: 2rem;
  grid-template-columns: 1fr 1.4fr;
}

.stack-card {
  min-inline-size: 0;
}

.stack {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-block-size: 21.25rem;
  overflow: hidden;
  position: relative;
}

.stem {
  background: linear-gradient(90deg, #8d6e63 0%, #bcaaa4 50%, #795548 100%);
  block-size: 18.25rem;
  border-radius: 999px;
  bottom: 1.75rem;
  box-shadow: inset -0.1875rem 0 0.3125rem rgb(62 39 35 / 20%);
  inline-size: 1.125rem;
  position: absolute;
  z-index: 1;
}

.stem::before {
  background: radial-gradient(circle at 35% 30%, #efebe9 0%, #bcaaa4 30%, #795548 100%);
  block-size: 2.125rem;
  border-radius: 999px;
  box-shadow: 0 0.25rem 0.625rem rgb(62 39 35 / 20%);
  content: "";
  inline-size: 2.125rem;
  inset-block-start: -1.25rem;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.stack-layers {
  align-items: center;
  display: flex;
  flex-direction: column-reverse;
  inline-size: 100%;
  justify-content: flex-start;
  min-block-size: 16.25rem;
  position: relative;
  z-index: 2;
}

.base {
  background: linear-gradient(180deg, #bcaaa4 0%, #8d6e63 100%);
  block-size: 1.875rem;
  border-radius: 999px;
  box-shadow: 0 0.625rem 1.125rem rgb(93 64 55 / 22%);
  inline-size: min(18.125rem, 100%);
  margin-block-start: 0;
  position: relative;
  z-index: 3;
}

.stack-ring,
.loose-ring {
  block-size: 3.375rem;
  border-radius: 999px;
  box-shadow: inset 0 -0.5rem 0.875rem rgb(0 0 0 / 16%);
  margin-block: 0;
  margin-inline: auto;
  max-inline-size: 100%;
}

.rings {
  display: grid;
  gap: 0.875rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.review-card {
  background: rgb(var(--v-theme-surface));
}

.review-ring-row {
  align-items: center;
  display: flex;
  flex-direction: column-reverse;
  gap: 0.375rem;
}

.review-ring {
  block-size: 1.25rem;
  border-radius: 999rem;
  box-shadow: inset 0 -0.25rem 0.5rem rgb(0 0 0 / 16%);
  display: block;
  max-inline-size: 100%;
}

.review-ring--single {
  block-size: 1.75rem;
}

.review-comparison {
  align-items: center;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

@media (max-width: 60rem) {
  .game-container {
    padding-block-start: 6.25rem;
  }

  .play-area {
    grid-template-columns: 1fr;
  }

  .stack {
    min-block-size: 18.75rem;
  }

  .stack-layers {
    min-block-size: 14rem;
  }
}

@media (min-width: 43.75rem) and (max-height: 51.25rem) {
  .game-container {
    padding-block-start: 7rem;
  }

  .play-area {
    gap: 1rem;
    grid-template-columns: minmax(0, 0.8fr) minmax(18rem, 1.2fr);
  }

  .stack {
    min-block-size: 13.75rem;
  }

  .stack-layers {
    min-block-size: 10.625rem;
  }

  .stem {
    block-size: 11.875rem;
  }
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 6.5rem;
  }

  .rings {
    grid-template-columns: 1fr;
  }

  .stack-ring,
  .loose-ring {
    block-size: 3rem;
  }
}
</style>
