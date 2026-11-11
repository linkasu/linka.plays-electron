<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import {
  checkersPuzzleSize,
  checkersPuzzleTask,
  checkersPuzzleTaskAssetId,
  createCheckersPuzzle,
  isPuzzleDarkCell,
  puzzleCaptureLanding,
  puzzleSteps,
  type CheckersPuzzle,
} from "./puzzles";

const props = defineProps<{
  dwellMs: number;
  sound: boolean;
  running: boolean;
  /** Puzzles solved so far: the next puzzle's number. */
  solved: number;
}>();

const emit = defineEmits<{
  solved: [puzzle: CheckersPuzzle];
  failed: [puzzle: CheckersPuzzle];
}>();

const promptAudio = useGamePromptAudio({
  gameId: "checkers-light",
  soundEnabled: toRef(props, "sound"),
  warmAssetIds: ["checkers-light.puzzle-done", "checkers-light.puzzle-retry"],
});

const puzzle = ref<CheckersPuzzle>(createCheckersPuzzle(props.solved));
const position = ref(puzzle.value.start);
const blue = ref<number | undefined>(puzzle.value.target);
const movesLeft = ref(puzzle.value.moves);
const pending = ref(false);

const task = computed(() => checkersPuzzleTask(puzzle.value.moves));
const landing = computed(() => puzzleCaptureLanding(position.value, blue.value));
const steps = computed(() => new Set(puzzleSteps(position.value, blue.value)));
const cells = Array.from({ length: checkersPuzzleSize ** 2 }, (_, index) => index);

function canGo(index: number) {
  return !pending.value && (steps.value.has(index) || index === landing.value);
}

function squareColor(index: number) {
  return isPuzzleDarkCell(index) ? "#8d5a3b" : "#f3e0bf";
}

async function playTask(delayMs = 0) {
  pending.value = true;
  await promptAudio.playSequenceAndWait([checkersPuzzleTaskAssetId(puzzle.value.moves)], delayMs);
  pending.value = false;
}

function resetPuzzle() {
  position.value = puzzle.value.start;
  blue.value = puzzle.value.target;
  movesLeft.value = puzzle.value.moves;
}

async function moveTo(index: number) {
  if (!props.running || !canGo(index)) return;
  const takes = index === landing.value;
  position.value = index;
  movesLeft.value -= 1;
  if (takes) {
    blue.value = undefined;
    pending.value = true;
    emit("solved", puzzle.value);
    await promptAudio.playSequenceAndWait(["checkers-light.puzzle-done"], 120);
    nextPuzzle();
    return;
  }
  const stuck = puzzleSteps(index, blue.value).length === 0 && landing.value === undefined;
  if (movesLeft.value === 0 || stuck) {
    pending.value = true;
    emit("failed", puzzle.value);
    await promptAudio.playSequenceAndWait(["checkers-light.puzzle-retry"], 160);
    // The same puzzle again from its start.
    resetPuzzle();
    pending.value = false;
  }
}

function nextPuzzle() {
  puzzle.value = createCheckersPuzzle(props.solved);
  resetPuzzle();
  if (props.running) void playTask(250);
  else pending.value = false;
}

onMounted(() => {
  promptAudio.warm();
  void playTask(300);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="puzzle-layout">
    <div class="puzzle-board" role="grid" :aria-label="task">
      <GameDwellButton
        v-for="index in cells"
        :key="`${puzzle.id}:${index}`"
        class="puzzle-cell"
        :target-id="`checkers-light:puzzle:${index}`"
        :disabled="!running || !canGo(index)"
        :dwell-ms="dwellMs"
        min-height="0"
        :color="squareColor(index)"
        @select="moveTo(index)"
      >
        <template #default>
          <span
            v-if="canGo(index)"
            :class="['puzzle-step', { 'puzzle-step--take': index === landing }]"
            aria-hidden="true"
          />
          <div v-if="index === position" class="piece piece--gold" aria-label="твоя шашка" />
          <div
            v-else-if="index === blue"
            :class="['piece', 'piece--blue', { 'piece--can-take': landing !== undefined }]"
            aria-label="синяя шашка"
          />
        </template>
      </GameDwellButton>
    </div>
    <aside class="puzzle-side">
      <h1 class="text-h5 text-md-h4 font-weight-bold mb-3">{{ task }}</h1>
      <div class="moves-left text-h5 text-md-h4 font-weight-bold" aria-live="polite">
        Осталось ходов: {{ movesLeft }}
      </div>
      <p class="text-body-1 text-md-h6 text-medium-emphasis mt-3 mb-0">
        Зелёный кружок — шаг, оранжевый — съесть синюю шашку.
      </p>
    </aside>
  </div>
</template>

<style scoped>
.puzzle-layout {
  align-items: center;
  display: grid;
  gap: clamp(1rem, 3vw, 2.5rem);
  grid-template-columns: auto minmax(13rem, 24rem);
  justify-content: center;
}

.puzzle-board {
  aspect-ratio: 1;
  border-radius: clamp(0.5rem, 1.4dvh, 1rem);
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  inline-size: min(calc(100dvh - 15rem), 54vw, 40rem);
  overflow: hidden;
}

.puzzle-cell {
  aspect-ratio: 1;
}

.puzzle-cell :deep(.dwell-button) {
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
  position: relative;
}

/* Disabled squares keep their colour and pieces. */
.puzzle-cell :deep(.v-card--disabled > *) {
  opacity: 1;
}

.piece {
  aspect-ratio: 1;
  border-radius: 50%;
  box-shadow:
    inset 0 0 0 0.18rem rgb(255 255 255 / 35%),
    inset 0 -0.3rem 0 rgb(0 0 0 / 22%),
    0 0.2rem 0.35rem rgb(0 0 0 / 35%);
  inline-size: 74%;
}

.piece--gold {
  background: radial-gradient(circle at 35% 30%, #ffd77a, #d38b00 70%);
}

.piece--blue {
  background: radial-gradient(circle at 35% 30%, #8cc4ff, #1565c0 70%);
}

/* The blue checker can be taken now. */
.piece--can-take {
  animation: can-take 0.8s ease-in-out infinite alternate;
  outline: 0.3rem solid #ff7043;
  outline-offset: 0.15rem;
}

@keyframes can-take {
  to {
    outline-color: rgb(255 112 67 / 30%);
  }
}

.puzzle-step {
  background: rgb(76 175 80 / 80%);
  block-size: 34%;
  border: 0.18rem solid rgb(255 255 255 / 85%);
  border-radius: 50%;
  box-shadow: 0 0 0.6rem rgb(56 142 60 / 60%);
  inline-size: 34%;
  inset: 0;
  margin: auto;
  pointer-events: none;
  position: absolute;
}

.puzzle-step--take {
  background: rgb(255 112 67 / 85%);
}

.moves-left {
  background: rgba(var(--v-theme-primary), 0.12);
  border-radius: 1rem;
  color: rgb(var(--v-theme-primary));
  display: inline-block;
  padding: 0.4rem 1rem;
}

@media (max-width: 40rem) {
  .puzzle-layout {
    grid-template-columns: 1fr;
  }
}
</style>
