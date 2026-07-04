<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  allShipsSunk,
  autoPlaceFleet,
  battleshipCellCount,
  battleshipSectors,
  battleshipShips,
  canPlaceShip,
  cellIndex,
  cellPosition,
  chooseAiShot,
  coordinateLabel,
  countShots,
  fireAt,
  findShipAt,
  getSectorCells,
  nextShipToPlace,
  occupiedCells,
  placeShip,
  type BattleshipOrientation,
  type BattleshipPhase,
  type BattleshipSectorId,
  type BattleshipShip,
  type BattleshipShot,
  type BattleshipShots,
  type BattleshipWinner
} from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("battleship-light", {
  maxSteps: 100,
  overrides: { targetScale: 1.2, sound: true, sessionSeconds: 86400 },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "battleship-light", soundEnabled, warmAssetIds: ["battleship-light.prompt", "battleship-light.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const phase = ref<BattleshipPhase>("setup");
const playerFleet = ref<BattleshipShip[]>([]);
const enemyFleet = ref<BattleshipShip[]>(autoPlaceFleet(2026).fleet);
const playerShots = ref<BattleshipShots>({});
const enemyShots = ref<BattleshipShots>({});
const orientation = ref<BattleshipOrientation>("horizontal");
const selectedSector = ref<BattleshipSectorId>("nw");
const aiSeed = ref(73);
const winner = ref<BattleshipWinner>();
const lastPlayerShot = ref<number>();
const lastAiShot = ref<number>();
const pending = ref(false);
const feedbackMessage = ref("Расставь свой флот. Выбери сектор и крупную клетку для текущего корабля.");

let aiTimer = 0;

const resultVisible = computed(() => session.status === "finished");
const currentShip = computed(() => nextShipToPlace(playerFleet.value));
const setupComplete = computed(() => playerFleet.value.length === battleshipShips.length);
const activeCells = computed(() => getSectorCells(selectedSector.value));
const fullBoardCells = Array.from({ length: battleshipCellCount }, (_, index) => index);
const playerOccupied = computed(() => occupiedCells(playerFleet.value));
const hudStep = computed(() => countShots(playerShots.value));
const playerHits = computed(() => countShots(playerShots.value, "hit") + countShots(playerShots.value, "sunk"));
const playerMisses = computed(() => countShots(playerShots.value, "miss"));
const enemyHits = computed(() => countShots(enemyShots.value, "hit") + countShots(enemyShots.value, "sunk"));
const enemyMisses = computed(() => countShots(enemyShots.value, "miss"));

const statusText = computed(() => {
  if (phase.value === "setup") return setupComplete.value ? "Флот готов" : `Расстановка ${playerFleet.value.length} / ${battleshipShips.length}`;
  if (phase.value === "player-turn") return "Твой залп";
  if (phase.value === "ai-turn") return "Ответ соперника";
  return winner.value === "player" ? "Победа" : "Поражение";
});

function clearAiTimer() {
  window.clearTimeout(aiTimer);
  aiTimer = 0;
}

function cellTargetId(index: number) {
  return `battleship-light:${phase.value}:cell:${index}`;
}

function sectorTargetId(id: BattleshipSectorId) {
  return `battleship-light:sector:${id}`;
}

function sectorLabel(id: BattleshipSectorId) {
  return battleshipSectors.find((sector) => sector.id === id)?.label ?? id;
}

function shotIcon(shot?: BattleshipShot) {
  if (shot === "miss") return "mdi-water";
  if (shot === "hit") return "mdi-fire";
  if (shot === "sunk") return "mdi-ferry";
  return undefined;
}

function shotColor(shot?: BattleshipShot) {
  if (shot === "miss") return "info";
  if (shot === "hit") return "warning";
  if (shot === "sunk") return "primary";
  return "surface";
}

function activeCellColor(index: number) {
  if (phase.value === "setup") {
    const valid = currentShip.value ? canPlaceShip(playerFleet.value, currentShip.value, index, orientation.value) : false;
    if (playerOccupied.value.has(index)) return "primary";
    return valid ? "green-lighten-5" : "surface";
  }

  return shotColor(playerShots.value[index]);
}

function overviewClass(index: number, owner: "player" | "enemy") {
  const shots = owner === "player" ? enemyShots.value : playerShots.value;
  const ship = owner === "player" ? playerOccupied.value.has(index) : false;
  return {
    "overview-cell--ship": ship,
    "overview-cell--miss": shots[index] === "miss",
    "overview-cell--hit": shots[index] === "hit",
    "overview-cell--sunk": shots[index] === "sunk",
    "overview-cell--last": index === (owner === "player" ? lastAiShot.value : lastPlayerShot.value)
  };
}

function rotate() {
  orientation.value = orientation.value === "horizontal" ? "vertical" : "horizontal";
}

function selectSector(id: BattleshipSectorId) {
  if (pending.value || phase.value === "ai-turn" || phase.value === "finished") return;
  selectedSector.value = id;
}

function autoSetup() {
  if (phase.value !== "setup") return;
  playerFleet.value = autoPlaceFleet(99).fleet;
  feedbackMessage.value = "Флот расставлен автоматически. Можно начинать бой.";
}

function startBattle() {
  if (!setupComplete.value) {
    feedbackMessage.value = "Сначала расставь все корабли или выбери авторасстановку.";
    return;
  }
  phase.value = "player-turn";
  selectedSector.value = "nw";
  feedbackMessage.value = "Бой начался. Выбери клетку на поле соперника для залпа.";
}

function finishGame(nextWinner: BattleshipWinner) {
  winner.value = nextWinner;
  phase.value = "finished";
  feedbackMessage.value = nextWinner === "player" ? "Все корабли соперника потоплены." : "Соперник потопил твой флот.";
  finishSession(nextWinner === "player" ? "game-complete" : "game-lost");
  promptAudio.play("battleship-light.complete", 180);
}

function handleSetupCell(index: number) {
  const ship = currentShip.value;
  if (!ship) return;
  const nextFleet = placeShip(playerFleet.value, ship, index, orientation.value);
  if (!nextFleet) {
    feedbackMessage.value = `${coordinateLabel(index)} не подходит: корабли не должны касаться и выходить за поле.`;
    void feedbackAudio.playMistake();
    return;
  }

  playerFleet.value = nextFleet;
  const nextShip = nextShipToPlace(nextFleet);
  feedbackMessage.value = nextShip ? `${ship.name} поставлен. Теперь поставь ${nextShip.name} длиной ${nextShip.length}.` : "Флот готов. Нажми начать бой.";
  void feedbackAudio.playSuccess();
}

function handlePlayerShot(index: number) {
  if (playerShots.value[index]) {
    feedbackMessage.value = `${coordinateLabel(index)} уже проверена. Выбери другую клетку.`;
    return;
  }

  const result = fireAt(enemyFleet.value, playerShots.value, index, "player");
  if (!result.ok || !result.result) return;

  playerShots.value = result.shots;
  lastPlayerShot.value = index;
  recordEvent("target-click", { targetId: cellTargetId(index), coordinate: coordinateLabel(index), result: result.result });

  if (result.result === "miss") {
    recordMistake({ coordinate: coordinateLabel(index), result: "miss", isCorrect: false });
    feedbackMessage.value = `${coordinateLabel(index)}: вода. Теперь отвечает соперник.`;
    void feedbackAudio.playMistake();
    phase.value = "ai-turn";
    scheduleAiTurn();
    return;
  }

  recordSuccess({ coordinate: coordinateLabel(index), result: result.result, isCorrect: true });
  feedbackMessage.value = result.result === "sunk" ? `${coordinateLabel(index)}: корабль потоплен. Стреляй ещё.` : `${coordinateLabel(index)}: попадание. Стреляй ещё.`;
  void feedbackAudio.playSuccess();
  if (result.winner) finishGame(result.winner);
}

function scheduleAiTurn() {
  clearAiTimer();
  pending.value = true;
  aiTimer = window.setTimeout(runAiTurn, 850);
}

function runAiTurn() {
  if (phase.value !== "ai-turn" || session.status !== "running") return;

  const choice = chooseAiShot(playerFleet.value, enemyShots.value, aiSeed.value);
  aiSeed.value = choice.nextSeed;
  const result = fireAt(playerFleet.value, enemyShots.value, choice.index, "ai");
  if (!result.ok || !result.result) return;

  enemyShots.value = result.shots;
  lastAiShot.value = choice.index;
  pending.value = false;

  if (result.result === "miss") {
    phase.value = "player-turn";
    feedbackMessage.value = `Соперник стрелял в ${coordinateLabel(choice.index)}: вода. Твой ход.`;
    return;
  }

  feedbackMessage.value = result.result === "sunk" ? `Соперник стрелял в ${coordinateLabel(choice.index)} и потопил корабль.` : `Соперник попал в ${coordinateLabel(choice.index)}.`;
  if (result.winner) {
    finishGame(result.winner);
    return;
  }
  scheduleAiTurn();
}

function chooseCell(index: number) {
  if (session.status !== "running" || pending.value || phase.value === "finished") return;
  if (phase.value === "setup") handleSetupCell(index);
  if (phase.value === "player-turn") handlePlayerShot(index);
}

function restart() {
  clearAiTimer();
  promptAudio.cancelPending();
  phase.value = "setup";
  playerFleet.value = [];
  enemyFleet.value = autoPlaceFleet(2026).fleet;
  playerShots.value = {};
  enemyShots.value = {};
  orientation.value = "horizontal";
  selectedSector.value = "nw";
  aiSeed.value = 73;
  winner.value = undefined;
  lastPlayerShot.value = undefined;
  lastAiShot.value = undefined;
  pending.value = false;
  feedbackMessage.value = "Расставь свой флот. Выбери сектор и крупную клетку для текущего корабля.";
  startSession();
  promptAudio.play("battleship-light.prompt", 220);
}

function activeCellText(index: number) {
  if (phase.value === "setup") {
    if (playerOccupied.value.has(index)) return findShipAt(playerFleet.value, index)?.length ?? "";
    return coordinateLabel(index);
  }
  return coordinateLabel(index);
}

function battleCellColor(index: number) {
  return shotColor(playerShots.value[index]);
}

function setupOverviewClass(index: number) {
  return {
    "setup-overview-cell--ship": playerOccupied.value.has(index)
  };
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("battleship-light.prompt", 420);
});

onUnmounted(() => {
  clearAiTimer();
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="battleship-shell">
    <GameHud title="Морской бой" :step="hudStep" :max-steps="session.maxSteps" :score="playerHits" :mistakes="playerMisses" :duration-ms="durationMs" :paused="session.status === 'paused'" :show-progress="false" :show-timer="false" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="11">
          <v-card class="game-card pa-3 pa-md-4" color="rgba(255, 255, 255, 0.95)" rounded="xl" elevation="10">
            <div class="game-layout" :class="{ 'game-layout--setup': phase === 'setup' }">
              <section class="control-panel">
                <div>
                  <div class="text-overline text-secondary mb-1">Полный морской бой 10×10</div>
                  <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Морской бой</h1>
                  <p class="text-body-1 text-medium-emphasis mb-0">Сначала расставь корабли, затем стреляй по полю соперника. Для взгляда поле делится на крупные сектора.</p>
                </div>

                <v-alert class="text-body-1 font-weight-medium" color="primary" icon="mdi-ferry" rounded="xl" variant="tonal">
                  {{ feedbackMessage }} {{ statusText }}
                </v-alert>

                <div class="d-flex flex-wrap ga-2">
                  <v-chip color="primary" size="large" variant="flat">{{ statusText }}</v-chip>
                  <v-chip v-if="phase === 'setup' && currentShip" color="secondary" size="large" variant="tonal">{{ currentShip.name }}: {{ currentShip.length }}</v-chip>
                  <v-chip v-if="phase !== 'setup'" color="success" size="large" variant="tonal">Попадания: {{ playerHits }}</v-chip>
                  <v-chip v-if="phase !== 'setup'" color="warning" size="large" variant="tonal">По нам: {{ enemyHits }}</v-chip>
                </div>

                <div v-if="phase === 'setup'" class="text-body-2 text-medium-emphasis">Кнопки управления находятся справа от поля и тоже выбираются взглядом.</div>
                <div v-else class="d-flex flex-wrap ga-2">
                  <v-btn color="primary" prepend-icon="mdi-restart" rounded="xl" size="large" variant="tonal" @click="restart">Новая партия</v-btn>
                </div>
              </section>

              <section class="active-panel">
                <div class="text-subtitle-1 font-weight-bold mb-2">{{ phase === 'setup' ? 'Расстановка: всё поле' : 'Стрельба: поле соперника целиком' }}</div>
                <div v-if="phase === 'setup'" class="setup-field-row">
                  <div class="setup-overview-grid" role="grid" aria-label="Поле игрока десять на десять">
                    <GameDwellButton v-for="index in fullBoardCells" :key="`setup-full-${index}`" :target-id="cellTargetId(index)" :disabled="phase !== 'setup'" :dwell-ms="session.settings.dwellMs" min-height="clamp(2.05rem, 5.8dvh, 4rem)" :color="activeCellColor(index)" @select="chooseCell(index)">
                      <template #default>
                        <div class="setup-overview-cell" :class="setupOverviewClass(index)">
                          <span class="setup-overview-label">{{ coordinateLabel(index) }}</span>
                          <v-icon v-if="playerOccupied.has(index)" icon="mdi-ferry" size="clamp(1rem, 2.8dvh, 1.8rem)" />
                        </div>
                      </template>
                    </GameDwellButton>
                  </div>

                  <div class="setup-gaze-actions" aria-label="Управление расстановкой">
                    <GameDwellButton v-if="!setupComplete" target-id="battleship-light:action:rotate" :dwell-ms="session.settings.dwellMs" min-height="clamp(4.25rem, 10dvh, 6rem)" color="blue-grey-darken-2" @select="rotate">
                      <template #default>
                        <div class="action-button-content">
                          <v-icon icon="mdi-rotate-3d-variant" size="clamp(1.6rem, 4dvh, 2.4rem)" />
                          <span>Повернуть</span>
                          <small>{{ orientation === 'horizontal' ? 'сейчас гор.' : 'сейчас верт.' }}</small>
                        </div>
                      </template>
                    </GameDwellButton>

                    <GameDwellButton v-if="!setupComplete" target-id="battleship-light:action:auto-setup" :dwell-ms="session.settings.dwellMs" min-height="clamp(4.25rem, 10dvh, 6rem)" color="teal-darken-3" @select="autoSetup">
                      <template #default>
                        <div class="action-button-content">
                          <v-icon icon="mdi-auto-fix" size="clamp(1.6rem, 4dvh, 2.4rem)" />
                          <span>Авто</span>
                        </div>
                      </template>
                    </GameDwellButton>

                    <GameDwellButton v-if="setupComplete" target-id="battleship-light:action:start-battle" :dwell-ms="session.settings.dwellMs" min-height="clamp(5rem, 12dvh, 7rem)" color="success" @select="startBattle">
                      <template #default>
                        <div class="action-button-content action-button-content--start">
                          <v-icon icon="mdi-play" size="clamp(1.8rem, 4.5dvh, 2.8rem)" />
                          <span>Начать бой</span>
                        </div>
                      </template>
                    </GameDwellButton>

                    <GameDwellButton target-id="battleship-light:action:restart" :dwell-ms="session.settings.dwellMs" min-height="clamp(4rem, 9dvh, 5.5rem)" color="blue-grey-darken-2" @select="restart">
                      <template #default>
                        <div class="action-button-content">
                          <v-icon icon="mdi-restart" size="clamp(1.5rem, 3.8dvh, 2.3rem)" />
                          <span>Заново</span>
                        </div>
                      </template>
                    </GameDwellButton>
                  </div>
                </div>
                <div v-else class="battle-board-grid" role="grid" aria-label="Поле соперника десять на десять">
                  <GameDwellButton v-for="index in fullBoardCells" :key="`${phase}-enemy-${index}`" :target-id="cellTargetId(index)" :disabled="phase === 'ai-turn' || phase === 'finished' || Boolean(playerShots[index])" :dwell-ms="session.settings.dwellMs" min-height="clamp(2.05rem, 5.8dvh, 4rem)" :color="battleCellColor(index)" @select="chooseCell(index)">
                    <template #default>
                      <div class="battle-cell">
                        <span class="setup-overview-label">{{ coordinateLabel(index) }}</span>
                        <v-icon v-if="shotIcon(playerShots[index])" :icon="shotIcon(playerShots[index])" size="clamp(1rem, 2.8dvh, 1.8rem)" />
                      </div>
                    </template>
                  </GameDwellButton>
                </div>
              </section>

              <section v-if="phase !== 'setup'" class="boards-panel">
                <div class="overview-card">
                  <div class="text-subtitle-2 font-weight-bold mb-2">Твой флот</div>
                  <div class="overview-grid" aria-label="Твоё поле">
                    <div v-for="index in battleshipCellCount" :key="`player-${index}`" class="overview-cell" :class="overviewClass(index - 1, 'player')">
                      <v-icon v-if="enemyShots[index - 1] === 'hit' || enemyShots[index - 1] === 'sunk'" icon="mdi-fire" size="0.9rem" />
                    </div>
                  </div>
                  <div class="text-caption text-medium-emphasis mt-2">Выстрелы соперника: {{ enemyHits + enemyMisses }}</div>
                </div>

                <div class="overview-card">
                  <div class="text-subtitle-2 font-weight-bold mb-2">Поле соперника</div>
                  <div class="overview-grid" aria-label="Поле соперника">
                    <div v-for="index in battleshipCellCount" :key="`enemy-${index}`" class="overview-cell" :class="overviewClass(index - 1, 'enemy')">
                      <v-icon v-if="playerShots[index - 1] === 'hit' || playerShots[index - 1] === 'sunk'" icon="mdi-fire" size="0.9rem" />
                    </div>
                  </div>
                  <div class="text-caption text-medium-emphasis mt-2">Твои залпы: {{ playerHits + playerMisses }}</div>
                </div>
              </section>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Морской бой" :score="playerHits" :mistakes="playerMisses" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.battleship-shell {
  background:
    radial-gradient(circle at 14% 18%, rgb(187 222 251 / 68%), transparent 30%),
    radial-gradient(circle at 82% 20%, rgb(178 235 242 / 58%), transparent 32%),
    linear-gradient(135deg, #f3fbff 0%, #eaf7fb 48%, #f6fbff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: clamp(5.2rem, 11dvh, 7rem);
}

.game-card {
  max-block-size: calc(100dvh - clamp(6rem, 12dvh, 7.8rem));
  overflow: hidden;
}

.game-layout {
  display: grid;
  gap: clamp(0.8rem, 1.8vw, 1.5rem);
  grid-template-columns: minmax(16rem, 0.8fr) minmax(18rem, 1fr) minmax(12rem, 0.55fr);
}

.game-layout--setup {
  grid-template-columns: minmax(15rem, 0.6fr) minmax(30rem, 1.4fr);
}

.control-panel,
.active-panel,
.boards-panel,
.overview-card {
  min-inline-size: 0;
}

.control-panel {
  display: flex;
  flex-direction: column;
  gap: clamp(0.65rem, 1.4dvh, 1rem);
}

.sector-grid {
  display: grid;
  gap: clamp(0.35rem, 0.8vw, 0.7rem);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.active-grid {
  display: grid;
  gap: clamp(0.25rem, 0.65vw, 0.55rem);
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.setup-field-row {
  align-items: start;
  display: grid;
  gap: clamp(0.7rem, 1.3vw, 1rem);
  grid-template-columns: minmax(0, 1fr) minmax(9.5rem, 0.34fr);
}

.setup-overview-grid {
  display: grid;
  gap: clamp(0.1rem, 0.28vw, 0.24rem);
  grid-template-columns: repeat(10, minmax(0, 1fr));
  inline-size: min(100%, 40rem, 78dvh);
  max-inline-size: min(100%, 40rem, 78dvh);
}

.battle-board-grid {
  display: grid;
  gap: clamp(0.1rem, 0.28vw, 0.24rem);
  grid-template-columns: repeat(10, minmax(0, 1fr));
  inline-size: min(100%, 40rem, 78dvh);
  max-inline-size: min(100%, 40rem, 78dvh);
}

.setup-overview-grid > * {
  min-inline-size: 0;
}

.battle-board-grid > * {
  min-inline-size: 0;
}

.setup-overview-grid :deep(.dwell-button) {
  border-radius: clamp(0.28rem, 0.8dvh, 0.6rem) !important;
  padding: 0 !important;
}

.setup-gaze-actions {
  display: flex;
  flex-direction: column;
  gap: clamp(0.45rem, 1dvh, 0.75rem);
}

.setup-gaze-actions :deep(.dwell-button) {
  padding: clamp(0.35rem, 0.9dvh, 0.7rem) !important;
}

.action-button-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: clamp(0.82rem, 1.8dvh, 1.05rem);
  font-weight: 900;
  gap: 0.3rem;
  justify-content: center;
  line-height: 1.12;
  min-block-size: 100%;
  text-align: center;
}

.action-button-content small {
  font-size: 0.72em;
  font-weight: 800;
  opacity: 0.9;
}

.action-button-content--start {
  font-size: clamp(1rem, 2.2dvh, 1.35rem);
}

.battle-board-grid :deep(.dwell-button) {
  border-radius: clamp(0.28rem, 0.8dvh, 0.6rem) !important;
  padding: 0 !important;
}

.setup-overview-cell {
  align-items: center;
  aspect-ratio: 1;
  background: #e4f1ee;
  border-radius: clamp(0.28rem, 0.8dvh, 0.6rem);
  box-shadow: inset 0 0 0 0.08rem rgb(var(--v-theme-primary) / 34%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 100%;
  inline-size: 100%;
  min-inline-size: 0;
  position: relative;
}

.battle-cell {
  align-items: center;
  aspect-ratio: 1;
  border-radius: clamp(0.28rem, 0.8dvh, 0.6rem);
  box-shadow: inset 0 0 0 0.08rem rgb(var(--v-theme-primary) / 18%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 100%;
  inline-size: 100%;
  min-inline-size: 0;
  position: relative;
}

.setup-overview-cell--ship {
  background: #426960;
  box-shadow: inset 0 0 0 0.14rem #ffffff, 0 0.14rem 0.36rem rgb(0 0 0 / 20%);
  color: rgb(var(--v-theme-on-primary));
}

.setup-overview-label {
  font-size: clamp(0.42rem, 1.05dvh, 0.68rem);
  font-weight: 900;
  inset-block-start: 0.12rem;
  inset-inline-start: 0.16rem;
  position: absolute;
}

.active-grid :deep(.dwell-button),
.sector-grid :deep(.dwell-button) {
  padding: clamp(0.2rem, 0.5dvh, 0.45rem) !important;
}

.active-cell {
  align-items: center;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 100%;
}

.coordinate-label {
  color: rgb(var(--v-theme-on-surface) / 76%);
  font-size: clamp(0.72rem, 1.6dvh, 1.05rem);
  font-weight: 900;
  letter-spacing: 0.04em;
}

.boards-panel {
  display: grid;
  gap: clamp(0.7rem, 1.5dvh, 1rem);
}

.overview-card {
  background: rgb(var(--v-theme-surface) / 70%);
  border-radius: 1.2rem;
  padding: clamp(0.55rem, 1.2dvh, 0.85rem);
}

.overview-grid {
  display: grid;
  gap: 0.12rem;
  grid-template-columns: repeat(10, minmax(0, 1fr));
}

.overview-cell {
  align-items: center;
  aspect-ratio: 1;
  background: rgb(var(--v-theme-info) / 10%);
  border-radius: 0.18rem;
  display: flex;
  justify-content: center;
}

.overview-cell--ship {
  background: rgb(var(--v-theme-primary) / 34%);
}

.overview-cell--miss {
  background: rgb(var(--v-theme-info) / 36%);
}

.overview-cell--hit {
  background: rgb(var(--v-theme-warning) / 50%);
}

.overview-cell--sunk {
  background: rgb(var(--v-theme-primary) / 70%);
}

.overview-cell--last {
  box-shadow: 0 0 0 0.12rem rgb(var(--v-theme-warning));
}

@media (max-width: 75rem) {
  .game-card {
    max-block-size: none;
    overflow: visible;
  }

  .game-layout {
    grid-template-columns: 1fr 1fr;
  }

  .game-layout--setup {
    grid-template-columns: minmax(14rem, 0.55fr) minmax(22rem, 1fr);
  }

  .boards-panel {
    grid-column: 1 / -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 48rem) {
  .game-layout,
  .game-layout--setup,
  .boards-panel {
    grid-template-columns: 1fr;
  }

  .setup-field-row {
    grid-template-columns: 1fr;
  }

  .setup-gaze-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-height: 42.5rem) and (min-width: 75.01rem) {
  .game-card h1,
  .game-card p,
  .game-card .text-overline {
    display: none;
  }

  .game-layout {
    grid-template-columns: minmax(14rem, 0.7fr) minmax(17rem, 1fr) minmax(11rem, 0.5fr);
  }
}

@media (max-height: 42.5rem) {
  .game-container {
    padding-block-start: 4.5rem;
  }

  .game-card {
    padding: 0.75rem !important;
  }

  .game-card h1,
  .game-card p,
  .game-card .text-overline,
  .boards-panel {
    display: none;
  }

  .game-layout {
    gap: 0.7rem;
    grid-template-columns: minmax(16rem, 0.85fr) minmax(18rem, 1fr);
  }

  .game-layout--setup {
    grid-template-columns: minmax(13rem, 0.5fr) minmax(25rem, 1fr);
  }

  .setup-field-row {
    grid-template-columns: minmax(0, 1fr) minmax(8rem, 0.3fr);
  }

  .setup-gaze-actions :deep(.dwell-button) {
    min-block-size: clamp(3.2rem, 8dvh, 4.6rem) !important;
  }

  .control-panel {
    gap: 0.45rem;
  }

  .control-panel :deep(.v-alert) {
    display: none;
  }

  .active-grid {
    max-inline-size: min(100%, 25rem);
  }

  .setup-overview-grid {
    inline-size: min(100%, 29rem, 72dvh);
    max-inline-size: min(100%, 29rem, 72dvh);
  }

  .battle-board-grid {
    inline-size: min(100%, 29rem, 72dvh);
    max-inline-size: min(100%, 29rem, 72dvh);
  }

  .active-grid :deep(.dwell-button) {
    min-block-size: clamp(2.45rem, 7dvh, 4rem) !important;
  }

  .sector-grid :deep(.dwell-button) {
    min-block-size: clamp(2.45rem, 6.4dvh, 3.6rem) !important;
  }
}
</style>
