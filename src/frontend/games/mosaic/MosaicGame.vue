<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { createMosaicStep, getMosaicPattern, type MosaicTile } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("mosaic", {
  maxSteps: 8,
  overrides: { sound: false },
  finishOnMistakes: false
});

const pattern = getMosaicPattern(session.settings);
const resultVisible = ref(false);
const pendingSelection = ref(false);
const hintedTileId = ref<string>();
const wrongTileId = ref<string>();
const successTileId = ref<string>();
const feedbackMessage = ref("Выбирай крупные плитки по подсказке, чтобы заполнить узор.");
let feedbackTimer = 0;

const activeStep = computed(() => createMosaicStep(session.settings, Math.min(session.step, pattern.length - 1)));
const currentTarget = computed(() => session.step < pattern.length ? activeStep.value.target : undefined);
const mosaicSlots = computed(() => pattern.map((tile, index) => ({
  index,
  tile,
  filled: index < session.step,
  next: index === session.step && session.status === "running"
})));
const promptText = computed(() => currentTarget.value ? activeStep.value.prompt : "Узор заполнен. Мозаика готова.");

function tileTargetId(tile: MosaicTile) {
  return `mosaic:tile:${tile.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearTransientFeedback() {
  pendingSelection.value = false;
  wrongTileId.value = undefined;
  successTileId.value = undefined;
}

function chooseTile(tile: MosaicTile) {
  if (session.status !== "running" || pendingSelection.value || !currentTarget.value) return;

  const step = activeStep.value;
  const targetId = tileTargetId(tile);
  const expectedTargetId = tileTargetId(step.target);
  clearFeedbackTimer();

  if (tile.id === step.target.id) {
    pendingSelection.value = true;
    hintedTileId.value = undefined;
    successTileId.value = tile.id;
    feedbackMessage.value = `Верно. Плитка «${tile.label}» встала в узор.`;
    recordSuccess({ roundId: step.roundId, targetId, answerId: tile.id, expected: step.target.label, actual: tile.label, isCorrect: true });
    feedbackTimer = window.setTimeout(() => {
      clearTransientFeedback();
      if (session.status === "running") feedbackMessage.value = "Продолжай по подсказке. Следующая клетка ждёт плитку.";
    }, 550);
    return;
  }

  pendingSelection.value = true;
  hintedTileId.value = step.target.id;
  wrongTileId.value = tile.id;
  feedbackMessage.value = `Почти. ${step.hint}`;
  recordMistake({ roundId: step.roundId, targetId, expectedTargetId, answerId: tile.id, expected: step.target.label, actual: tile.label, isCorrect: false });
  recordHint({ roundId: step.roundId, targetId: expectedTargetId, reason: "wrong-mosaic-tile", color: step.target.colorName, shape: step.target.shapeName });
  feedbackTimer = window.setTimeout(() => {
    clearTransientFeedback();
  }, 1100);
}

function choiceColor(tile: MosaicTile) {
  if (successTileId.value === tile.id) return "green-lighten-4";
  if (wrongTileId.value === tile.id) return "orange-lighten-4";
  if (hintedTileId.value === tile.id) return "primary";
  return "surface";
}

function restart() {
  clearFeedbackTimer();
  resultVisible.value = false;
  pendingSelection.value = false;
  hintedTileId.value = undefined;
  wrongTileId.value = undefined;
  successTileId.value = undefined;
  feedbackMessage.value = "Выбирай крупные плитки по подсказке, чтобы заполнить узор.";
  startSession();
}

watch(() => session.status, (status) => {
  if (status === "finished") {
    clearFeedbackTimer();
    feedbackTimer = window.setTimeout(() => {
      resultVisible.value = true;
    }, 800);
    return;
  }

  resultVisible.value = false;
});

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="mosaic-shell">
    <GameHud title="Мозаика" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Собери простой узор</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Выбери плитку для мозаики</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ feedbackMessage }}</p>

            <v-card class="hint-card pa-4 pa-md-5 mb-5" :color="hintedTileId ? 'amber-lighten-5' : 'blue-lighten-5'" rounded="xl" variant="flat">
              <div class="d-flex flex-column flex-sm-row align-center justify-center ga-4 text-center text-sm-start">
                <v-avatar v-if="currentTarget" :style="{ backgroundColor: currentTarget.background }" size="88" rounded="xl">
                  <v-icon class="hint-icon" :icon="currentTarget.icon" :color="currentTarget.color" />
                </v-avatar>
                <div>
                  <div class="text-caption text-medium-emphasis">Подсказка</div>
                  <div class="text-h5 text-md-h4 font-weight-bold">{{ promptText }}</div>
                  <div v-if="currentTarget" class="text-body-1 text-medium-emphasis mt-1">Цвет: {{ currentTarget.colorName }}. Форма: {{ currentTarget.shapeName }}.</div>
                </div>
              </div>
            </v-card>

            <div class="mosaic-grid mb-6" aria-label="Заполняемый узор мозаики">
              <v-card v-for="slot in mosaicSlots" :key="slot.index" :class="['mosaic-slot', { 'mosaic-slot--next': slot.next, 'mosaic-slot--hint': hintedTileId === slot.tile.id && slot.next }]" :style="slot.filled ? { backgroundColor: slot.tile.background } : undefined" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                <v-icon v-if="slot.filled" class="slot-icon" :icon="slot.tile.icon" :color="slot.tile.color" />
                <div v-else-if="slot.next" class="text-center">
                  <v-icon class="empty-icon" color="primary" icon="mdi-help" />
                  <div class="text-caption font-weight-bold text-primary">сюда</div>
                </div>
                <div v-else class="text-h5 font-weight-bold text-medium-emphasis">{{ slot.index + 1 }}</div>
              </v-card>
            </div>

            <v-row dense justify="center">
              <v-col v-for="choice in activeStep.choices" :key="choice.id" cols="6" sm="3">
                <GameDwellButton :class="{ 'choice-hint': hintedTileId === choice.id }" :target-id="tileTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="chooseTile(choice)">
                  <template #default>
                    <v-avatar :style="{ backgroundColor: choice.background }" size="96" rounded="xl">
                      <v-icon class="choice-icon" :icon="choice.icon" :color="choice.color" />
                    </v-avatar>
                    <div class="text-h6 text-md-h5 font-weight-bold mt-3">{{ choice.label }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="hintedTileId && currentTarget" class="mt-5 text-h6" color="primary" icon="mdi-palette-swatch-outline" rounded="xl" variant="tonal">
                Ошибка не страшна. Нужная плитка подсвечена: {{ currentTarget.label }}.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Мозаика" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.mosaic-shell {
  background: linear-gradient(135deg, #eef7ff 0%, #fff7e7 46%, #f2efff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.hint-card {
  border: 2px solid rgb(var(--v-theme-primary) / 14%);
}

.mosaic-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.mosaic-slot {
  align-items: center;
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  min-block-size: 6.5rem;
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.mosaic-slot--next {
  border: 4px dashed rgb(var(--v-theme-primary) / 46%);
}

.mosaic-slot--hint,
.choice-hint {
  box-shadow: 0 0 0 0.45rem rgb(var(--v-theme-primary) / 24%);
  transform: translateY(-0.12rem);
}

.hint-icon {
  font-size: 4.25rem;
}

.slot-icon {
  filter: drop-shadow(0 0.45rem 0.55rem rgb(0 0 0 / 14%));
  font-size: clamp(3.5rem, 8vw, 6rem);
}

.empty-icon {
  font-size: clamp(2.6rem, 6vw, 4rem);
}

.choice-icon {
  font-size: 4.9rem;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 9.75rem;
  }

  .mosaic-grid {
    gap: 0.55rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-height: 920px) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .hint-card,
  .mosaic-grid {
    display: none;
  }
}
</style>
