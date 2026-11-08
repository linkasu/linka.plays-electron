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
  battleshipLayoutFor,
  canPlaceShip,
  chooseComputerShot,
  createBattleshipBoard,
  createBattleshipBoardFromShips,
  isCellOpen,
  isShipSunk,
  placeBattleshipFleet,
  shipCellsFrom,
  shootBattleship,
  type BattleshipBoard,
  type BattleshipOrientation,
  type BattleshipShip,
} from "./model";
import SeaBoard from "./SeaBoard.vue";

type Phase = "choose" | "search" | "place" | "battle";
type Mode = "search" | "versus";

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
  overrides: { sound: true, sessionSeconds: 900 },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false,
  // The game starts after the mode is chosen.
  autoStart: false,
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "battleship-light",
  soundEnabled,
  warmAssetIds: ["battleship-light.mode", "battleship-light.miss", "battleship-light.hit"],
});
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const layout = computed(() => battleshipLayoutFor(session.settings.preset));
const totalShipCells = computed(() => layout.value.ships.reduce((sum, length) => sum + length, 0));

const phase = ref<Phase>("choose");
const mode = ref<Mode>("search");
/** The computer's ships: the child shoots here. */
const enemy = shallowRef<BattleshipBoard>(createBattleshipBoard(layout.value));
/** The child's ships (battle with the computer). */
const own = shallowRef<BattleshipBoard>(createBattleshipBoardFromShips(layout.value.size, []));
const placed = ref<BattleshipShip[]>([]);
const orientation = ref<BattleshipOrientation>("horizontal");
const turn = ref<"player" | "computer">("player");
/** Bumped after every change: boards keep Sets, which Vue does not watch. */
const version = ref(0);
const pending = ref(false);
const message = ref("");
let disposed = false;

const resultVisible = computed(() => session.status === "finished");
const nextShipLength = computed(() => layout.value.ships[placed.value.length]);
const placingBoard = computed(() => {
  void version.value;
  return createBattleshipBoardFromShips(layout.value.size, placed.value);
});

const enemyFleet = computed(() => {
  void version.value;
  return enemy.value.ships.map((ship) => ({ ship, sunk: isShipSunk(enemy.value, ship) }));
});

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function say(assetId: string, delayMs = 40) {
  await promptAudio.playSequenceAndWait([`battleship-light.${assetId}`], delayMs);
}

/** Waits while the game is paused; false when it has ended meanwhile. */
async function whileRunning() {
  while (!disposed && session.status === "paused") await wait(300);
  return !disposed && session.status === "running";
}

// --- Mode choice ---------------------------------------------------------

function chooseMode(next: Mode) {
  mode.value = next;
  startSession();
  if (next === "search") void startSearch();
  else void startPlacing();
}

async function startSearch() {
  enemy.value = createBattleshipBoard(layout.value);
  version.value += 1;
  message.value = "";
  phase.value = "search";
  pending.value = true;
  await say("prompt", 220);
  pending.value = false;
}

// --- Placing own ships ---------------------------------------------------

async function startPlacing() {
  placed.value = [];
  orientation.value = "horizontal";
  version.value += 1;
  message.value = "";
  phase.value = "place";
  pending.value = true;
  await say("place", 220);
  pending.value = false;
}

function canStartShipAt(index: number) {
  const length = nextShipLength.value;
  if (!length) return false;
  return canPlaceShip(
    layout.value.size,
    placed.value,
    shipCellsFrom(layout.value.size, index, length, orientation.value),
  );
}

function placeShipAt(index: number) {
  const length = nextShipLength.value;
  const cells = length && shipCellsFrom(layout.value.size, index, length, orientation.value);
  if (!length || !cells || !canStartShipAt(index)) return;
  placed.value = [
    ...placed.value,
    { id: `own-${placed.value.length + 1}`, length, orientation: orientation.value, cells },
  ];
  version.value += 1;
  if (placed.value.length === layout.value.ships.length) void startBattle();
}

function rotate() {
  orientation.value = orientation.value === "horizontal" ? "vertical" : "horizontal";
}

function placeForMe() {
  // The child's ships so far stay; the rest are placed around them.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const rest = placeBattleshipFleet({
      size: layout.value.size,
      ships: layout.value.ships.slice(placed.value.length),
    });
    if (rest.every((ship) => canPlaceShip(layout.value.size, placed.value, ship.cells))) {
      placed.value = [
        ...placed.value,
        ...rest.map((ship, i) => ({ ...ship, id: `own-${placed.value.length + i + 1}` })),
      ];
      version.value += 1;
      void startBattle();
      return;
    }
  }
  placed.value = placeBattleshipFleet(layout.value).map((ship, i) => ({
    ...ship,
    id: `own-${i + 1}`,
  }));
  version.value += 1;
  void startBattle();
}

// --- Battle --------------------------------------------------------------

async function startBattle() {
  own.value = createBattleshipBoardFromShips(layout.value.size, placed.value);
  enemy.value = createBattleshipBoard(layout.value);
  turn.value = "player";
  version.value += 1;
  phase.value = "battle";
  message.value = "Твой ход";
  pending.value = true;
  await say("battle-start", 200);
  pending.value = false;
}

async function shoot(index: number) {
  if (session.status !== "running" || pending.value || !isCellOpen(enemy.value, index)) return;
  if (phase.value === "battle" && turn.value !== "player") return;
  const outcome = shootBattleship(enemy.value, index);
  if (!outcome) return;
  version.value += 1;
  pending.value = true;
  const targetId = `battleship-light:cell:${index}`;

  if (outcome.result === "miss") {
    // A miss is part of the search, not a mistake.
    message.value = "Мимо";
    recordEvent("target-click", { targetId, cell: index, result: "miss" });
    await say("miss");
    if (phase.value === "battle") {
      await computerTurn();
      return;
    }
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
    message.value = "Попал!";
    await say("hit");
    pending.value = false;
    return;
  }

  message.value = "Корабль потоплен!";
  recordEvent("target-click", { targetId, result: "sunk", length: outcome.ship?.length });
  if (allShipsSunk(enemy.value)) {
    await say(phase.value === "battle" ? "win" : "complete");
    finishSession("game-complete");
    pending.value = false;
    return;
  }
  await say("sunk");
  pending.value = false;
}

/** The computer shoots until it misses (a hit gives one more shot, as in the real game). */
async function computerTurn() {
  turn.value = "computer";
  message.value = "Ход компьютера";
  await wait(500);
  if (!(await whileRunning())) return;
  await say("computer-turn");
  for (;;) {
    await wait(700);
    if (!(await whileRunning())) return;
    const index = chooseComputerShot(own.value);
    const outcome = index === undefined ? undefined : shootBattleship(own.value, index);
    version.value += 1;
    if (!outcome || outcome.result === "miss") {
      message.value = "Компьютер промахнулся";
      await say("computer-miss");
      break;
    }
    if (outcome.result === "hit") {
      message.value = "Компьютер попал";
      await say("computer-hit");
      continue;
    }
    message.value = "Компьютер потопил твой корабль";
    if (allShipsSunk(own.value)) {
      await say("lose");
      finishSession("game-lost");
      pending.value = false;
      return;
    }
    await say("computer-sunk");
  }
  if (!(await whileRunning())) return;
  turn.value = "player";
  message.value = "Твой ход";
  await say("your-turn");
  pending.value = false;
}

function restart() {
  promptAudio.cancelPending();
  pending.value = false;
  startSession();
  if (mode.value === "versus") void startPlacing();
  else void startSearch();
}

onMounted(() => {
  promptAudio.warm();
  void say("mode", 420);
});

onUnmounted(() => {
  disposed = true;
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
        <!-- Mode choice -->
        <div v-if="phase === 'choose'" class="mode-choice">
          <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-4">Как будем играть?</h1>
          <div class="mode-grid">
            <GameDwellButton
              target-id="battleship-light:mode:search"
              :dwell-ms="session.settings.dwellMs"
              min-height="clamp(10rem, 40dvh, 22rem)"
              @select="chooseMode('search')"
            >
              <template #default>
                <div class="mode-card">
                  <div class="mode-card__art">
                    <img :src="gameArtSrc('battleship-light/ship-2')" alt="" />
                    <img
                      :src="gameArtSrc('battleship-light/splash')"
                      alt=""
                      class="mode-card__mark"
                    />
                  </div>
                  <div class="text-h5 text-md-h4 font-weight-bold">Найди корабли</div>
                </div>
              </template>
            </GameDwellButton>
            <GameDwellButton
              target-id="battleship-light:mode:versus"
              :dwell-ms="session.settings.dwellMs"
              min-height="clamp(10rem, 40dvh, 22rem)"
              @select="chooseMode('versus')"
            >
              <template #default>
                <div class="mode-card">
                  <div class="mode-card__art">
                    <img :src="gameArtSrc('battleship-light/ship-3')" alt="" />
                    <img
                      :src="gameArtSrc('battleship-light/fire')"
                      alt=""
                      class="mode-card__mark"
                    />
                  </div>
                  <div class="text-h5 text-md-h4 font-weight-bold">Бой с компьютером</div>
                </div>
              </template>
            </GameDwellButton>
          </div>
        </div>

        <!-- Find the computer's ships -->
        <div v-else-if="phase === 'search'" class="battle-layout">
          <SeaBoard
            :board="enemy"
            :version="version"
            mode="shoot"
            :disabled="session.status !== 'running' || pending"
            :dwell-ms="session.settings.dwellMs"
            target-prefix="battleship-light:cell"
            size="min(calc(100dvh - 15.5rem), 58vw, 40rem)"
            label="Поле с кораблями компьютера"
            @select="shoot"
          />
          <aside class="battle-side">
            <h1 class="text-h5 text-md-h4 font-weight-bold mb-2">Найди корабли</h1>
            <p class="text-body-1 text-md-h6 text-medium-emphasis mb-3">
              Посмотри на клетку, чтобы выстрелить.
            </p>
            <div class="shot-result text-h5 text-md-h4 font-weight-bold mb-3" aria-live="polite">
              {{ message }}
            </div>
            <div class="fleet" aria-label="Корабли компьютера">
              <div
                v-for="item in enemyFleet"
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

        <!-- Place own ships -->
        <div v-else-if="phase === 'place'" class="battle-layout">
          <SeaBoard
            :board="placingBoard"
            :version="version"
            mode="place"
            show-ships
            :can-select="canStartShipAt"
            :disabled="session.status !== 'running' || pending"
            :dwell-ms="session.settings.dwellMs"
            target-prefix="battleship-light:place"
            size="min(calc(100dvh - 15.5rem), 50vw, 38rem)"
            label="Твоё поле: расстановка кораблей"
            @select="placeShipAt"
          />
          <aside class="battle-side">
            <h1 class="text-h5 text-md-h4 font-weight-bold mb-2">Расставь корабли</h1>
            <p class="text-body-1 text-md-h6 text-medium-emphasis mb-3">
              Посмотри на клетку, где начнётся корабль.
            </p>
            <div
              v-if="nextShipLength"
              class="next-ship mb-3"
              :class="{ 'next-ship--standing': orientation === 'vertical' }"
              :style="{ '--ship-length': nextShipLength }"
            >
              <img
                class="fleet-ship__art"
                :class="{ 'next-ship--vertical': orientation === 'vertical' }"
                :style="{ '--ship-length': nextShipLength }"
                :src="gameArtSrc(`battleship-light/ship-${nextShipLength}`)"
                alt=""
              />
              <span class="text-h6 font-weight-bold">Корабль на {{ nextShipLength }}</span>
            </div>
            <div class="place-actions">
              <GameDwellButton
                target-id="battleship-light:rotate"
                :disabled="session.status !== 'running' || pending || !nextShipLength"
                :dwell-ms="session.settings.dwellMs"
                min-height="clamp(4.5rem, 12dvh, 7rem)"
                color="blue-grey-lighten-4"
                @select="rotate"
              >
                <template #default>
                  <div class="text-h6 font-weight-bold">
                    <v-icon icon="mdi-rotate-right" class="me-1" />Повернуть
                  </div>
                </template>
              </GameDwellButton>
              <GameDwellButton
                target-id="battleship-light:auto-place"
                :disabled="session.status !== 'running' || pending || !nextShipLength"
                :dwell-ms="session.settings.dwellMs"
                min-height="clamp(4.5rem, 12dvh, 7rem)"
                color="blue-grey-lighten-4"
                @select="placeForMe"
              >
                <template #default>
                  <div class="text-h6 font-weight-bold">
                    <v-icon icon="mdi-auto-fix" class="me-1" />Расставь за меня
                  </div>
                </template>
              </GameDwellButton>
            </div>
          </aside>
        </div>

        <!-- Battle: shoot at the computer's field, see its shots on your own -->
        <div v-else class="versus-layout">
          <div class="versus-board">
            <div class="versus-title text-h6 font-weight-bold">Поле компьютера</div>
            <SeaBoard
              :board="enemy"
              :version="version"
              mode="shoot"
              :disabled="session.status !== 'running' || pending || turn !== 'player'"
              :dwell-ms="session.settings.dwellMs"
              target-prefix="battleship-light:cell"
              size="min(calc(100dvh - 17.5rem), 44vw, 36rem)"
              label="Поле компьютера"
              @select="shoot"
            />
          </div>
          <div class="versus-side">
            <div
              class="turn-badge text-h5 text-md-h4 font-weight-bold mb-3"
              :class="{ 'turn-badge--computer': turn === 'computer' }"
              aria-live="polite"
            >
              {{ message }}
            </div>
            <div class="versus-title text-h6 font-weight-bold">Твоё поле</div>
            <SeaBoard
              :board="own"
              :version="version"
              mode="none"
              show-ships
              :dwell-ms="session.settings.dwellMs"
              target-prefix="battleship-light:own"
              size="min(calc((100dvh - 17.5rem) * 0.62), 26vw, 22rem)"
              label="Твоё поле"
            />
          </div>
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

.mode-grid {
  display: grid;
  gap: clamp(1.5rem, 4vw, 3rem);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-inline: auto;
  max-inline-size: 60rem;
}

.mode-card {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mode-card__art {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.mode-card__art img {
  block-size: clamp(3.5rem, 12dvh, 7rem);
  object-fit: contain;
}

.mode-card__art .mode-card__mark {
  inline-size: clamp(3.5rem, 12dvh, 7rem);
}

.battle-layout {
  align-items: center;
  display: grid;
  gap: clamp(1rem, 3vw, 2.5rem);
  grid-template-columns: auto minmax(14rem, 22rem);
  justify-content: center;
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

.fleet-ship,
.next-ship {
  align-items: center;
  display: flex;
  gap: 0.75rem;
}

.fleet-ship__art {
  block-size: clamp(2rem, 6dvh, 3.5rem);
  inline-size: calc(var(--ship-length) * clamp(2rem, 6dvh, 3.5rem));
  object-fit: fill;
  transition: transform 200ms ease;
}

/* The next ship turns with "Повернуть". */
.next-ship--vertical {
  transform: rotate(90deg);
}

/* A standing ship needs its length in height: keep the text below it clear. */
.next-ship--standing {
  min-block-size: calc(var(--ship-length) * clamp(2rem, 6dvh, 3.5rem));
}

.fleet-ship--sunk .fleet-ship__art {
  filter: grayscale(0.7);
  opacity: 0.45;
}

.fleet-ship__done {
  color: rgb(var(--v-theme-success));
  font-size: clamp(1.5rem, 4dvh, 2.4rem);
}

.place-actions {
  display: grid;
  gap: 0.75rem;
}

.versus-layout {
  align-items: start;
  display: grid;
  gap: clamp(1rem, 3vw, 2.5rem);
  grid-template-columns: auto auto;
  justify-content: center;
}

.versus-title {
  margin-block-end: 0.25rem;
  text-align: center;
}

.turn-badge {
  background: rgba(var(--v-theme-primary), 0.12);
  border-radius: 1rem;
  color: rgb(var(--v-theme-primary));
  padding: 0.5rem 1rem;
  text-align: center;
}

.turn-badge--computer {
  background: rgba(96, 125, 139, 0.15);
  color: #455a64;
}

@media (max-width: 52rem) {
  .battle-layout,
  .versus-layout,
  .mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
