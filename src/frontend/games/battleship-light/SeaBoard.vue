<script setup lang="ts">
import { computed } from "vue";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import { gameArtSrc } from "../../core/gameArt";
import {
  battleshipColumnLetters,
  cellRowColumn,
  isShipSunk,
  shipAt,
  type BattleshipBoard,
  type BattleshipShip,
} from "./model";

/**
 * One sea field with letters on top and numbers on the left.
 * - "shoot": every open square is a gaze target (the computer's field);
 * - "place": squares where `canSelect` allows are targets (placing own ships);
 * - "none": only shows the field (own field during the battle), no gaze targets.
 */
const props = withDefaults(
  defineProps<{
    board: BattleshipBoard;
    /** Bumped by the parent after every change: the board keeps Sets, which Vue does not watch. */
    version: number;
    mode: "shoot" | "place" | "none";
    /** Draw every ship (own field), not only sunk ones. */
    showShips?: boolean;
    canSelect?: (index: number) => boolean;
    disabled?: boolean;
    dwellMs: number;
    targetPrefix: string;
    /** CSS size of the square field. */
    size: string;
    label: string;
  }>(),
  { showShips: false, canSelect: undefined, disabled: false },
);

const emit = defineEmits<{ select: [index: number] }>();

const cells = computed(() => {
  void props.version;
  const b = props.board;
  return Array.from({ length: b.size * b.size }, (_, index) => {
    const ship = shipAt(b, index);
    const shot = b.shots.has(index);
    const state = shot ? (ship ? "hit" : "miss") : b.cleared.has(index) ? "cleared" : "open";
    const selectable =
      !props.disabled &&
      (props.mode === "shoot"
        ? state === "open"
        : props.mode === "place"
          ? (props.canSelect?.(index) ?? false)
          : false);
    return { index, state, selectable } as const;
  });
});

const drawnShips = computed(() => {
  void props.version;
  return props.board.ships
    .filter((ship) => props.showShips || isShipSunk(props.board, ship))
    .map((ship) => ({ ship, sunk: isShipSunk(props.board, ship) }));
});

const letters = computed(() => battleshipColumnLetters.slice(0, props.board.size));
const numbers = computed(() => Array.from({ length: props.board.size }, (_, i) => i + 1));

function shipStyle(ship: BattleshipShip) {
  const size = props.board.size;
  const { row, column } = cellRowColumn(size, ship.cells[0]);
  const along = `${(ship.length / size) * 100}%`;
  const across = `${(1 / size) * 100}%`;
  return {
    insetInlineStart: `${(column / size) * 100}%`,
    insetBlockStart: `${(row / size) * 100}%`,
    inlineSize: ship.orientation === "horizontal" ? along : across,
    blockSize: ship.orientation === "horizontal" ? across : along,
  };
}
</script>

<template>
  <section
    class="sea-frame"
    :style="{ '--sea-size': board.size, '--sea-px': size }"
    :aria-label="label"
  >
    <span class="sea-corner" aria-hidden="true" />
    <div class="sea-letters" aria-hidden="true">
      <span v-for="letter in letters" :key="letter" class="sea-coord">{{ letter }}</span>
    </div>
    <div class="sea-numbers" aria-hidden="true">
      <span v-for="number in numbers" :key="number" class="sea-coord">{{ number }}</span>
    </div>
    <div class="sea" role="grid">
      <template v-for="cell in cells" :key="cell.index">
        <GameDwellButton
          v-if="mode !== 'none'"
          class="sea-cell"
          :class="[
            `sea-cell--${cell.state}`,
            {
              'sea-cell--selectable': cell.selectable,
              'sea-cell--blocked': mode === 'place' && !cell.selectable,
            },
          ]"
          :target-id="`${targetPrefix}:${cell.index}`"
          :disabled="!cell.selectable"
          :dwell-ms="dwellMs"
          min-height="0"
          color="transparent"
          @select="emit('select', cell.index)"
        >
          <template #default>
            <img
              v-if="cell.state === 'miss'"
              class="sea-mark"
              :src="gameArtSrc('battleship-light/splash')"
              alt="Мимо"
            />
            <img
              v-else-if="cell.state === 'hit'"
              class="sea-mark"
              :src="gameArtSrc('battleship-light/fire')"
              alt="Попадание"
            />
            <span v-else-if="cell.state === 'cleared'" class="sea-dot" aria-label="Пусто" />
          </template>
        </GameDwellButton>
        <div v-else class="sea-cell sea-cell--static" :class="`sea-cell--${cell.state}`">
          <img
            v-if="cell.state === 'miss'"
            class="sea-mark"
            :src="gameArtSrc('battleship-light/splash')"
            alt="Мимо"
          />
          <img
            v-else-if="cell.state === 'hit'"
            class="sea-mark sea-mark--over"
            :src="gameArtSrc('battleship-light/fire')"
            alt="Попадание"
          />
          <span v-else-if="cell.state === 'cleared'" class="sea-dot" aria-label="Пусто" />
        </div>
      </template>
      <div
        v-for="item in drawnShips"
        :key="item.ship.id"
        class="sea-ship"
        :class="[
          `sea-ship--${item.ship.orientation}`,
          { 'sea-ship--sunk': item.sunk && showShips },
        ]"
        :style="shipStyle(item.ship)"
      >
        <img
          class="sea-ship__art"
          :src="gameArtSrc(`battleship-light/ship-${item.ship.length}`)"
          alt=""
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Letters along the top and numbers on the left, as in the paper game. */
.sea-frame {
  display: grid;
  gap: 0.3rem;
  grid-template-areas:
    "corner letters"
    "numbers sea";
  grid-template-columns: auto auto;
}

.sea-corner {
  grid-area: corner;
}

.sea-letters,
.sea-numbers {
  display: grid;
}

.sea-letters {
  grid-area: letters;
  grid-template-columns: repeat(var(--sea-size), minmax(0, 1fr));
}

.sea-numbers {
  grid-area: numbers;
  grid-template-rows: repeat(var(--sea-size), minmax(0, 1fr));
}

.sea-coord {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), 0.7);
  display: flex;
  font-size: clamp(0.8rem, 2.2dvh, 1.35rem);
  font-weight: 800;
  justify-content: center;
}

.sea {
  aspect-ratio: 1;
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.35), transparent 40%),
    linear-gradient(160deg, #6ec6f0 0%, #3b9bd6 100%);
  border-radius: clamp(0.5rem, 1.4dvh, 1rem);
  display: grid;
  grid-area: sea;
  grid-template-columns: repeat(var(--sea-size), minmax(0, 1fr));
  inline-size: var(--sea-px);
  overflow: hidden;
  position: relative;
}

.sea-cell {
  aspect-ratio: 1;
}

.sea-cell--static {
  align-items: center;
  border: 0.06rem solid rgba(255, 255, 255, 0.55);
  display: flex;
  justify-content: center;
}

/* Thin lines of the grid on the water. */
.sea-cell :deep(.dwell-button) {
  border: 0.06rem solid rgba(255, 255, 255, 0.55);
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
}

/* A shot square is disabled; Vuetify would fade its splash or fire. */
.sea-cell :deep(.v-card--disabled > *) {
  opacity: 1;
}

/* Placing ships: a ship cannot start here (it would touch another or leave the field). */
.sea-cell--blocked :deep(.dwell-button) {
  background: rgba(13, 47, 79, 0.35) !important;
}

.sea-cell--selectable :deep(.dwell-button:hover) {
  background: rgba(255, 255, 255, 0.22) !important;
}

.sea-mark {
  aspect-ratio: 1;
  block-size: auto;
  inline-size: 80%;
  object-fit: contain;
  pointer-events: none;
}

/* On the own field the fire stays above the drawn ship. */
.sea-mark--over {
  position: relative;
  z-index: 3;
}

/* A square next to a sunk ship: surely empty. */
.sea-dot {
  background: rgba(255, 255, 255, 0.75);
  block-size: 18%;
  border-radius: 50%;
  inline-size: 18%;
}

.sea-ship {
  container-type: size;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

.sea-ship--sunk {
  filter: grayscale(0.8);
  opacity: 0.6;
}

.sea-ship__art {
  block-size: 100%;
  inline-size: 100%;
  object-fit: fill;
  padding: 4%;
}

/* The drawing lies horizontally: a vertical ship is the same picture turned. */
.sea-ship--vertical .sea-ship__art {
  block-size: 100cqw;
  inline-size: 100cqh;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  padding: 2% 4%;
  position: absolute;
  transform: translate(-50%, -50%) rotate(90deg);
}
</style>
