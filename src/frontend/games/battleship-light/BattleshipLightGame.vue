<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { gameArtSrc } from "../../core/gameArt";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  allShipsSunk,
  battleshipColumnLetters,
  battleshipLayoutFor,
  cellRowColumn,
  createBattleshipBoard,
  isCellOpen,
  isShipSunk,
  shipAt,
  shootBattleship,
  type BattleshipBoard,
  type BattleshipShip,
} from "./model";

const router = useRouter();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  recordEvent,
  recordSuccess,
  startSession,
  finishSession,
} = useGameSessionFor("battleship-light", {
  maxSteps: 6,
  overrides: { sound: true, sessionSeconds: 600 },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false,
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "battleship-light",
  soundEnabled,
  warmAssetIds: ["battleship-light.prompt", "battleship-light.miss", "battleship-light.hit"],
});
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const layout = computed(() => battleshipLayoutFor(session.settings.preset));
const board = shallowRef<BattleshipBoard>(createBattleshipBoard(layout.value));
/** Bumped after every shot: the board keeps Sets, which Vue does not watch. */
const version = ref(0);
const pending = ref(false);
const lastShot = ref<{ index: number; text: string }>();
const resultVisible = computed(() => session.status === "finished");

const cells = computed(() => {
  void version.value;
  const b = board.value;
  return Array.from({ length: b.size * b.size }, (_, index) => {
    const ship = shipAt(b, index);
    const shot = b.shots.has(index);
    return {
      index,
      state: shot ? (ship ? "hit" : "miss") : b.cleared.has(index) ? "cleared" : "open",
    } as const;
  });
});

const sunkShips = computed(() => {
  void version.value;
  return board.value.ships.filter((ship) => isShipSunk(board.value, ship));
});

const fleet = computed(() => {
  void version.value;
  return board.value.ships.map((ship) => ({ ship, sunk: isShipSunk(board.value, ship) }));
});

const totalShipCells = computed(() => layout.value.ships.reduce((sum, length) => sum + length, 0));
const rowNumbers = computed(() => Array.from({ length: board.value.size }, (_, i) => i + 1));
const columnLetters = computed(() => battleshipColumnLetters.slice(0, board.value.size));

function cellTargetId(index: number) {
  return `battleship-light:cell:${index}`;
}

/** A sunk ship is drawn over its squares. */
function shipStyle(ship: BattleshipShip) {
  const size = board.value.size;
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

async function shoot(index: number) {
  if (session.status !== "running" || pending.value || !isCellOpen(board.value, index)) return;
  const outcome = shootBattleship(board.value, index);
  if (!outcome) return;
  version.value += 1;
  pending.value = true;
  const targetId = cellTargetId(index);

  if (outcome.result === "miss") {
    // A miss is part of the search, not a mistake.
    lastShot.value = { index, text: "Мимо" };
    recordEvent("target-click", { targetId, cell: index, result: "miss" });
    await promptAudio.playSequenceAndWait(["battleship-light.miss"], 40);
    pending.value = false;
    return;
  }

  recordSuccess({
    roundId: `battleship-light:shot:${index}`,
    targetId,
    isCorrect: true,
    cell: index,
  });
  void feedbackAudio.playSuccess();
  if (outcome.result === "hit") {
    lastShot.value = { index, text: "Попал!" };
    await promptAudio.playSequenceAndWait(["battleship-light.hit"], 40);
    pending.value = false;
    return;
  }

  lastShot.value = { index, text: "Корабль потоплен!" };
  recordEvent("target-click", {
    result: "sunk",
    shipId: outcome.ship?.id,
    length: outcome.ship?.length,
  });
  if (allShipsSunk(board.value)) {
    await promptAudio.playSequenceAndWait(["battleship-light.complete"], 40);
    finishSession("game-complete");
    pending.value = false;
    return;
  }
  await promptAudio.playSequenceAndWait(["battleship-light.sunk"], 40);
  pending.value = false;
}

function newBoard() {
  board.value = createBattleshipBoard(layout.value);
  version.value += 1;
  lastShot.value = undefined;
}

function restart() {
  promptAudio.cancelPending();
  pending.value = false;
  newBoard();
  startSession();
  void promptAudio.playSequenceAndWait(["battleship-light.prompt"], 220);
}

onMounted(() => {
  promptAudio.warm();
  void promptAudio.playSequenceAndWait(["battleship-light.prompt"], 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="battleship-shell">
    <GameHud
      title="Морской бой"
      :step="session.step"
      :max-steps="totalShipCells"
      :score="session.score"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />
    <v-container class="game-container game-hud-clear" fluid>
      <v-card class="pa-3 pa-md-4" rounded="xl" elevation="8">
        <div class="battle-layout">
          <section class="sea-frame" aria-label="Поле морского боя">
            <span class="sea-corner" aria-hidden="true" />
            <div class="sea-letters" aria-hidden="true">
              <span v-for="letter in columnLetters" :key="letter" class="sea-coord">{{
                letter
              }}</span>
            </div>
            <div class="sea-numbers" aria-hidden="true">
              <span v-for="number in rowNumbers" :key="number" class="sea-coord">{{ number }}</span>
            </div>
            <div
              class="sea"
              role="grid"
              :style="{ '--sea-size': board.size }"
              aria-label="Клетки поля соперника"
            >
              <GameDwellButton
                v-for="cell in cells"
                :key="cell.index"
                class="sea-cell"
                :class="`sea-cell--${cell.state}`"
                :target-id="cellTargetId(cell.index)"
                :disabled="session.status !== 'running' || pending || cell.state !== 'open'"
                :dwell-ms="session.settings.dwellMs"
                min-height="0"
                color="transparent"
                @select="shoot(cell.index)"
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
                    class="sea-mark sea-mark--fire"
                    :src="gameArtSrc('battleship-light/fire')"
                    alt="Попадание"
                  />
                  <span v-else-if="cell.state === 'cleared'" class="sea-dot" aria-label="Пусто" />
                </template>
              </GameDwellButton>
              <div
                v-for="ship in sunkShips"
                :key="ship.id"
                class="sunk-ship"
                :class="`sunk-ship--${ship.orientation}`"
                :style="shipStyle(ship)"
              >
                <img
                  class="sunk-ship__art"
                  :src="gameArtSrc(`battleship-light/ship-${ship.length}`)"
                  alt=""
                />
              </div>
            </div>
          </section>

          <aside class="battle-side">
            <h1 class="text-h5 text-md-h4 font-weight-bold mb-2">Найди корабли</h1>
            <p class="text-body-1 text-md-h6 text-medium-emphasis mb-3">
              Посмотри на клетку, чтобы выстрелить.
            </p>
            <div class="shot-result text-h5 text-md-h4 font-weight-bold mb-3" aria-live="polite">
              {{ lastShot?.text ?? "" }}
            </div>
            <div class="fleet" aria-label="Корабли соперника">
              <div
                v-for="item in fleet"
                :key="item.ship.id"
                class="fleet-ship"
                :class="{ 'fleet-ship--sunk': item.sunk }"
              >
                <img
                  class="fleet-ship__art"
                  :style="{ '--ship-length': item.ship.length }"
                  :src="gameArtSrc(`battleship-light/ship-${item.ship.length}`)"
                  alt=""
                />
                <v-icon v-if="item.sunk" class="fleet-ship__done" icon="mdi-check-circle" />
                <span class="d-sr-only">{{
                  item.sunk ? "потоплен" : `корабль на ${item.ship.length} клетки`
                }}</span>
              </div>
            </div>
          </aside>
        </div>
      </v-card>
    </v-container>
    <GameResultDialog
      :model-value="resultVisible"
      title="Морской бой"
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
.battleship-shell {
  background: var(--linka-scene-paper);
  min-block-size: 100vh;
}

.battle-layout {
  align-items: center;
  display: grid;
  gap: clamp(1rem, 3vw, 2.5rem);
  grid-template-columns: auto minmax(14rem, 22rem);
  justify-content: center;
}

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
  grid-template-columns: repeat(var(--sea-size, 5), minmax(0, 1fr));
}

.sea-numbers {
  grid-area: numbers;
  grid-template-rows: repeat(var(--sea-size, 5), minmax(0, 1fr));
}

.sea-coord {
  align-items: center;
  color: rgba(var(--v-theme-on-surface), 0.7);
  display: flex;
  font-size: clamp(0.9rem, 2.4dvh, 1.4rem);
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
  inline-size: min(calc(100dvh - 15.5rem), 58vw, 40rem);
  overflow: hidden;
  position: relative;
}

.sea-cell {
  aspect-ratio: 1;
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

.sea-cell--open :deep(.dwell-button:hover) {
  background: rgba(255, 255, 255, 0.18) !important;
}

.sea-mark {
  aspect-ratio: 1;
  block-size: auto;
  inline-size: 80%;
  object-fit: contain;
  pointer-events: none;
}

.sea-mark--fire {
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

.sunk-ship {
  container-type: size;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

.sunk-ship__art {
  block-size: 100%;
  inline-size: 100%;
  object-fit: fill;
  padding: 4%;
}

/* The drawing lies horizontally: a vertical ship is the same picture turned. */
.sunk-ship--vertical .sunk-ship__art {
  block-size: 100cqw;
  inline-size: 100cqh;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  padding: 2% 4%;
  position: absolute;
  transform: translate(-50%, -50%) rotate(90deg);
}

.battle-side {
  min-inline-size: 0;
}

.shot-result {
  color: rgb(var(--v-theme-primary));
  min-block-size: 1.4em;
}

.fleet {
  display: grid;
  gap: clamp(0.4rem, 1.4dvh, 0.9rem);
}

.fleet-ship {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.fleet-ship__art {
  block-size: clamp(2rem, 6dvh, 3.5rem);
  inline-size: calc(var(--ship-length) * clamp(2rem, 6dvh, 3.5rem));
  object-fit: fill;
}

.fleet-ship--sunk .fleet-ship__art {
  filter: grayscale(0.7);
  opacity: 0.45;
}

.fleet-ship__done {
  color: rgb(var(--v-theme-success));
  font-size: clamp(1.5rem, 4dvh, 2.4rem);
}

@media (max-width: 52rem) {
  .battle-layout {
    grid-template-columns: 1fr;
  }

  .sea {
    inline-size: min(84vw, calc(100dvh - 22rem), 36rem);
  }
}
</style>
