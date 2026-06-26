<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWasdPanel, { type GameWasdControl } from "../../components/game/GameWasdPanel.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { calm2048Outcome, canMove, createInitialBoard, highestTile, moveBoard, spawnTile, type Calm2048Board, type Calm2048Direction } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("calm-2048", {
  maxSteps: 32,
  overrides: { preset: "gentle", targetScale: 1.15, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "calm-2048", soundEnabled, warmAssetIds: ["calm-2048.prompt", "calm-2048.correct", "calm-2048.mistake", "calm-2048.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const directions = [
  { direction: "up", key: "w", label: "Вверх", icon: "mdi-arrow-up-bold" },
  { direction: "left", key: "a", label: "Влево", icon: "mdi-arrow-left-bold" },
  { direction: "down", key: "s", label: "Вниз", icon: "mdi-arrow-down-bold" },
  { direction: "right", key: "d", label: "Вправо", icon: "mdi-arrow-right-bold" }
] as const;

const board = ref<Calm2048Board>(createInitialBoard());
const previousBoard = ref<Calm2048Board>();
const feedbackMessage = ref("Собирай одинаковые плитки без спешки. Каждый удачный сдвиг засчитывается.");
const lastSpawnedIndex = ref<number>();
const isSpeaking = ref(false);

const resultVisible = computed(() => session.status === "finished");
const hasMoves = computed(() => canMove(board.value));
const canUndo = computed(() => Boolean(previousBoard.value) && session.status === "running");
const maxTile = computed(() => highestTile(board.value));
const directionButtons = computed<GameWasdControl[]>(() => directions.map((item) => ({
  id: item.direction,
  key: item.key,
  label: item.label,
  icon: item.icon,
  targetId: directionTargetId(item.direction),
  color: canMove(board.value, item.direction) ? "surface" : "blue-grey-lighten-5"
})));

function directionTargetId(direction: Calm2048Direction) {
  return `calm-2048:direction:${direction}`;
}

function actionTargetId(action: string) {
  return `calm-2048:action:${action}`;
}

async function chooseDirection(direction: Calm2048Direction) {
  if (session.status !== "running" || isSpeaking.value || !hasMoves.value) return;

  const beforeMove = [...board.value];
  const move = moveBoard(board.value, direction);
  const targetId = directionTargetId(direction);

  if (!move.moved) {
    feedbackMessage.value = "В эту сторону плитки уже спокойно стоят. Попробуй другое направление.";
    recordMistake({ targetId, direction, reason: "blocked", isCorrect: false });
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(["calm-2048.mistake"], 80);
    isSpeaking.value = false;
    return;
  }

  const finishedAfterSuccess = session.step + 1 >= session.maxSteps;
  previousBoard.value = beforeMove;
  const spawn = spawnTile(move.board);
  board.value = spawn.board;
  lastSpawnedIndex.value = spawn.spawnedIndex;
  recordSuccess({ targetId, direction, merged: move.merged, scoreGain: move.scoreGain, highestTile: highestTile(board.value), isCorrect: true });

  if (calm2048Outcome(board.value) === "loss") {
    feedbackMessage.value = "Ходов больше нет. Доска завершена, можно начать новую спокойно.";
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    await promptAudio.playSequenceAndWait(["calm-2048.correct", "calm-2048.complete"], 80, 170);
    finishSession("game-lost");
    isSpeaking.value = false;
  } else if (move.merged) {
    feedbackMessage.value = `Есть слияние: +${move.scoreGain}. Продолжаем спокойно.`;
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["calm-2048.correct", "calm-2048.complete"] : ["calm-2048.correct"], 80, 170);
    if (finishedAfterSuccess) finishSession("game-complete");
    isSpeaking.value = false;
  } else {
    feedbackMessage.value = "Плитки мягко сдвинулись. Можно искать следующее слияние.";
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["calm-2048.correct", "calm-2048.complete"] : ["calm-2048.correct"], 80, 170);
    if (finishedAfterSuccess) finishSession("game-complete");
    isSpeaking.value = false;
  }
}

function chooseDirectionButton(control: GameWasdControl) {
  chooseDirection(control.id as Calm2048Direction);
}

function undoMove() {
  if (!previousBoard.value || session.status !== "running" || isSpeaking.value) return;
  board.value = previousBoard.value;
  previousBoard.value = undefined;
  lastSpawnedIndex.value = undefined;
  feedbackMessage.value = "Вернули предыдущую доску. Можно выбрать другой спокойный ход.";
  recordEvent("hint", { kind: "undo" });
}

function restart() {
  promptAudio.cancelPending();
  board.value = createInitialBoard();
  previousBoard.value = undefined;
  lastSpawnedIndex.value = undefined;
  isSpeaking.value = false;
  feedbackMessage.value = "Новая доска готова. Сдвигай плитки и собирай мягкие слияния.";
  startSession();
  promptAudio.play("calm-2048.prompt", 220);
}

function tileColor(value: number) {
  if (value >= 1024) return "deep-purple-lighten-3";
  if (value >= 512) return "indigo-lighten-3";
  if (value >= 256) return "blue-lighten-3";
  if (value >= 128) return "cyan-lighten-4";
  if (value >= 64) return "teal-lighten-4";
  if (value >= 32) return "green-lighten-4";
  if (value >= 16) return "lime-lighten-4";
  if (value >= 8) return "amber-lighten-4";
  if (value >= 4) return "orange-lighten-4";
  if (value >= 2) return "blue-grey-lighten-5";
  return "surface-variant";
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("calm-2048.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="calm-2048-shell">
    <GameHud title="2048 мягкий" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-4 pa-md-6" color="rgba(255, 255, 255, 0.92)" rounded="xl" elevation="8">
            <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Спокойная стратегия</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Собирай одинаковые плитки</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Двигай всё поле одной крупной кнопкой. Если ходов не останется, доска завершится.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="primary" size="large" variant="tonal">Лучшая плитка: {{ maxTile || 0 }}</v-chip>
                <v-chip color="secondary" size="large" variant="tonal">Ходов: {{ session.step }} / {{ session.maxSteps }}</v-chip>
              </div>
            </div>

            <v-alert class="compact-feedback mb-5 text-body-1 font-weight-medium" :color="hasMoves ? 'primary' : 'secondary'" icon="mdi-leaf" rounded="xl" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <v-row class="align-center" dense>
              <v-col cols="12" md="7" class="order-2 order-md-1">
                <div class="board-grid mx-auto" role="grid" aria-label="Поле 2048 четыре на четыре">
                  <v-card v-for="(value, index) in board" :key="index" :class="['tile-card', { 'tile-card--new': lastSpawnedIndex === index }]" :color="tileColor(value)" rounded="xl" variant="flat">
                    <div class="tile-value">{{ value || "" }}</div>
                  </v-card>
                </div>
              </v-col>

              <v-col cols="12" md="5" class="order-1 order-md-2">
                <GameWasdPanel :controls="directionButtons" :disabled="session.status !== 'running' || isSpeaking || !hasMoves" :dwell-ms="session.settings.dwellMs" aria-label="Направления 2048" @select="chooseDirectionButton" />

                <v-divider class="my-4" />

                <v-row dense>
                  <v-col cols="6">
                    <GameDwellButton :target-id="actionTargetId('undo')" :disabled="!canUndo || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="112" color="secondary" @select="undoMove">
                      <template #default>
                        <div class="direction-button-content">
                          <v-icon icon="mdi-undo" size="36" />
                          <span>Отменить</span>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                  <v-col cols="6">
                    <GameDwellButton :target-id="actionTargetId('new-board')" :disabled="isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="112" color="primary" @select="restart">
                      <template #default>
                        <div class="direction-button-content">
                          <v-icon icon="mdi-refresh" size="36" />
                          <span>Новая доска</span>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="2048 мягкий" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.calm-2048-shell {
  background:
    radial-gradient(circle at 18% 18%, rgb(200 230 201 / 64%), transparent 30%),
    radial-gradient(circle at 84% 20%, rgb(187 222 251 / 58%), transparent 28%),
    linear-gradient(135deg, #f7fbf1 0%, #eef8ff 54%, #fff7e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 7rem;
}

.board-grid {
  display: grid;
  gap: clamp(0.5rem, 1.5vw, 0.875rem);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  max-inline-size: min(92vw, 35rem);
}

.tile-card {
  align-items: center;
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.tile-card--new {
  box-shadow: 0 0 0 0.3125rem rgb(var(--v-theme-primary) / 20%);
  transform: scale(1.02);
}

.tile-value {
  color: rgb(var(--v-theme-on-surface));
  font-size: clamp(1.7rem, 5.4vw, 4.5rem);
  font-weight: 900;
  line-height: 1;
}

.direction-button-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: 1.05rem;
  font-weight: 800;
  gap: 0.5rem;
  justify-content: center;
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 8.75rem;
  }
}

@media (max-height: 42.5rem) {
  .game-container {
    padding-block-start: 4.75rem;
  }

  .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .game-container .d-flex.flex-column.flex-lg-row,
  .compact-feedback {
    display: none !important;
  }

  .game-container .v-divider {
    margin-block: 0.5rem !important;
  }

  .board-grid {
    gap: 0.35rem;
    max-inline-size: min(54vh, 20rem);
  }
}
</style>
