<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";

type BridgePiece = {
  id: string;
  order: number;
  label: string;
  kind: "support" | "plank";
  color: string;
  placed: boolean;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSessionFor("build-bridge", {
  maxSteps: 8,
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const pieces = reactive<BridgePiece[]>([]);
const resultVisible = ref(false);
const lastMistakeId = ref<string>();
const feedbackMessage = ref("Начни с опор. Следующая деталь мягко подсвечена.");
const orderedPieces = computed(() => [...pieces].sort((a, b) => a.order - b.order));
const placedPieces = computed(() => orderedPieces.value.filter((piece) => piece.placed));
const nextPiece = computed(() => orderedPieces.value.find((piece) => !piece.placed));
const currentRoundId = computed(() => `build-bridge:round:${session.step + 1}`);
let resultTimer = 0;

function pieceTargetId(piece: BridgePiece) {
  return `build-bridge:piece:${piece.id}`;
}

function resetPieces() {
  pieces.splice(0, pieces.length,
    { id: "support-left", order: 1, label: "левая опора", kind: "support", color: "#8ecae6", placed: false },
    { id: "support-center", order: 2, label: "средняя опора", kind: "support", color: "#90caf9", placed: false },
    { id: "support-right", order: 3, label: "правая опора", kind: "support", color: "#80cbc4", placed: false },
    { id: "plank-one", order: 4, label: "доска 1", kind: "plank", color: "#d7a86e", placed: false },
    { id: "plank-two", order: 5, label: "доска 2", kind: "plank", color: "#c99055", placed: false },
    { id: "plank-three", order: 6, label: "доска 3", kind: "plank", color: "#d7a86e", placed: false },
    { id: "plank-four", order: 7, label: "доска 4", kind: "plank", color: "#c99055", placed: false },
    { id: "plank-five", order: 8, label: "доска 5", kind: "plank", color: "#d7a86e", placed: false }
  );
}

function clearResultTimer() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
}

function scheduleResultDialog() {
  clearResultTimer();
  resultTimer = window.setTimeout(() => {
    resultVisible.value = true;
  }, 1200);
}

function choosePiece(piece: BridgePiece) {
  if (session.status !== "running" || piece.placed) return;

  const expectedPiece = nextPiece.value;
  const targetId = pieceTargetId(piece);
  const expectedTargetId = expectedPiece ? pieceTargetId(expectedPiece) : undefined;
  if (piece.id !== expectedPiece?.id) {
    feedbackMessage.value = expectedPiece ? `Почти. Сначала нужна деталь: ${expectedPiece.label}. Мост стоит спокойно.` : "Мост уже собран.";
    lastMistakeId.value = piece.id;
    recordMistake({ roundId: currentRoundId.value, targetId, expectedTargetId, expected: expectedPiece?.label, actual: piece.label, isCorrect: false });
    if (expectedTargetId) recordHint({ roundId: currentRoundId.value, targetId: expectedTargetId, reason: "sequence-order" });
    return;
  }

  piece.placed = true;
  lastMistakeId.value = undefined;
  feedbackMessage.value = piece.kind === "support" ? `${piece.label} на месте. Мост становится крепче.` : `${piece.label} легла на мост.`;
  recordSuccess({ roundId: currentRoundId.value, targetId, answerId: piece.id, expected: piece.label, actual: piece.label, isCorrect: true });

  if (placedPieces.value.length >= pieces.length && session.status === "running") {
    feedbackMessage.value = "Мост готов. По нему можно спокойно перейти.";
    finishSession("game-complete");
  }
}

function restart() {
  clearResultTimer();
  resultVisible.value = false;
  lastMistakeId.value = undefined;
  feedbackMessage.value = "Начни с опор. Следующая деталь мягко подсвечена.";
  resetPieces();
  startSession();
}

resetPieces();

onUnmounted(() => {
  clearResultTimer();
});

watch(() => session.status, (status) => {
  if (status === "finished") scheduleResultDialog();
  else {
    clearResultTimer();
    resultVisible.value = false;
  }
});
</script>

<template>
  <div class="build-bridge-shell">
    <GameHud title="Строим мост" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Последовательность деталей</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Построй мост по порядку</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ feedbackMessage }}</p>

            <div class="play-area">
              <v-card class="bridge-card pa-4 pa-md-6" color="light-blue-lighten-5" rounded="xl" variant="flat">
                <div class="bridge-stage" aria-label="Собранный мост">
                  <div class="river" />
                  <div class="bank bank--left" />
                  <div class="bank bank--right" />
                  <div class="support support--left" :class="{ 'piece-visible': pieces[0]?.placed }" />
                  <div class="support support--center" :class="{ 'piece-visible': pieces[1]?.placed }" />
                  <div class="support support--right" :class="{ 'piece-visible': pieces[2]?.placed }" />
                  <div class="bridge-deck">
                    <div v-for="piece in orderedPieces.filter((item) => item.kind === 'plank')" :key="`placed-${piece.id}`" class="deck-plank" :class="{ 'piece-visible': piece.placed }" :style="{ background: piece.color }" />
                  </div>
                </div>
                <div class="d-flex flex-wrap align-center justify-center ga-3 mt-4">
                  <v-chip v-if="nextPiece" color="primary" size="large" variant="tonal">Следующая: {{ nextPiece.label }}</v-chip>
                  <v-chip v-else color="success" size="large" variant="tonal">Мост готов</v-chip>
                </div>
              </v-card>

              <div class="piece-grid" aria-label="Детали моста">
                <GameDwellButton v-for="piece in orderedPieces" :key="piece.id" :target-id="pieceTargetId(piece)" :disabled="session.status !== 'running' || piece.placed" :dwell-ms="session.settings.dwellMs" :min-height="150" :color="piece.id === nextPiece?.id ? 'teal-lighten-5' : 'surface'" @select="choosePiece(piece)">
                  <template #default>
                    <div :class="['choice-piece', { 'choice-piece--next': piece.id === nextPiece?.id, 'choice-piece--mistake': piece.id === lastMistakeId }]">
                      <v-icon :icon="piece.kind === 'support' ? 'mdi-pillar' : 'mdi-minus-thick'" :color="piece.kind === 'support' ? 'blue-grey-darken-1' : 'brown-darken-1'" size="56" />
                      <div class="piece-label text-h6 text-md-h5 font-weight-bold mt-2">{{ piece.label }}</div>
                      <div class="piece-step text-body-2">шаг {{ piece.order }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>

            <v-expand-transition>
              <v-alert v-if="lastMistakeId" class="mt-5 text-h6" color="primary" icon="mdi-lightbulb-on-outline" rounded="xl" variant="tonal">
                Ошибка не ломает мост. Посмотри на подсвеченную следующую деталь.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Строим мост" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.build-bridge-shell {
  background: linear-gradient(135deg, #e0f7fa 0%, #fff8e1 54%, #eef7f6 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.play-area {
  align-items: stretch;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: minmax(20rem, 1.2fr) minmax(22rem, 1fr);
}

.bridge-card {
  min-inline-size: 0;
}

.bridge-stage {
  block-size: min(27rem, 46vh);
  border-radius: 1.5rem;
  overflow: hidden;
  position: relative;
}

.river {
  background: linear-gradient(135deg, #81d4fa 0%, #4fc3f7 50%, #80deea 100%);
  inset: 0;
  position: absolute;
}

.river::after {
  background: repeating-linear-gradient(115deg, rgb(255 255 255 / 26%) 0 0.5rem, transparent 0.5rem 2.8rem);
  content: "";
  inset: 0;
  position: absolute;
}

.bank {
  background: linear-gradient(180deg, #c5e1a5 0%, #8bc34a 100%);
  block-size: 5.5rem;
  border-radius: 999px;
  inset-block-end: -2.5rem;
  position: absolute;
  inline-size: 38%;
  z-index: 2;
}

.bank--left {
  inset-inline-start: -5%;
}

.bank--right {
  inset-inline-end: -5%;
}

.support {
  background: linear-gradient(180deg, #b0bec5 0%, #78909c 100%);
  block-size: 9rem;
  border: 0.25rem solid rgb(255 255 255 / 42%);
  border-radius: 1rem 1rem 0.35rem 0.35rem;
  inline-size: 3.1rem;
  inset-block-end: 3.1rem;
  opacity: 0;
  position: absolute;
  transform: translateY(1rem);
  transition: opacity 220ms ease, transform 220ms ease;
  z-index: 3;
}

.support--left {
  inset-inline-start: 22%;
}

.support--center {
  inset-inline-start: calc(50% - 1.55rem);
}

.support--right {
  inset-inline-end: 22%;
}

.bridge-deck {
  display: grid;
  gap: 0.35rem;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  inline-size: 72%;
  inset-block-end: 11.7rem;
  inset-inline-start: 14%;
  position: absolute;
  z-index: 4;
}

.deck-plank {
  block-size: 3.7rem;
  border: 0.22rem solid rgb(92 64 51 / 28%);
  border-radius: 0.8rem;
  box-shadow: 0 0.7rem 1.1rem rgb(69 90 100 / 18%);
  opacity: 0;
  transform: translateY(-0.7rem);
  transition: opacity 220ms ease, transform 220ms ease;
}

.piece-visible {
  opacity: 1;
  transform: translateY(0);
}

.piece-grid {
  display: grid;
  gap: 0.8rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.choice-piece {
  align-items: center;
  color: #17212b;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: filter 160ms ease, transform 160ms ease;
}

.piece-label,
.piece-step {
  color: #17212b !important;
}

.choice-piece--next {
  filter: drop-shadow(0 0 1rem rgb(var(--v-theme-primary) / 34%));
  transform: scale(1.03);
}

.choice-piece--mistake {
  filter: grayscale(0.3) opacity(0.78);
  transform: scale(0.97);
}

@media (max-width: 960px) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .play-area {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .piece-grid {
    grid-template-columns: 1fr;
  }

  .bridge-stage {
    block-size: 19rem;
  }
}

@media (max-height: 680px) {
  .game-container {
    padding-block-start: 104px;
  }

  .game-container :deep(.v-card.pa-4) {
    padding: 1rem !important;
  }

  .game-container .text-overline,
  .game-container p {
    display: none;
  }

  .play-area {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .piece-grid {
    gap: 0.6rem;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    order: -1;
  }

  .piece-grid :deep(.dwell-hitbox) {
    min-block-size: 6.75rem !important;
  }

  .piece-grid :deep(.dwell-button) {
    padding: 0.75rem !important;
  }

  .bridge-card {
    padding: 0.75rem !important;
  }

  .bridge-stage {
    block-size: 11rem;
  }
}
</style>
