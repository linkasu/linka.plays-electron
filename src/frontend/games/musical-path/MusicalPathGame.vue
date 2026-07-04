<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeMusicalPathAudio, playMusicalPathComplete, playMusicalPathMistake, playMusicalPathNote, warmMusicalPathAudio } from "./audio";
import { createMusicalPathStones, findNextMusicalPathStone, isExpectedMusicalPathStone, type MusicalPathStone } from "./model";

type Spark = {
  id: string;
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
  hue: number;
  note: string;
};

const router = useRouter();
const stones = reactive<MusicalPathStone[]>(createMusicalPathStones());
const sparks = reactive<Spark[]>([]);
const feedbackMessage = ref("Начни с подсвеченного камешка 1 и иди по дорожке дальше.");
const pendingSelection = ref(false);
const pathPoints = computed(() => stones.map((stone) => `${stone.x},${stone.y}`).join(" "));
let errorTimer = 0;
let sparkTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("musical-path", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.45, motionSpeed: 0.42, distractors: "none", hints: "high", sound: true },
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({ gameId: "musical-path", soundEnabled: toRef(session.settings, "sound") });

const resultVisible = computed(() => session.status === "finished");
const nextStone = computed(() => findNextMusicalPathStone(stones, session.step));

function stoneStyle(stone: MusicalPathStone) {
  return {
    "--stone-x": `${stone.x}%`,
    "--stone-y": `${stone.y}%`,
    "--stone-mobile-x": `${stone.mobileX}%`,
    "--stone-mobile-y": `${stone.mobileY}%`,
    "--stone-hue": stone.hue
  };
}

function sparkStyle(spark: Spark) {
  return {
    "--spark-x": `${spark.x}%`,
    "--spark-y": `${spark.y}%`,
    "--spark-mobile-x": `${spark.mobileX}%`,
    "--spark-mobile-y": `${spark.mobileY}%`,
    "--spark-hue": spark.hue
  };
}

function targetId(stone: MusicalPathStone) {
  return `musical-path:${stone.order}:${stone.id}`;
}

function playNextStonePrompt(delayMs = 0) {
  const stone = nextStone.value;
  if (!stone) return;
  promptAudio.cancelPending();
  promptAudio.play(`musical-path.prompt.${stone.order}`, delayMs);
}

function resetStones() {
  window.clearTimeout(errorTimer);
  window.clearTimeout(sparkTimer);
  promptAudio.cancelPending();
  stones.splice(0, stones.length, ...createMusicalPathStones(session.maxSteps));
  sparks.splice(0);
  pendingSelection.value = false;
  feedbackMessage.value = "Начни с подсвеченного камешка 1 и иди по дорожке дальше.";
}

function addSpark(stone: MusicalPathStone) {
  sparks.push({
    id: `spark-${stone.id}-${Date.now()}`,
    x: stone.x,
    y: stone.y,
    mobileX: stone.mobileX,
    mobileY: stone.mobileY,
    hue: stone.hue,
    note: stone.note
  });
  if (sparks.length > 5) sparks.shift();

  window.clearTimeout(sparkTimer);
  sparkTimer = window.setTimeout(() => {
    sparks.splice(0, Math.max(0, sparks.length - 2));
  }, 2200);
}

function showSoftError(stone: MusicalPathStone) {
  stone.softError = true;
  feedbackMessage.value = "Этот камешек подождёт. Посмотри на подсвеченный камешек и попробуй ещё раз.";
  window.clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => {
    stone.softError = false;
    pendingSelection.value = false;
  }, 1100);
}

function chooseStone(stone: MusicalPathStone) {
  if (session.status !== "running" || stone.selected || pendingSelection.value) return;

  const expectedStone = nextStone.value;
  const roundId = `musical-path:step:${session.step + 1}`;
  pendingSelection.value = true;
  if (!isExpectedMusicalPathStone(stone, expectedStone)) {
    recordMistake({
      roundId,
      targetId: targetId(stone),
      expectedTargetId: expectedStone ? targetId(expectedStone) : undefined,
      expected: expectedStone?.order,
      actual: stone.order,
      isCorrect: false
    });
    void playMusicalPathMistake(session.settings.sound);
    promptAudio.play("musical-path.mistake");
    showSoftError(stone);
    return;
  }

  stone.selected = true;
  addSpark(stone);
  feedbackMessage.value = stone.order === session.maxSteps ? "Дорожка собрана. Мелодия завершилась." : `Верно: ${stone.note}. Теперь камешек ${stone.order + 1}.`;
  recordSuccess({ roundId, targetId: targetId(stone), note: stone.note, order: stone.order, isCorrect: true });

  if (stone.order >= session.maxSteps) {
    void playMusicalPathComplete(session.settings.sound);
    promptAudio.play("musical-path.complete", 360);
  } else {
    void playMusicalPathNote(session.settings.sound, stone.order - 1);
    playNextStonePrompt(680);
    window.clearTimeout(errorTimer);
    errorTimer = window.setTimeout(() => {
      pendingSelection.value = false;
    }, 420);
  }
}

function restart() {
  resetStones();
  startSession();
}

onMounted(() => {
  warmMusicalPathAudio(session.settings.sound);
  promptAudio.warm();
  playNextStonePrompt(450);
});

onUnmounted(() => {
  window.clearTimeout(errorTimer);
  window.clearTimeout(sparkTimer);
  promptAudio.cancelPending();
  disposeMusicalPathAudio();
});
</script>

<template>
  <div class="musical-path-shell">
    <GameHud
      title="Музыкальная дорожка"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <main class="path-stage" aria-label="Музыкальная дорожка: выбирай камешки по порядку от 1 до 8">
      <div class="path-sky" aria-hidden="true" />
      <svg class="path-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline class="path-line-shadow" :points="pathPoints" />
        <polyline class="path-line-glow" :points="pathPoints" />
      </svg>

      <div v-for="spark in sparks" :key="spark.id" class="note-spark" :style="sparkStyle(spark)" aria-hidden="true">
        <span>{{ spark.note }}</span>
      </div>

      <GameDwellButton
        v-for="stone in stones"
        :key="stone.id"
        class="path-stone-target"
        :class="{
          'path-stone-target--next': stone.id === nextStone?.id,
          'path-stone-target--done': stone.selected,
          'path-stone-target--soft-error': stone.softError
        }"
        :style="stoneStyle(stone)"
        :target-id="targetId(stone)"
        :dwell-ms="session.settings.dwellMs"
        :disabled="session.status !== 'running' || stone.selected || pendingSelection"
        min-height="11.125rem"
        color="surface"
        @select="chooseStone(stone)"
      >
        <template #default="{ active, progress }">
          <div class="path-stone" :class="{ 'path-stone--active': active, 'path-stone--done': stone.selected }" :style="stoneStyle(stone)">
            <div class="stone-order">{{ stone.order }}</div>
            <v-icon class="stone-icon" :icon="stone.selected ? 'mdi-check' : stone.icon" />
            <div class="stone-note">{{ stone.note }}</div>
            <div class="stone-active-glow" :style="{ opacity: active ? 0.26 + progress * 0.36 : 0.18 }" />
          </div>
        </template>
      </GameDwellButton>

      <v-card class="path-instruction pa-4 pa-md-5" color="surface" rounded="xl" elevation="6">
        <div class="text-caption text-medium-emphasis mb-1">Следующий шаг</div>
        <div class="d-flex align-center ga-3">
          <v-avatar color="primary" size="3rem">
            <span class="text-h5 font-weight-bold">{{ nextStone?.order ?? '✓' }}</span>
          </v-avatar>
          <div>
            <div class="text-h6 font-weight-bold">{{ nextStone ? `Камешек ${nextStone.order}: ${nextStone.note}` : 'Дорожка готова' }}</div>
            <div class="text-body-2 text-medium-emphasis">{{ feedbackMessage }}</div>
          </div>
        </div>
      </v-card>
    </main>

    <GameResultDialog
      :model-value="resultVisible"
      title="Музыкальная дорожка"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.musical-path-shell {
  background: linear-gradient(180deg, #f3f8ff 0%, #f7f1ff 48%, #edf8ef 100%);
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.path-stage {
  block-size: 100%;
  inline-size: 100%;
  position: relative;
}

.path-sky {
  background: radial-gradient(circle at 24% 24%, rgb(255 255 255 / 82%) 0 13%, transparent 28%),
    radial-gradient(circle at 78% 16%, rgb(255 243 210 / 58%) 0 10%, transparent 25%),
    radial-gradient(ellipse at 50% 85%, rgb(255 255 255 / 72%) 0%, rgb(255 255 255 / 26%) 35%, transparent 70%);
  block-size: 100%;
  inline-size: 100%;
  position: absolute;
}

.path-line {
  block-size: 100%;
  inline-size: 100%;
  inset: 0;
  position: absolute;
}

.path-line-shadow,
.path-line-glow {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.path-line-shadow {
  stroke: rgb(90 116 150 / 16%);
  stroke-width: 11;
}

.path-line-glow {
  stroke: rgb(120 155 210 / 28%);
  stroke-dasharray: 1 7;
  stroke-width: 6;
}

.path-stone-target {
  inline-size: clamp(8.875rem, 12vw, 11.5rem);
  inset-block-start: var(--stone-y);
  inset-inline-start: var(--stone-x);
  position: absolute;
  transform: translate(-50%, -50%);
}

.path-stone-target :deep(.dwell-button) {
  background: transparent !important;
  box-shadow: none;
  padding: 0 !important;
}

.path-stone-target :deep(.dwell-progress) {
  opacity: 0.64;
}

.path-stone {
  aspect-ratio: 1;
  background: radial-gradient(circle at 34% 26%, hsl(var(--stone-hue) 86% 95% / 0.96), hsl(var(--stone-hue) 58% 72% / 0.94) 43%, hsl(var(--stone-hue) 42% 52% / 0.98) 100%);
  border: 0.125rem solid hsl(var(--stone-hue) 80% 92% / 0.76);
  border-radius: 46% 54% 50% 50% / 52% 44% 56% 48%;
  box-shadow: 0 1.5rem 2.5rem hsl(var(--stone-hue) 40% 32% / 0.18), inset -0.875rem -1rem 1.75rem hsl(var(--stone-hue) 36% 34% / 0.22), inset 1rem 1rem 1.625rem rgb(255 255 255 / 0.34);
  color: rgb(39 52 74 / 86%);
  display: grid;
  min-block-size: 10.125rem;
  overflow: hidden;
  place-items: center;
  position: relative;
  transition: transform 220ms ease, filter 220ms ease, opacity 220ms ease;
}

.path-stone--active,
.path-stone-target--next.path-stone {
  transform: translateY(-0.25rem) scale(1.04);
}

.path-stone-target--next.path-stone {
  box-shadow: 0 0 0 0.5rem hsl(var(--stone-hue) 82% 78% / 0.2), 0 1.625rem 2.75rem hsl(var(--stone-hue) 40% 32% / 0.2), inset -0.875rem -1rem 1.75rem hsl(var(--stone-hue) 36% 34% / 0.2), inset 1rem 1rem 1.625rem rgb(255 255 255 / 0.36);
}

.path-stone--done {
  filter: saturate(0.8) brightness(1.08);
  opacity: 0.72;
}

.path-stone-target--soft-error.path-stone {
  animation: soft-error 760ms ease;
}

.stone-order {
  background: rgb(255 255 255 / 74%);
  border-radius: 999rem;
  font-size: 1.5rem;
  font-weight: 800;
  inline-size: 2.6rem;
  inset-block-start: 0.875rem;
  inset-inline-start: 0.875rem;
  line-height: 2.6rem;
  position: absolute;
  text-align: center;
  z-index: 2;
}

.stone-icon {
  font-size: clamp(3.4rem, 6vw, 4.8rem);
  opacity: 0.84;
  z-index: 2;
}

.stone-note {
  background: rgb(255 255 255 / 66%);
  border-radius: 999rem;
  font-size: 1.08rem;
  font-weight: 700;
  inset-block-end: 0.875rem;
  padding: 0.25rem 0.875rem;
  position: absolute;
  z-index: 2;
}

.stone-active-glow {
  background: radial-gradient(circle, rgb(255 255 255 / 92%) 0%, transparent 64%);
  block-size: 78%;
  border-radius: 999rem;
  filter: blur(0.3125rem);
  inline-size: 78%;
  position: absolute;
}

.note-spark {
  animation: note-spark 1800ms ease-out forwards;
  color: hsl(var(--spark-hue) 50% 36% / 0.88);
  font-size: clamp(1.7rem, 3.5vw, 2.7rem);
  font-weight: 800;
  inset-block-start: var(--spark-y);
  inset-inline-start: var(--spark-x);
  pointer-events: none;
  position: absolute;
  text-shadow: 0 0.5rem 1.375rem rgb(255 255 255 / 80%);
  transform: translate(-50%, -50%);
  z-index: 1;
}

.path-instruction {
  inline-size: min(32.5rem, calc(100dvw - 2rem));
  inset-block-end: 1.75rem;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

@keyframes note-spark {
  0% {
    opacity: 0;
    transform: translate(-50%, -20%) scale(0.76);
  }
  22% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -140%) scale(1.22);
  }
}

@keyframes soft-error {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  45% {
    transform: translateY(0.4375rem) scale(0.98);
  }
}

@media (max-width: 47.5rem) {
 .path-line {
    display: none;
  }

 .path-stone-target {
    inline-size: clamp(6.5rem, 28vw, 8.625rem);
    inset-block-start: var(--stone-mobile-y);
    inset-inline-start: var(--stone-mobile-x);
  }

 .path-stone {
    min-block-size: clamp(6.5rem, 28vw, 8.625rem);
  }

 .stone-order {
    font-size: 1.1rem;
    inline-size: 2rem;
    inset-block-start: 0.5rem;
    inset-inline-start: 0.5rem;
    line-height: 2rem;
  }

 .stone-note {
    font-size: 0.86rem;
    inset-block-end: 0.5rem;
    padding: 0.125rem 0.625rem;
  }

 .note-spark {
    inset-block-start: var(--spark-mobile-y);
    inset-inline-start: var(--spark-mobile-x);
  }

 .path-instruction {
    inset-block-end: 1rem;
  }
}

@media (min-width: 47.5625rem) and (max-width: 56.25rem), (max-height: 43.75rem) {
 .path-stone-target {
    inset-block-start: max(var(--stone-y), 13.125rem);
  }

 .note-spark {
    inset-block-start: max(var(--spark-y), 13.125rem);
  }
}
</style>
