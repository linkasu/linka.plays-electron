<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposePyramidAudio, playPyramidCompleteMelody, playPyramidMistakeMelody, playPyramidPlaceMelody, warmPyramidAudio } from "./audio";

type Ring = { id: string; size: number; color: string; placed: boolean; placedIndex?: number };

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSession("pyramid", {
  maxSteps: 4,
  dwellMs: 1200,
  sessionSeconds: 120
}, {
  finishOnMaxSteps: false
});

const rings = reactive<Ring[]>([]);
const resultVisible = ref(false);
const nextRing = computed(() => rings.filter((ring) => !ring.placed).sort((a, b) => b.size - a.size)[0]);
const placedRings = computed(() => rings.filter((ring) => ring.placed).sort((a, b) => (a.placedIndex ?? 0) - (b.placedIndex ?? 0)));
const feedbackMessage = ref("Можно выбирать любое кольцо. Посмотрим, какая пирамидка получится.");
const currentRoundId = computed(() => `pyramid:round:${session.step + 1}`);
let resultTimer = 0;

function ringTargetId(ring: Ring) {
  return `pyramid:ring:${ring.id}`;
}

function resetRings() {
  rings.splice(0, rings.length,
    { id: "ring-1", size: 240, color: "#ff8a65", placed: false },
    { id: "ring-2", size: 200, color: "#ffd54f", placed: false },
    { id: "ring-3", size: 160, color: "#4fc3f7", placed: false },
    { id: "ring-4", size: 120, color: "#9575cd", placed: false }
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

function chooseRing(ring: Ring) {
  if (session.status !== "running" || ring.placed) return;

  const expectedRing = nextRing.value;
  const roundId = currentRoundId.value;
  const nextPlacedIndex = placedRings.value.length + 1;
  const isCorrect = ring.id === expectedRing?.id;

  ring.placed = true;
  ring.placedIndex = nextPlacedIndex;

  if (isCorrect) {
    feedbackMessage.value = "Верно. Кольцо легло на пирамидку.";
    recordSuccess({ roundId, targetId: ringTargetId(ring), expected: ring.id, actual: ring.id, isCorrect: true });
    void playPyramidPlaceMelody(session.settings.sound);
  } else {
    feedbackMessage.value = "Кольцо тоже поставили. В конце посмотрим всю сборку.";
    recordMistake({ roundId, targetId: ringTargetId(ring), expectedTargetId: expectedRing ? ringTargetId(expectedRing) : undefined, expected: expectedRing?.id, actual: ring.id, isCorrect: false });
    if (session.status === "running") session.step += 1;
    void playPyramidMistakeMelody(session.settings.sound);
  }

  if (placedRings.value.length >= rings.length && session.status === "running") {
    feedbackMessage.value = "Пирамидка собрана. Посмотри, как стоят все кольца.";
    finishSession("game-complete");
    void playPyramidCompleteMelody(session.settings.sound);
  }
}

function restart() {
  clearResultTimer();
  resultVisible.value = false;
  resetRings();
  feedbackMessage.value = "Можно выбирать любое кольцо. Посмотрим, какая пирамидка получится.";
  startSession();
}

resetRings();

onMounted(() => {
  warmPyramidAudio(session.settings.sound);
});

onUnmounted(() => {
  clearResultTimer();
  disposePyramidAudio();
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
  <div class="pyramid-shell">
    <GameHud title="Пирамидка" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Собери пирамидку</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-8">Выбирай кольца спокойно. Даже если порядок другой, мы поставим каждое кольцо и покажем всю сборку.</p>
            <div class="play-area">
              <v-card class="stack-card pa-5" color="deep-purple-lighten-5" rounded="xl" variant="flat">
                <div class="stack" aria-label="Собранная пирамидка">
                  <div class="stem" />
                  <div class="stack-layers">
                    <div v-for="ring in placedRings" :key="`placed-${ring.id}`" class="stack-ring" :style="{ inlineSize: `${ring.size}px`, background: ring.color }" />
                  </div>
                  <div class="base" />
                </div>
                <div class="text-body-1 text-center text-medium-emphasis mt-4">{{ feedbackMessage }}</div>
              </v-card>
              <div class="rings">
                <GameDwellButton v-for="ring in rings" :key="ring.id" :target-id="ringTargetId(ring)" :disabled="session.status !== 'running' || ring.placed" :dwell-ms="session.settings.dwellMs" :min-height="130" @select="chooseRing(ring)">
                  <template #default>
                    <div class="loose-ring" :style="{ inlineSize: `${ring.size}px`, background: ring.color, opacity: ring.placed ? 0.25 : 1 }" />
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Пирамидка" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.pyramid-shell {
  background: linear-gradient(135deg, #fff8e1 0%, #f1f0ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.play-area {
  align-items: center;
  display: grid;
  gap: 32px;
  grid-template-columns: 1fr 1.4fr;
}

.stack-card {
  min-inline-size: 0;
}

.stack {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-block-size: 340px;
  overflow: hidden;
  position: relative;
}

.stem {
  background: linear-gradient(90deg, #8d6e63 0%, #bcaaa4 50%, #795548 100%);
  block-size: 292px;
  border-radius: 999px;
  bottom: 28px;
  box-shadow: inset -3px 0 5px rgb(62 39 35 / 20%);
  inline-size: 18px;
  position: absolute;
  z-index: 1;
}

.stem::before {
  background: radial-gradient(circle at 35% 30%, #efebe9 0%, #bcaaa4 30%, #795548 100%);
  block-size: 34px;
  border-radius: 999px;
  box-shadow: 0 4px 10px rgb(62 39 35 / 20%);
  content: "";
  inline-size: 34px;
  inset-block-start: -20px;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.stack-layers {
  align-items: center;
  display: flex;
  flex-direction: column-reverse;
  inline-size: 100%;
  justify-content: flex-start;
  min-block-size: 260px;
  position: relative;
  z-index: 2;
}

.base {
  background: linear-gradient(180deg, #bcaaa4 0%, #8d6e63 100%);
  block-size: 30px;
  border-radius: 999px;
  box-shadow: 0 10px 18px rgb(93 64 55 / 22%);
  inline-size: min(290px, 100%);
  margin-block-start: 0;
  position: relative;
  z-index: 3;
}

.stack-ring,
.loose-ring {
  block-size: 54px;
  border-radius: 999px;
  box-shadow: inset 0 -8px 14px rgb(0 0 0 / 16%);
  margin-block: 0;
  margin-inline: auto;
  max-inline-size: 100%;
}

.rings {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 960px) {
  .game-container {
    padding-block-start: 112px;
  }

  .play-area {
    grid-template-columns: 1fr;
  }

  .stack {
    min-block-size: 300px;
  }

  .stack-layers {
    min-block-size: 224px;
  }
}

@media (min-width: 700px) and (max-height: 820px) {
  .game-container {
    padding-block-start: 7rem;
  }

  .play-area {
    gap: 1rem;
    grid-template-columns: minmax(0, 0.8fr) minmax(18rem, 1.2fr);
  }

  .stack {
    min-block-size: 220px;
  }

  .stack-layers {
    min-block-size: 170px;
  }

  .stem {
    block-size: 190px;
  }
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 104px;
  }

  .rings {
    grid-template-columns: 1fr;
  }

  .stack-ring,
  .loose-ring {
    block-size: 48px;
  }
}
</style>
