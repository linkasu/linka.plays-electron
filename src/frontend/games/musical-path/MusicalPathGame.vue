<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeMusicalPathAudio, playMusicalPathComplete, playMusicalPathNote, warmMusicalPathAudio } from "./audio";

type PathStone = {
  id: string;
  order: number;
  note: string;
  icon: string;
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
  hue: number;
  selected: boolean;
  softError: boolean;
};

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
const stones = reactive<PathStone[]>(createStones());
const sparks = reactive<Spark[]>([]);
const feedbackMessage = ref("Начни с подсвеченного камешка 1 и иди по дорожке дальше.");
const pathPoints = computed(() => stones.map((stone) => `${stone.x},${stone.y}`).join(" "));
let errorTimer = 0;
let sparkTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("musical-path", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1250,
  sessionSeconds: 130,
  targetScale: 1.45,
  motionSpeed: 0.42,
  distractors: "none",
  hints: "high",
  sound: true
}, {
  finishOnMistakes: false
});

const resultVisible = computed(() => session.status === "finished");
const nextStone = computed(() => stones.find((stone) => !stone.selected && stone.order === session.step + 1));

function createStones(): PathStone[] {
  return [
    { id: "do-low", order: 1, note: "до", icon: "mdi-music-note", x: 13, y: 72, mobileX: 24, mobileY: 81, hue: 198, selected: false, softError: false },
    { id: "re", order: 2, note: "ре", icon: "mdi-music-note-eighth", x: 25, y: 51, mobileX: 67, mobileY: 73, hue: 222, selected: false, softError: false },
    { id: "mi", order: 3, note: "ми", icon: "mdi-music-note", x: 37, y: 66, mobileX: 31, mobileY: 62, hue: 263, selected: false, softError: false },
    { id: "fa", order: 4, note: "фа", icon: "mdi-music-clef-treble", x: 49, y: 44, mobileX: 72, mobileY: 53, hue: 286, selected: false, softError: false },
    { id: "sol", order: 5, note: "соль", icon: "mdi-music-note-eighth", x: 61, y: 62, mobileX: 29, mobileY: 43, hue: 154, selected: false, softError: false },
    { id: "la", order: 6, note: "ля", icon: "mdi-music-note", x: 72, y: 39, mobileX: 69, mobileY: 34, hue: 124, selected: false, softError: false },
    { id: "si", order: 7, note: "си", icon: "mdi-music-clef-treble", x: 83, y: 55, mobileX: 34, mobileY: 24, hue: 36, selected: false, softError: false },
    { id: "do-high", order: 8, note: "до", icon: "mdi-music-note", x: 91, y: 31, mobileX: 72, mobileY: 15, hue: 14, selected: false, softError: false }
  ];
}

function stoneStyle(stone: PathStone) {
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

function targetId(stone: PathStone) {
  return `musical-path:${stone.order}:${stone.id}`;
}

function resetStones() {
  window.clearTimeout(errorTimer);
  window.clearTimeout(sparkTimer);
  stones.splice(0, stones.length, ...createStones());
  sparks.splice(0);
  feedbackMessage.value = "Начни с подсвеченного камешка 1 и иди по дорожке дальше.";
}

function addSpark(stone: PathStone) {
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

function showSoftError(stone: PathStone) {
  stone.softError = true;
  feedbackMessage.value = `Этот камешек подождёт. Сейчас нужен камешек ${nextStone.value?.order ?? session.step + 1}.`;
  window.clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => {
    stone.softError = false;
  }, 1100);
}

function chooseStone(stone: PathStone) {
  if (session.status !== "running" || stone.selected) return;

  const expectedStone = nextStone.value;
  const roundId = `musical-path:step:${session.step + 1}`;
  if (stone.id !== expectedStone?.id) {
    recordMistake({
      roundId,
      targetId: targetId(stone),
      expectedTargetId: expectedStone ? targetId(expectedStone) : undefined,
      expected: expectedStone?.order,
      actual: stone.order,
      isCorrect: false
    });
    showSoftError(stone);
    return;
  }

  stone.selected = true;
  addSpark(stone);
  feedbackMessage.value = stone.order === session.maxSteps ? "Дорожка собрана. Мелодия завершилась мягко." : `Верно: ${stone.note}. Теперь камешек ${stone.order + 1}.`;
  recordSuccess({ roundId, targetId: targetId(stone), note: stone.note, order: stone.order, isCorrect: true });

  if (stone.order >= session.maxSteps) void playMusicalPathComplete(session.settings.sound);
  else void playMusicalPathNote(session.settings.sound, stone.order - 1);
}

function restart() {
  resetStones();
  startSession();
}

onMounted(() => {
  warmMusicalPathAudio(session.settings.sound);
});

onUnmounted(() => {
  window.clearTimeout(errorTimer);
  window.clearTimeout(sparkTimer);
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
        :disabled="session.status !== 'running' || stone.selected"
        :min-height="178"
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
          <v-avatar color="primary" size="48">
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
  block-size: 100vh;
  inline-size: 100vw;
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
  inline-size: clamp(142px, 12vw, 184px);
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
  border: 2px solid hsl(var(--stone-hue) 80% 92% / 0.76);
  border-radius: 46% 54% 50% 50% / 52% 44% 56% 48%;
  box-shadow: 0 24px 40px hsl(var(--stone-hue) 40% 32% / 0.18), inset -14px -16px 28px hsl(var(--stone-hue) 36% 34% / 0.22), inset 16px 16px 26px rgb(255 255 255 / 0.34);
  color: rgb(39 52 74 / 86%);
  display: grid;
  min-block-size: 162px;
  overflow: hidden;
  place-items: center;
  position: relative;
  transition: transform 220ms ease, filter 220ms ease, opacity 220ms ease;
}

.path-stone--active,
.path-stone-target--next .path-stone {
  transform: translateY(-4px) scale(1.04);
}

.path-stone-target--next .path-stone {
  box-shadow: 0 0 0 8px hsl(var(--stone-hue) 82% 78% / 0.2), 0 26px 44px hsl(var(--stone-hue) 40% 32% / 0.2), inset -14px -16px 28px hsl(var(--stone-hue) 36% 34% / 0.2), inset 16px 16px 26px rgb(255 255 255 / 0.36);
}

.path-stone--done {
  filter: saturate(0.8) brightness(1.08);
  opacity: 0.72;
}

.path-stone-target--soft-error .path-stone {
  animation: soft-error 760ms ease;
}

.stone-order {
  background: rgb(255 255 255 / 74%);
  border-radius: 999px;
  font-size: 1.5rem;
  font-weight: 800;
  inline-size: 2.6rem;
  inset-block-start: 14px;
  inset-inline-start: 14px;
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
  border-radius: 999px;
  font-size: 1.08rem;
  font-weight: 700;
  inset-block-end: 14px;
  padding: 4px 14px;
  position: absolute;
  z-index: 2;
}

.stone-active-glow {
  background: radial-gradient(circle, rgb(255 255 255 / 92%) 0%, transparent 64%);
  block-size: 78%;
  border-radius: 999px;
  filter: blur(5px);
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
  text-shadow: 0 8px 22px rgb(255 255 255 / 80%);
  transform: translate(-50%, -50%);
  z-index: 1;
}

.path-instruction {
  inline-size: min(520px, calc(100vw - 32px));
  inset-block-end: 28px;
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
    transform: translateY(7px) scale(0.98);
  }
}

@media (max-width: 760px) {
  .path-line {
    display: none;
  }

  .path-stone-target {
    inline-size: clamp(104px, 28vw, 138px);
    inset-block-start: var(--stone-mobile-y);
    inset-inline-start: var(--stone-mobile-x);
  }

  .path-stone {
    min-block-size: clamp(104px, 28vw, 138px);
  }

  .stone-order {
    font-size: 1.1rem;
    inline-size: 2rem;
    inset-block-start: 8px;
    inset-inline-start: 8px;
    line-height: 2rem;
  }

  .stone-note {
    font-size: 0.86rem;
    inset-block-end: 8px;
    padding: 2px 10px;
  }

  .note-spark {
    inset-block-start: var(--spark-mobile-y);
    inset-inline-start: var(--spark-mobile-x);
  }

  .path-instruction {
    inset-block-end: 16px;
  }
}

@media (min-width: 761px) and (max-width: 900px), (max-height: 700px) {
  .path-stone-target {
    inset-block-start: max(var(--stone-y), 210px);
  }

  .note-spark {
    inset-block-start: max(var(--spark-y), 210px);
  }
}
</style>
