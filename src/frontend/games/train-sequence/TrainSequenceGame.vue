<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Wagon = {
  id: string;
  number: number;
  color: string;
  label: string;
  placed: boolean;
  placedIndex?: number;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSession("train-sequence", {
  maxSteps: 5,
  dwellMs: 1200,
  sessionSeconds: 120
}, {
  finishOnMaxSteps: false
});

const wagons = reactive<Wagon[]>([]);
const resultVisible = ref(false);
const trainDeparting = ref(false);
const feedbackMessage = ref("Выбирай вагоны спокойно. Подсказка показывает следующий вагон.");
const orderedWagons = computed(() => [...wagons].sort((a, b) => a.number - b.number));
const placedWagons = computed(() => wagons.filter((wagon) => wagon.placed).sort((a, b) => (a.placedIndex ?? 0) - (b.placedIndex ?? 0)));
const nextWagon = computed(() => orderedWagons.value.find((wagon) => !wagon.placed));
const currentRoundId = computed(() => `train-sequence:round:${session.step + 1}`);
let resultTimer = 0;

function wagonTargetId(wagon: Wagon) {
  return `train-sequence:wagon:${wagon.id}`;
}

function resetWagons() {
  wagons.splice(0, wagons.length,
    { id: "red", number: 1, color: "#ef9a9a", label: "красный", placed: false },
    { id: "yellow", number: 2, color: "#ffe082", label: "жёлтый", placed: false },
    { id: "green", number: 3, color: "#a5d6a7", label: "зелёный", placed: false },
    { id: "blue", number: 4, color: "#90caf9", label: "синий", placed: false },
    { id: "violet", number: 5, color: "#ce93d8", label: "фиолетовый", placed: false }
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
  }, 1800);
}

function chooseWagon(wagon: Wagon) {
  if (session.status !== "running" || wagon.placed) return;

  const expectedWagon = nextWagon.value;
  const roundId = currentRoundId.value;
  const nextPlacedIndex = placedWagons.value.length + 1;
  const isCorrect = wagon.id === expectedWagon?.id;

  wagon.placed = true;
  wagon.placedIndex = nextPlacedIndex;

  if (isCorrect) {
    feedbackMessage.value = `Верно. Вагон ${wagon.number} прицепился к поезду.`;
    recordSuccess({ roundId, targetId: wagonTargetId(wagon), expected: wagon.id, actual: wagon.id, isCorrect: true });
  } else {
    feedbackMessage.value = "Вагон тоже прицепился. Продолжим собирать поезд спокойно.";
    recordMistake({ roundId, targetId: wagonTargetId(wagon), expectedTargetId: expectedWagon ? wagonTargetId(expectedWagon) : undefined, expected: expectedWagon?.id, actual: wagon.id, isCorrect: false });
    if (session.status === "running") session.step += 1;
  }

  if (placedWagons.value.length >= wagons.length && session.status === "running") {
    feedbackMessage.value = "Поезд собран. Он мягко отправляется в путь.";
    trainDeparting.value = true;
    finishSession("game-complete");
  }
}

function restart() {
  clearResultTimer();
  resultVisible.value = false;
  trainDeparting.value = false;
  feedbackMessage.value = "Выбирай вагоны спокойно. Подсказка показывает следующий вагон.";
  resetWagons();
  startSession();
}

resetWagons();

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
  <div class="train-shell">
    <GameHud title="Поезд" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Собери поезд</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">Прицепи пять вагонов. Можно выбрать любой вагон: поезд примет каждый выбор.</p>

            <v-card class="hint-card pa-4 pa-md-5 mb-6" color="blue-lighten-5" rounded="xl" variant="flat">
              <div class="text-caption text-medium-emphasis mb-1">Следующий по подсказке</div>
              <div v-if="nextWagon" class="d-flex flex-wrap align-center ga-3">
                <v-avatar :color="nextWagon.color" size="56"><span class="text-h5 font-weight-bold">{{ nextWagon.number }}</span></v-avatar>
                <div class="text-h5 font-weight-bold">Вагон {{ nextWagon.number }}, {{ nextWagon.label }}</div>
              </div>
              <div v-else class="text-h5 font-weight-bold">Все вагоны прицеплены.</div>
            </v-card>

            <div class="play-area">
              <v-card class="track-card pa-5" color="cyan-lighten-5" rounded="xl" variant="flat">
                <div :class="['train-track', { 'train-track--departing': trainDeparting }]" aria-label="Собранный поезд">
                  <div class="locomotive">
                    <div class="chimney" />
                    <div class="cabin" />
                    <div class="engine-window" />
                    <div class="engine-body" />
                    <div class="wheel wheel--front" />
                    <div class="wheel wheel--back" />
                  </div>
                  <div v-for="wagon in placedWagons" :key="`placed-${wagon.id}`" class="track-wagon" :style="{ background: wagon.color }">
                    <span>{{ wagon.number }}</span>
                    <div class="wagon-wheel wagon-wheel--left" />
                    <div class="wagon-wheel wagon-wheel--right" />
                  </div>
                </div>
                <div class="rail" />
                <div class="text-body-1 text-center text-medium-emphasis mt-5">{{ feedbackMessage }}</div>
              </v-card>

              <div class="wagon-grid">
                <GameDwellButton v-for="wagon in wagons" :key="wagon.id" :target-id="wagonTargetId(wagon)" :disabled="session.status !== 'running' || wagon.placed" :dwell-ms="session.settings.dwellMs" :min-height="150" color="surface" @select="chooseWagon(wagon)">
                  <template #default>
                    <div class="wagon-card-content" :style="{ opacity: wagon.placed ? 0.28 : 1 }">
                      <div class="loose-wagon" :style="{ background: wagon.color }">
                        <span>{{ wagon.number }}</span>
                      </div>
                      <div class="text-subtitle-1 font-weight-bold mt-3">{{ wagon.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Поезд" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.train-shell {
  background: linear-gradient(135deg, #e3f2fd 0%, #fff8e1 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.hint-card {
  border: 2px solid rgb(var(--v-theme-primary) / 18%);
}

.play-area {
  align-items: stretch;
  display: grid;
  gap: 28px;
  grid-template-columns: 1.25fr 1fr;
}

.track-card {
  min-inline-size: 0;
  overflow: hidden;
}

.train-track {
  align-items: flex-end;
  display: flex;
  gap: 12px;
  min-block-size: 260px;
  min-inline-size: max-content;
  padding-block-start: 72px;
  transition: transform 1800ms ease-in;
}

.train-track--departing {
  transform: translateX(42%);
}

.locomotive,
.track-wagon,
.loose-wagon {
  border: 3px solid rgb(69 90 100 / 36%);
  box-shadow: 0 12px 20px rgb(69 90 100 / 18%);
  position: relative;
}

.locomotive {
  background: linear-gradient(180deg, #80deea 0%, #26c6da 100%);
  border-radius: 28px 18px 16px 16px;
  block-size: 112px;
  inline-size: 166px;
}

.chimney {
  background: #607d8b;
  block-size: 42px;
  border-radius: 12px 12px 4px 4px;
  inline-size: 28px;
  inset-block-start: -38px;
  inset-inline-start: 24px;
  position: absolute;
}

.cabin {
  background: #4dd0e1;
  block-size: 78px;
  border-radius: 20px 20px 8px 8px;
  inline-size: 62px;
  inset-block-start: -28px;
  inset-inline-end: 18px;
  position: absolute;
}

.engine-window {
  background: #e1f5fe;
  block-size: 32px;
  border-radius: 10px;
  inline-size: 34px;
  inset-block-start: -10px;
  inset-inline-end: 32px;
  position: absolute;
}

.engine-body {
  background: rgb(255 255 255 / 42%);
  block-size: 30px;
  border-radius: 999px;
  inline-size: 84px;
  inset-block-start: 34px;
  inset-inline-start: 20px;
  position: absolute;
}

.wheel,
.wagon-wheel {
  background: #546e7a;
  border: 5px solid #eceff1;
  border-radius: 999px;
  block-size: 34px;
  inline-size: 34px;
  inset-block-end: -18px;
  position: absolute;
}

.wheel--front,
.wagon-wheel--right {
  inset-inline-end: 22px;
}

.wheel--back,
.wagon-wheel--left {
  inset-inline-start: 22px;
}

.track-wagon,
.loose-wagon {
  align-items: center;
  border-radius: 24px;
  color: #263238;
  display: flex;
  font-size: 2.4rem;
  font-weight: 800;
  justify-content: center;
}

.track-wagon {
  block-size: 104px;
  inline-size: 132px;
}

.loose-wagon {
  block-size: 74px;
  inline-size: min(190px, 100%);
  margin-inline: auto;
}

.rail {
  background: linear-gradient(90deg, #8d6e63 0 8%, transparent 8% 14%, #8d6e63 14% 22%, transparent 22% 28%, #8d6e63 28% 36%, transparent 36% 42%, #8d6e63 42% 50%, transparent 50% 56%, #8d6e63 56% 64%, transparent 64% 70%, #8d6e63 70% 78%, transparent 78% 84%, #8d6e63 84% 92%, transparent 92% 100%);
  block-size: 14px;
  border-block: 4px solid #6d4c41;
  border-radius: 999px;
}

.wagon-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.wagon-card-content {
  inline-size: 100%;
}

@media (max-width: 1100px) {
  .play-area {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 104px;
  }

  .train-track {
    gap: 8px;
    transform-origin: left bottom;
  }

  .locomotive {
    inline-size: 138px;
  }

  .track-wagon {
    inline-size: 106px;
  }

  .wagon-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 680px) {
  .game-container {
    padding-block-start: 104px;
  }

  .game-container :deep(.v-card.pa-5) {
    padding: 1rem !important;
  }

  .game-container p,
  .track-card .text-body-1 {
    display: none;
  }

  .hint-card {
    margin-block-end: 0.75rem !important;
    padding: 0.75rem !important;
  }

  .play-area {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .wagon-grid {
    gap: 0.6rem;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    order: -1;
  }

  .track-card {
    padding: 0.75rem !important;
  }

  .train-track {
    min-block-size: 150px;
    padding-block-start: 2rem;
  }

  .loose-wagon {
    block-size: 54px;
  }
}
</style>
