<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { gameArtSrc } from "../../core/gameArt";
import {
  createChessPuzzle,
  pieceMoves,
  puzzleGoals,
  puzzlePieceNames,
  puzzleTask,
  puzzleTaskAssetId,
  type ChessPuzzle,
} from "./puzzles";

const props = defineProps<{
  dwellMs: number;
  sound: boolean;
  running: boolean;
  /** Puzzles solved so far: the next puzzle's number. */
  solved: number;
}>();

const emit = defineEmits<{
  solved: [puzzle: ChessPuzzle, movesUsed: number];
  failed: [puzzle: ChessPuzzle];
}>();

const promptAudio = useGamePromptAudio({
  gameId: "chess-mini",
  soundEnabled: toRef(props, "sound"),
  warmAssetIds: ["chess-mini.puzzle-done", "chess-mini.puzzle-retry"],
});

const puzzle = ref<ChessPuzzle>(createChessPuzzle(props.solved));
const position = ref(puzzle.value.start);
const movesLeft = ref(puzzle.value.moves);
const pending = ref(false);
const reached = ref(false);

const task = computed(() => puzzleTask(puzzle.value.piece, puzzle.value.goal, puzzle.value.moves));
const reachable = computed(
  () => new Set(pieceMoves(puzzle.value.piece, puzzle.value.size, position.value)),
);
const letters = computed(() => ["A", "B", "C", "D", "E", "F"].slice(0, puzzle.value.size));
const numbers = computed(() =>
  Array.from({ length: puzzle.value.size }, (_, i) => puzzle.value.size - i),
);
const pieceArt = computed(() => gameArtSrc(`chess-mini/white-${pieceSlug(puzzle.value.piece)}`));

function pieceSlug(piece: ChessPuzzle["piece"]) {
  return { R: "rook", B: "bishop", N: "knight", Q: "queen", K: "king" }[piece];
}

// Testers: «дойти до ягодки невозможно — фигура ходит по диагоналям белых, а ягодка на чёрной».
// The squares a piece could go to were repainted light green, so a bishop's dark diagonal
// looked white next to the berry on a dark square. A square keeps its colour now; a green
// dot marks where the piece can go.
function squareColor(index: number) {
  const size = puzzle.value.size;
  const light = (Math.floor(index / size) + (index % size)) % 2 === 0;
  return light ? "#f0d9b5" : "#b58863";
}

function canStep(index: number) {
  return reachable.value.has(index) && !pending.value;
}

async function playTask(delayMs = 0) {
  pending.value = true;
  await promptAudio.playSequenceAndWait(
    [puzzleTaskAssetId(puzzle.value.piece, puzzle.value.goal, puzzle.value.moves)],
    delayMs,
  );
  pending.value = false;
}

async function moveTo(index: number) {
  if (!props.running || pending.value || !reachable.value.has(index)) return;
  position.value = index;
  movesLeft.value -= 1;
  if (index === puzzle.value.target) {
    reached.value = true;
    pending.value = true;
    emit("solved", puzzle.value, puzzle.value.moves - movesLeft.value);
    await promptAudio.playSequenceAndWait(["chess-mini.puzzle-done"], 120);
    nextPuzzle();
    return;
  }
  if (movesLeft.value === 0) {
    pending.value = true;
    emit("failed", puzzle.value);
    await promptAudio.playSequenceAndWait(["chess-mini.puzzle-retry"], 160);
    // The same puzzle again from its start.
    position.value = puzzle.value.start;
    movesLeft.value = puzzle.value.moves;
    pending.value = false;
  }
}

function nextPuzzle() {
  puzzle.value = createChessPuzzle(props.solved);
  position.value = puzzle.value.start;
  movesLeft.value = puzzle.value.moves;
  reached.value = false;
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

defineExpose({ nextPuzzle });
</script>

<template>
  <div class="puzzle-layout">
    <section class="puzzle-board-frame" :style="{ '--puzzle-size': puzzle.size }">
      <div class="puzzle-numbers" aria-hidden="true">
        <span v-for="n in numbers" :key="n" class="puzzle-coord">{{ n }}</span>
      </div>
      <div class="puzzle-board" role="grid" :aria-label="task">
        <GameDwellButton
          v-for="index in puzzle.size * puzzle.size"
          :key="`${puzzle.id}:${index - 1}`"
          class="puzzle-cell"
          :target-id="`chess-mini:puzzle:${index - 1}`"
          :disabled="!running || pending || !reachable.has(index - 1)"
          :dwell-ms="dwellMs"
          min-height="0"
          :color="squareColor(index - 1)"
          @select="moveTo(index - 1)"
        >
          <template #default>
            <span
              v-if="canStep(index - 1)"
              :class="[
                'puzzle-step',
                { 'puzzle-step--ring': index - 1 === puzzle.target && !reached },
              ]"
              aria-hidden="true"
            />
            <img
              v-if="index - 1 === position"
              class="puzzle-piece"
              :src="pieceArt"
              :alt="puzzlePieceNames[puzzle.piece].name"
            />
            <GameWordImage
              v-else-if="index - 1 === puzzle.target && !reached"
              class="puzzle-goal"
              :word-id="puzzleGoals[puzzle.goal].wordId"
              :word="puzzle.goal === 'berry' ? 'ягодка' : 'гриб'"
              emoji=""
              decorative
            />
          </template>
        </GameDwellButton>
      </div>
      <span class="puzzle-corner" aria-hidden="true" />
      <div class="puzzle-letters" aria-hidden="true">
        <span v-for="letter in letters" :key="letter" class="puzzle-coord">{{ letter }}</span>
      </div>
    </section>
    <aside class="puzzle-side">
      <h1 class="text-h5 text-md-h4 font-weight-bold mb-3">{{ task }}</h1>
      <div class="moves-left text-h5 text-md-h4 font-weight-bold" aria-live="polite">
        Осталось ходов: {{ movesLeft }}
      </div>
      <p class="text-body-1 text-md-h6 text-medium-emphasis mt-3 mb-0">
        Зелёный кружок — туда фигура может пойти.
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

.puzzle-board-frame {
  display: grid;
  gap: 0.3rem;
  grid-template-columns: auto auto;
}

.puzzle-numbers {
  display: grid;
  grid-template-rows: repeat(var(--puzzle-size), minmax(0, 1fr));
}

.puzzle-letters {
  display: grid;
  grid-template-columns: repeat(var(--puzzle-size), minmax(0, 1fr));
}

.puzzle-coord {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), 0.68);
  display: flex;
  font-size: clamp(0.8rem, 2dvh, 1.2rem);
  font-weight: 800;
  justify-content: center;
}

.puzzle-board {
  border-radius: clamp(0.5rem, 1.4dvh, 1rem);
  display: grid;
  grid-template-columns: repeat(var(--puzzle-size), minmax(0, 1fr));
  inline-size: min(calc(100dvh - 15.5rem), 54vw, 40rem);
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
}

/* Disabled squares keep their colour and picture. */
.puzzle-cell :deep(.v-card--disabled > *) {
  opacity: 1;
}

.puzzle-cell :deep(.dwell-button) {
  position: relative;
}

.puzzle-step {
  background: rgb(76 175 80 / 72%);
  block-size: 34%;
  border: 0.18rem solid rgb(255 255 255 / 85%);
  border-radius: 50%;
  box-shadow: 0 0 0.6rem rgb(56 142 60 / 60%);
  inline-size: 34%;
  inset: 0;
  margin: auto;
  pointer-events: none;
  position: absolute;
  z-index: 1;
}

/* Around the berry: a ring, so the berry stays seen. */
.puzzle-step--ring {
  background: transparent;
  block-size: 86%;
  border: 0.3rem solid rgb(76 175 80 / 90%);
  inline-size: 86%;
}

.puzzle-piece {
  block-size: 88%;
  filter: drop-shadow(0 0.2rem 0.24rem rgba(0, 0, 0, 0.25));
  inline-size: 88%;
  object-fit: contain;
}

.puzzle-goal {
  font-size: clamp(2.5rem, 9dvh, 5.5rem);
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
