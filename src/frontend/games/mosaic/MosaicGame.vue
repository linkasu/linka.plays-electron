<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { createMosaicStep, createMosaicTiles, isMosaicChoiceCorrect, mosaicTileCount, selectMosaicImageIndex, type MosaicTile } from "./model";

const mosaicFeedback = createStandardGameFeedback();

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("mosaic", {
  maxSteps: mosaicTileCount,
  overrides: { dwellMs: 1300, sessionSeconds: 150, sound: true },
  finishOnMistakes: false
});

const imageIndex = ref(selectMosaicImageIndex());
const placedTileIds = ref<string[]>([]);
const resultVisible = ref(false);
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const wrongTileId = ref<string>();
const successTileId = ref<string>();
const promptAudio = useGamePromptAudio({ gameId: "mosaic", soundEnabled: toRef(session.settings, "sound") });
const feedbackMessage = ref("Найди кусочек для подсвеченной клетки.");
let feedbackTimer = 0;
let resultTimer = 0;

const activeStep = computed(() => createMosaicStep(session.settings, Math.min(session.step, mosaicTileCount - 1), imageIndex.value));
const image = computed(() => activeStep.value.image);
const tiles = computed(() => createMosaicTiles(image.value));
const currentTarget = computed(() => session.step < mosaicTileCount ? activeStep.value.target : undefined);
const mosaicSlots = computed(() => tiles.value.map((tile, index) => ({
  index,
  tile,
  filled: placedTileIds.value.includes(tile.id),
  next: index === session.step && session.status === "running"
})));
const promptText = computed(() => currentTarget.value ? activeStep.value.prompt : "Мозаика готова.");
const boardInteractionLocked = computed(() => session.status !== "running" || pendingSelection.value || isSpeaking.value);

function tileTargetId(tile: MosaicTile) {
  return `mosaic:tile:${image.value.id}:${tile.id}`;
}

function tilePieceStyle(tile: MosaicTile) {
  return {
    "--mosaic-image": `url(${image.value.src})`,
    "--tile-x": `${tile.col * 50}%`,
    "--tile-y": `${tile.row * 50}%`
  };
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearResultTimer() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
}

function clearTransientFeedback() {
  pendingSelection.value = false;
  isSpeaking.value = false;
  wrongTileId.value = undefined;
  successTileId.value = undefined;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["mosaic.prompt"], delayMs);
  isSpeaking.value = false;
}

function showResultSoon(delayMs = 900) {
  clearResultTimer();
  resultTimer = window.setTimeout(() => {
    resultVisible.value = true;
  }, delayMs);
}

async function chooseTile(tile: MosaicTile) {
  if (boardInteractionLocked.value || !currentTarget.value) return;

  const step = activeStep.value;
  const targetId = tileTargetId(tile);
  const expectedTargetId = tileTargetId(step.target);
  clearFeedbackTimer();

  if (isMosaicChoiceCorrect(tile, step.target)) {
    pendingSelection.value = true;
    successTileId.value = tile.id;
    placedTileIds.value = [...placedTileIds.value, tile.id];
    feedbackMessage.value = "Верно. Кусочек на месте.";
    recordSuccess({ roundId: step.roundId, targetId, answerId: tile.id, expected: step.target.id, actual: tile.id, imageId: image.value.id, slotIndex: step.slotIndex, isCorrect: true });
    const finishedAfterSuccess = session.step >= session.maxSteps;
    void mosaicFeedback.playSuccess(session.settings.sound);
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["mosaic.correct", "mosaic.complete"] : ["mosaic.correct"], 80, 170);
    isSpeaking.value = false;
    feedbackTimer = window.setTimeout(() => {
      clearTransientFeedback();
      if (session.status === "running") {
        feedbackMessage.value = "Продолжай. Следующая клетка ждёт кусочек.";
      }
    }, 720);
    return;
  }

  pendingSelection.value = true;
  wrongTileId.value = tile.id;
  feedbackMessage.value = "Посмотри на подсвеченную клетку и попробуй другой кусочек.";
  recordMistake({ roundId: step.roundId, targetId, expectedTargetId, answerId: tile.id, expected: step.target.id, actual: tile.id, imageId: image.value.id, slotIndex: step.slotIndex, isCorrect: false });
  void mosaicFeedback.playMistake(session.settings.sound);
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["mosaic.mistake"], 80);
  isSpeaking.value = false;
  feedbackTimer = window.setTimeout(() => {
    clearTransientFeedback();
  }, 1250);
}

function choiceColor(tile: MosaicTile) {
  if (successTileId.value === tile.id) return "green-lighten-4";
  if (wrongTileId.value === tile.id) return "orange-lighten-4";
  return "surface";
}

function restart() {
  clearFeedbackTimer();
  clearResultTimer();
  promptAudio.cancelPending();
  imageIndex.value = selectMosaicImageIndex();
  placedTileIds.value = [];
  resultVisible.value = false;
  pendingSelection.value = false;
  isSpeaking.value = false;
  wrongTileId.value = undefined;
  successTileId.value = undefined;
  feedbackMessage.value = "Найди кусочек для подсвеченной клетки.";
  startSession();
  void playPrompt(450);
}

watch(() => session.status, (status) => {
  if (status === "finished") {
    if (!isSpeaking.value) showResultSoon();
    return;
  }

  clearResultTimer();
  resultVisible.value = false;
});

watch(isSpeaking, (speaking) => {
  if (!speaking && session.status === "finished" && !resultVisible.value) showResultSoon();
});

onMounted(() => {
  promptAudio.warm();
  mosaicFeedback.warm(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearFeedbackTimer();
  clearResultTimer();
  promptAudio.cancelPending();
  mosaicFeedback.dispose();
});
</script>

<template>
  <GamePageShell class="mosaic-shell" gradient="linear-gradient(135deg, #eef7ff 0%, #fff7e7 46%, #f2efff 100%)" padding-top="5rem">
    <template #hud>
      <GameHud title="Мозаика" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>

    <v-container class="mosaic-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col class="mosaic-col" cols="12">
          <v-card class="mosaic-card pa-3 pa-sm-4" rounded="xl" elevation="8">
            <div class="mosaic-header">
              <div>
                <div class="text-overline text-secondary">Пазл 3 × 3</div>
                <h1 class="mosaic-title font-weight-bold">{{ image.title }}</h1>
              </div>
              <v-chip class="font-weight-bold" color="primary" size="large" variant="tonal">{{ placedTileIds.length }} / {{ session.maxSteps }}</v-chip>
            </div>
            <p class="mosaic-feedback text-body-1 text-md-h6 text-medium-emphasis mb-3">{{ feedbackMessage }}</p>

            <div class="mosaic-layout">
              <section class="mosaic-board-wrap" aria-label="Поле мозаики 3 на 3">
                <div class="mosaic-board">
                  <v-card v-for="slot in mosaicSlots" :key="slot.tile.id" :class="['mosaic-slot', { 'mosaic-slot--next': slot.next, 'mosaic-slot--filled': slot.filled }]" rounded="lg" variant="flat">
                    <div v-if="slot.filled" class="mosaic-piece mosaic-piece--placed" :style="tilePieceStyle(slot.tile)" />
                    <div v-else-if="slot.next" class="mosaic-empty mosaic-empty--next">
                      <v-icon icon="mdi-help" color="primary" />
                      <span>сюда</span>
                    </div>
                    <div v-else class="mosaic-empty" aria-hidden="true" />
                  </v-card>
                </div>
              </section>

              <aside class="mosaic-side">
                <div class="mosaic-guide">
                  <v-card class="mosaic-prompt pa-3" color="blue-lighten-5" rounded="xl" variant="flat">
                    <div class="text-caption text-medium-emphasis">Подсказка</div>
                    <div class="text-h6 font-weight-bold">{{ promptText }}</div>
                    <div class="text-body-2 text-medium-emphasis">{{ image.prompt }}</div>
                  </v-card>

                  <v-card class="mosaic-reference pa-3" color="surface" rounded="xl" variant="tonal">
                    <div class="text-caption text-medium-emphasis mb-2">Образец</div>
                    <img :src="image.src" :alt="`Образец: ${image.title}`" />
                  </v-card>
                </div>

                <div class="mosaic-choices" aria-label="Кусочки для выбора">
                  <GameDwellButton v-for="choice in activeStep.choices" :key="choice.id" :target-id="tileTargetId(choice)" :disabled="boardInteractionLocked" :dwell-ms="session.settings.dwellMs" min-height="9rem" :color="choiceColor(choice)" @select="chooseTile(choice)">
                    <template #default>
                      <div class="mosaic-piece mosaic-piece--choice" :style="tilePieceStyle(choice)" />
                    </template>
                  </GameDwellButton>
                </div>

                <div class="mosaic-attribution text-caption text-medium-emphasis">{{ image.license }} · {{ image.attribution }}</div>
              </aside>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Мозаика" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.mosaic-container {
  padding-block-end: 0.75rem;
}

.mosaic-col {
  max-inline-size: min(112rem, calc(100vw - 2rem));
}

.mosaic-card {
  background: rgb(255 252 246 / 96%);
}

.mosaic-header {
  align-items: center;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  margin-block-end: 0.25rem;
}

.mosaic-title {
  font-size: clamp(1.45rem, 2.4vw, 2.15rem);
  line-height: 1.05;
}

.mosaic-feedback {
  min-block-size: 1.6rem;
}

.mosaic-layout {
  align-items: start;
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(28rem, min(44vw, 34rem)) minmax(32rem, 1fr);
}

.mosaic-board-wrap {
  align-items: center;
  display: flex;
  justify-content: center;
  min-inline-size: 0;
}

.mosaic-board {
  aspect-ratio: 1;
  background: rgb(var(--v-theme-surface));
  border: 0.45rem solid rgb(255 255 255 / 86%);
  border-radius: 1.5rem;
  box-shadow: 0 1.1rem 2.4rem rgb(70 88 120 / 16%);
  display: grid;
  gap: 0.35rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  inline-size: min(34rem, calc(100vh - 10rem), 100%);
  overflow: hidden;
}

.mosaic-slot {
  align-items: center;
  background: rgb(var(--v-theme-blue-grey-lighten-5));
  border: 0.125rem solid rgb(var(--v-theme-primary) / 10%);
  display: flex;
  justify-content: center;
  min-block-size: 0;
  min-inline-size: 0;
  overflow: hidden;
  position: relative;
}

.mosaic-slot--next {
  box-shadow: inset 0 0 0 0.35rem rgb(var(--v-theme-primary) / 44%);
}

.mosaic-empty {
  align-items: center;
  color: rgb(var(--v-theme-on-surface) / 46%);
  display: flex;
  flex-direction: column;
  font-size: 1.35rem;
  font-weight: 800;
  gap: 0.25rem;
}

.mosaic-empty--next {
  color: rgb(var(--v-theme-primary));
}

.mosaic-piece {
  background-image: var(--mosaic-image);
  background-position: var(--tile-x) var(--tile-y);
  background-size: 300% 300%;
  border-radius: inherit;
  inline-size: 100%;
}

.mosaic-piece--placed {
  block-size: 100%;
}

.mosaic-side {
  display: grid;
  gap: 0.75rem;
  grid-template-rows: auto auto auto;
  max-inline-size: none;
  min-inline-size: 0;
}

.mosaic-guide {
  align-items: stretch;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr) minmax(12rem, 0.52fr);
}

.mosaic-prompt {
  align-content: center;
  display: grid;
}

.mosaic-reference {
  text-align: center;
}

.mosaic-reference img {
  aspect-ratio: 1;
  border-radius: 0.85rem;
  box-shadow: 0 0.45rem 1rem rgb(65 79 104 / 16%);
  display: block;
  inline-size: clamp(5rem, 7vw, 7rem);
  margin-inline: auto;
  object-fit: cover;
}

.mosaic-choices {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mosaic-choices :deep(.dwell-button) {
  min-block-size: clamp(8.5rem, 18vh, 11rem) !important;
  padding: 1rem !important;
}

.mosaic-piece--choice {
  aspect-ratio: 1;
  border: 0.125rem solid rgb(255 255 255 / 82%);
  border-radius: 1rem;
  box-shadow: 0 0.5rem 1rem rgb(65 79 104 / 13%);
  margin-inline: auto;
  max-inline-size: clamp(5.5rem, 7vw, 7.2rem);
}

.mosaic-attribution {
  text-align: center;
}

@media (max-width: 58rem) and (min-width: 43rem) {
 .mosaic-card {
    padding-block: 0.75rem !important;
  }

 .mosaic-feedback,
 .mosaic-attribution {
    display: none;
  }

 .mosaic-layout {
    gap: 0.75rem;
    grid-template-columns: minmax(17rem, 0.86fr) minmax(20rem, 1.14fr);
  }

 .mosaic-guide {
    grid-template-columns: minmax(0, 1fr) minmax(9rem, 0.62fr);
  }

 .mosaic-board {
    inline-size: min(19rem, calc(100vh - 14.5rem), 100%);
  }

 .mosaic-side {
    gap: 0.5rem;
    grid-template-rows: auto 1fr;
  }

 .mosaic-choices {
    gap: 0.45rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

 .mosaic-piece--choice {
    max-inline-size: 4.5rem;
  }

 .mosaic-choices :deep(.dwell-button) {
    min-block-size: 6.8rem !important;
    padding: 0.75rem !important;
  }
}

@media (max-width: 42.99rem) {
 .mosaic-card {
    padding-block: 0.75rem !important;
  }

 .mosaic-feedback,
 .mosaic-attribution {
    display: none;
  }

 .mosaic-layout {
    gap: 0.75rem;
    grid-template-columns: 1fr;
  }

 .mosaic-guide {
    grid-template-columns: 1fr;
  }

 .mosaic-board {
    inline-size: min(19rem, 54vh, 82vw);
  }

 .mosaic-side {
    gap: 0.5rem;
    grid-template-rows: auto 1fr;
    max-inline-size: none;
  }

 .mosaic-choices {
    gap: 0.45rem;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

 .mosaic-piece--choice {
    max-inline-size: 3.75rem;
  }

 .mosaic-choices :deep(.dwell-button) {
    min-block-size: 6.75rem !important;
    padding: 0.75rem !important;
  }
}

@media (max-height: 50rem) and (min-width: 58rem) {
 .mosaic-card {
    padding-block: 0.75rem !important;
  }

 .mosaic-feedback {
    display: none;
  }

 .mosaic-layout {
    grid-template-columns: minmax(27rem, min(42vw, 32rem)) minmax(30rem, 1fr);
  }

 .mosaic-board {
    inline-size: min(32rem, calc(100vh - 9.5rem), 100%);
  }

 .mosaic-side {
    gap: 0.5rem;
    grid-template-rows: auto auto;
  }

 .mosaic-attribution {
    display: none;
  }

 .mosaic-choices {
    gap: 0.5rem;
  }

 .mosaic-choices :deep(.dwell-button) {
    min-block-size: 8rem !important;
  }

 .mosaic-piece--choice {
    max-inline-size: clamp(6rem, 7vw, 7.25rem);
  }

 .mosaic-guide {
    gap: 0.75rem;
    grid-template-columns: minmax(0, 1fr) minmax(10rem, 0.58fr);
  }
}

@media (max-height: 60rem) and (min-width: 70rem) {
 .mosaic-card {
    padding-block: 0.75rem !important;
  }

 .mosaic-feedback,
 .mosaic-attribution {
    display: none;
  }

 .mosaic-layout {
    grid-template-columns: minmax(24rem, min(35vw, 28rem)) minmax(28rem, 1fr);
  }

 .mosaic-board {
    inline-size: min(28rem, calc(100dvh - 11rem), 100%);
  }

 .mosaic-side {
    gap: 0.5rem;
  }

 .mosaic-choices {
    gap: 0.5rem;
  }

 .mosaic-choices :deep(.dwell-button) {
    min-block-size: 7rem !important;
  }

 .mosaic-piece--choice {
    max-inline-size: 5.25rem;
  }

  .mosaic-reference img {
    inline-size: clamp(4.5rem, 6vw, 5.75rem);
  }
}

@media (max-height: 50rem) and (min-width: 58rem) and (max-width: 70rem) {
 .mosaic-attribution {
    display: none;
  }

 .mosaic-layout {
    grid-template-columns: minmax(21rem, 0.9fr) minmax(28rem, 1.1fr);
  }

 .mosaic-board {
    inline-size: min(23rem, calc(100vh - 11rem), 100%);
  }

 .mosaic-piece--choice {
    max-inline-size: 5.5rem;
  }
}
</style>
