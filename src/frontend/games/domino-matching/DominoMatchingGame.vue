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
import { drawPlayerTile, getOpenEnds, getPlayablePlacements, hasPlayableMove, playPlayerTile, startDominoGame, type DominoGameState, type DominoPlacement, type DominoSide, type DominoTile, type PlacedDominoTile } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSessionFor("domino-matching", {
  maxSteps: 10,
  overrides: { dwellMs: 1300, sessionSeconds: 180, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "domino-matching", soundEnabled, warmAssetIds: ["domino-matching.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);
const boardRowSize = 5;

const game = ref<DominoGameState>(startDominoGame(session.settings));
const selectedTileId = ref<string>();
const lastMistakeId = ref<string>();
const resultVisible = computed(() => session.status === "finished");
const isSpeaking = ref(false);
const openEnds = computed(() => getOpenEnds(game.value));
const playerHasMove = computed(() => hasPlayableMove(game.value.playerHand, game.value));
const canUseDrawAction = computed(() => !playerHasMove.value && !selectedTile.value);
const selectedTile = computed(() => game.value.playerHand.find((tile) => tile.id === selectedTileId.value));
const selectedPlacements = computed(() => selectedTile.value ? getPlayablePlacements(selectedTile.value, game.value) : []);
const boardRows = computed(() => {
  const rows: PlacedDominoTile[][] = [];
  for (let index = 0; index < game.value.board.length; index += boardRowSize) {
    const row = game.value.board.slice(index, index + boardRowSize);
    rows.push(rows.length % 2 ? [...row].reverse() : row);
  }
  return rows;
});

const helperText = computed(() => {
  if (selectedTile.value) return "Эта костяшка подходит с двух сторон. Выбери левый или правый край.";
  if (!playerHasMove.value) return game.value.boneyard.length ? "Подходящих костяшек нет. Можно взять из базара." : "Ходов нет и базар пуст. Партия закончится.";
  return `Открытые числа: ${openEnds.value.leftEnd} слева и ${openEnds.value.rightEnd} справа. Выбери подходящую костяшку.`;
});

function tileTargetId(tile: DominoTile) {
  return `domino-matching:tile:${tile.id}`;
}

function sideTargetId(side: DominoSide) {
  return `domino-matching:side:${side}`;
}

const pipPositions: Record<number, string[]> = {
  0: [],
  1: ["center"],
  2: ["top-left", "bottom-right"],
  3: ["top-left", "center", "bottom-right"],
  4: ["top-left", "top-right", "bottom-left", "bottom-right"],
  5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
  6: ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"]
};

function dotPositions(count: number) {
  return pipPositions[count] ?? [];
}

function tileLabel(tile: DominoTile) {
  return `${tile.left}:${tile.right}`;
}

function placementFor(side: DominoSide) {
  return selectedPlacements.value.find((placement) => placement.side === side);
}

async function speakResult(assetIds: string[]) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(assetIds, 80, 170);
  isSpeaking.value = false;
}

async function afterSuccessfulMove(previousState: DominoGameState, resultState: DominoGameState, targetId: string, answerId: string) {
  const botAction = resultState.lastBotAction;
  const completed = resultState.status !== "playing" || session.step + 1 >= session.maxSteps;
  recordSuccess({ targetId, answerId, leftEnd: openEnds.value.leftEnd, rightEnd: openEnds.value.rightEnd, botAction, status: resultState.status });
  selectedTileId.value = undefined;
  lastMistakeId.value = undefined;
  void feedbackAudio.playSuccess();
  game.value = resultState;
  if (completed) await speakResult(["domino-matching.complete"]);
  if (completed) finishSession(resultState.status === "playing" ? "max-steps" : "game-complete");
  if (botAction && previousState.lastBotAction !== botAction) recordHint({ text: botAction, reason: "bot-turn" });
}

async function chooseTile(tile: DominoTile) {
  if (session.status !== "running" || isSpeaking.value) return;
  const placements = getPlayablePlacements(tile, game.value);

  if (!placements.length) {
    lastMistakeId.value = tile.id;
    selectedTileId.value = undefined;
    recordMistake({ targetId: tileTargetId(tile), answerId: tile.id, leftEnd: openEnds.value.leftEnd, rightEnd: openEnds.value.rightEnd, isCorrect: false });
    recordHint({ targetId: tileTargetId(tile), text: "Сравни числа на костяшке с открытыми краями цепочки.", reason: "wrong-domino-tile" });
    void feedbackAudio.playMistake();
    return;
  }

  if (placements.length > 1) {
    selectedTileId.value = tile.id;
    lastMistakeId.value = undefined;
    return;
  }

  const previousState = game.value;
  const result = playPlayerTile(game.value, tile.id, placements[0].side);
  if (result.ok) await afterSuccessfulMove(previousState, result.state, tileTargetId(tile), tile.id);
}

async function chooseSide(side: DominoSide) {
  if (session.status !== "running" || isSpeaking.value || !selectedTile.value) return;
  const placement = placementFor(side);
  if (!placement) return;

  const previousState = game.value;
  const result = playPlayerTile(game.value, selectedTile.value.id, side);
  if (result.ok) await afterSuccessfulMove(previousState, result.state, sideTargetId(side), `${selectedTile.value.id}:${side}`);
}

async function drawTile() {
  if (session.status !== "running" || isSpeaking.value || playerHasMove.value) return;
  const result = drawPlayerTile(game.value);
  if (!result.ok) {
    finishSession("game-complete");
    return;
  }

  game.value = result.state;
  selectedTileId.value = undefined;
  lastMistakeId.value = undefined;
  recordHint({ targetId: "domino-matching:draw", text: "Игрок взял костяшку из базара.", reason: "draw-domino" });
}

function restart() {
  promptAudio.cancelPending();
  selectedTileId.value = undefined;
  lastMistakeId.value = undefined;
  isSpeaking.value = false;
  game.value = startDominoGame(session.settings);
  startSession();
}

onMounted(() => {
  promptAudio.warm();
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="domino-shell">
    <GameHud title="Домино" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" :show-timer="false" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="11">
          <v-card class="domino-card pa-3 pa-md-4" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Strategy · counting · turn taking</div>
            <h1 class="text-h5 text-md-h4 font-weight-bold text-center mb-2">Собери цепочку домино</h1>

            <v-alert class="instruction mb-3 text-body-1 text-md-h6 font-weight-bold" color="primary" icon="mdi-dots-grid" rounded="xl" variant="tonal">
              {{ helperText }}
            </v-alert>

            <div class="status-row mb-3">
              <v-chip color="primary" variant="tonal" size="large">Слева: {{ openEnds.leftEnd }}</v-chip>
              <v-chip color="secondary" variant="tonal" size="large">Базар: {{ game.boneyard.length }}</v-chip>
              <v-chip color="deep-purple" variant="tonal" size="large">У бота: {{ game.botHand.length }}</v-chip>
              <v-chip v-if="game.lastBotAction" color="teal" variant="tonal" size="large">{{ game.lastBotAction }}</v-chip>
              <v-chip color="primary" variant="tonal" size="large">Справа: {{ openEnds.rightEnd }}</v-chip>
            </div>

            <section class="board-zone mb-3" aria-label="Цепочка домино на столе">
              <div :class="['board-path', { 'board-path--bent': boardRows.length > 1 }]">
                <div v-for="(row, rowIndex) in boardRows" :key="`board-row-${rowIndex}`" :class="['board-row', { 'board-row--reverse': rowIndex % 2 === 1 }]">
                  <div v-for="placed in row" :key="`${placed.owner}-${placed.tile.id}-${placed.left}-${placed.right}`" :class="['domino', `domino--${placed.owner}`]" :aria-label="`Костяшка ${placed.left}:${placed.right}`">
                    <div class="domino__half">
                      <span v-for="position in dotPositions(placed.left)" :key="`${placed.tile.id}-placed-left-${position}`" :class="['domino__dot', `domino__dot--${position}`]" />
                    </div>
                    <div class="domino__half">
                      <span v-for="position in dotPositions(placed.right)" :key="`${placed.tile.id}-placed-right-${position}`" :class="['domino__dot', `domino__dot--${position}`]" />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <v-row v-if="selectedTile" class="side-row mb-3" dense>
              <v-col v-for="side in (['left', 'right'] as DominoSide[])" :key="side" cols="6">
                <GameDwellButton :target-id="sideTargetId(side)" :disabled="session.status !== 'running' || isSpeaking || !placementFor(side)" :dwell-ms="session.settings.dwellMs" color="secondary" @select="chooseSide(side)">
                  <template #default>
                    <div class="side-choice">
                      <div class="text-h6 font-weight-bold">{{ side === 'left' ? 'Слева' : 'Справа' }}</div>
                      <div class="text-body-1">Поставить {{ tileLabel(selectedTile) }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <div class="hand-title text-h6 font-weight-bold mb-2">Твои костяшки</div>
            <v-row class="hand-row" dense>
              <v-col v-for="tile in game.playerHand" :key="tile.id" cols="6" sm="4" md="3" lg="2">
                <GameDwellButton :target-id="tileTargetId(tile)" :disabled="session.status !== 'running' || isSpeaking || Boolean(selectedTile)" :dwell-ms="session.settings.dwellMs" color="surface" @select="chooseTile(tile)">
                  <template #default>
                    <div :class="['hand-card', { 'hand-card--selected': tile.id === selectedTileId, 'hand-card--mistake': tile.id === lastMistakeId, 'hand-card--playable': getPlayablePlacements(tile, game).length > 0 }]">
                      <div class="domino domino--hand" :aria-label="`Костяшка ${tile.left}:${tile.right}`">
                        <div class="domino__half">
                          <span v-for="position in dotPositions(tile.left)" :key="`${tile.id}-left-${position}`" :class="['domino__dot', `domino__dot--${position}`]" />
                        </div>
                        <div class="domino__half">
                          <span v-for="position in dotPositions(tile.right)" :key="`${tile.id}-right-${position}`" :class="['domino__dot', `domino__dot--${position}`]" />
                        </div>
                      </div>
                      <div class="text-body-1 font-weight-bold mt-1">{{ tileLabel(tile) }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
              <v-col cols="6" sm="4" md="3" lg="2">
                <GameDwellButton v-if="canUseDrawAction" target-id="domino-matching:draw" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" color="surface" @select="drawTile">
                  <template #default>
                    <div class="draw-card">
                      <v-icon size="x-large">mdi-tray-arrow-down</v-icon>
                      <div class="text-h6 font-weight-bold">{{ game.boneyard.length ? 'Взять' : 'Итог' }}</div>
                      <div class="text-body-2">{{ game.boneyard.length ? 'из базара' : 'ходов нет' }}</div>
                    </div>
                  </template>
                </GameDwellButton>
                <v-sheet v-else class="draw-card draw-card--idle" rounded="xl" color="grey-lighten-4">
                  <v-icon size="x-large">mdi-check-circle-outline</v-icon>
                  <div class="text-h6 font-weight-bold">Ход есть</div>
                  <div class="text-body-2">базар пока закрыт</div>
                </v-sheet>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Домино" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.domino-shell {
  background: linear-gradient(135deg, #f2f7ff 0%, #fff6df 52%, #eef8ee 100%);
  min-block-size: 100dvh;
}

.game-container {
  padding-block: clamp(4.8rem, 11vh, 6.8rem) clamp(1rem, 3vh, 2rem);
}

.domino-card {
  max-block-size: calc(100dvh - clamp(6rem, 14vh, 8rem));
  overflow: hidden;
}

.instruction {
  padding-block: clamp(0.55rem, 1.4vh, 0.9rem);
}

.status-row {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(0.35rem, 1vh, 0.7rem);
  justify-content: center;
}

.board-zone {
  background: rgb(var(--v-theme-primary) / 8%);
  border-radius: 1.2rem;
  max-block-size: clamp(9rem, 28vh, 16rem);
  overflow: auto;
  padding: clamp(0.6rem, 1.8vh, 1rem);
}

.board-path {
  display: flex;
  flex-direction: column;
  gap: clamp(0.45rem, 1.2vh, 0.75rem);
}

.board-row {
  display: flex;
  gap: clamp(0.45rem, 1.2vh, 0.75rem);
  justify-content: center;
}

.board-path--bent .board-row {
  justify-content: flex-start;
}

.board-path--bent .board-row--reverse {
  justify-content: flex-end;
}

.side-row :deep(.dwell-button),
.hand-row :deep(.dwell-button) {
  min-block-size: clamp(4.8rem, 12vh, 7.2rem) !important;
  padding: clamp(0.35rem, 1vh, 0.7rem) !important;
}

.hand-row {
  max-block-size: clamp(9rem, 31vh, 18rem);
  overflow: auto;
}

.hand-card,
.draw-card,
.side-choice {
  align-items: center;
  color: #17212b;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.draw-card--idle {
  block-size: clamp(4.8rem, 12vh, 7.2rem);
  color: #17212b;
}

.hand-card {
  transition: filter 160ms ease, transform 160ms ease;
}

.hand-card--playable .domino {
  box-shadow: 0 0 0 0.24rem rgb(var(--v-theme-primary) / 52%), 0 0.55rem 1.2rem rgb(61 41 23 / 16%);
}

.hand-card--selected .domino {
  box-shadow: 0 0 0 0.28rem rgb(var(--v-theme-secondary)), 0 0.55rem 1.2rem rgb(61 41 23 / 16%);
}

.hand-card--mistake {
  filter: saturate(0.72) opacity(0.72);
  transform: scale(0.97);
}

.domino {
  background: #fffaf0;
  border: 0.2rem solid #46372d;
  border-radius: 1rem;
  box-shadow: 0 0.55rem 1.2rem rgb(61 41 23 / 16%);
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  inline-size: clamp(5.7rem, 10.5vh, 8.2rem);
  min-block-size: clamp(3.6rem, 7.8vh, 5.7rem);
  overflow: hidden;
}

.domino--hand {
  inline-size: clamp(5.2rem, 9.5vh, 7.5rem);
  min-block-size: clamp(3.4rem, 7.2vh, 5.2rem);
}

.domino--player {
  background: #fff1bf;
}

.domino--bot {
  background: #e7f7f1;
}

.domino__half {
  border-inline-end: 0.14rem solid #6d5a4a;
  position: relative;
}

.domino__half:last-child {
  border-inline-end: 0;
}

.domino__dot {
  background: #332923;
  border-radius: 999rem;
  inline-size: clamp(0.4rem, 0.95vh, 0.62rem);
  min-block-size: clamp(0.4rem, 0.95vh, 0.62rem);
  position: absolute;
  transform: translate(-50%, -50%);
}

.domino__dot--top-left {
  inset-block-start: 25%;
  inset-inline-start: 27%;
}

.domino__dot--top-right {
  inset-block-start: 25%;
  inset-inline-start: 73%;
}

.domino__dot--middle-left {
  inset-block-start: 50%;
  inset-inline-start: 27%;
}

.domino__dot--center {
  inset-block-start: 50%;
  inset-inline-start: 50%;
}

.domino__dot--middle-right {
  inset-block-start: 50%;
  inset-inline-start: 73%;
}

.domino__dot--bottom-left {
  inset-block-start: 75%;
  inset-inline-start: 27%;
}

.domino__dot--bottom-right {
  inset-block-start: 75%;
  inset-inline-start: 73%;
}

@media (max-height: 44rem) {
  .game-container {
    padding-block: 4.5rem 0.7rem;
  }

  .domino-card {
    max-block-size: calc(100dvh - 5.2rem);
  }

  .game-container h1,
  .game-container .text-overline {
    display: none;
  }

  .instruction {
    margin-block-end: 0.45rem !important;
  }

  .board-zone {
    max-block-size: 24vh;
  }

  .hand-row {
    max-block-size: 34vh;
  }
}
</style>
