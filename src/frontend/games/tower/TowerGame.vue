<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type TowerBlock = {
  id: string;
  label: string;
  width: number;
  color: string;
  placed: boolean;
  placedIndex?: number;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSession("tower", {
  preset: "gentle",
  maxSteps: 5,
  dwellMs: 1200,
  sessionSeconds: 120,
  targetScale: 1.35,
  motionSpeed: 0.65,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false
});

const blocks = reactive<TowerBlock[]>([]);
const resultVisible = ref(false);
const feedbackMessage = ref("Выбирай большой блок. Подсказка показывает спокойный порядок, но подойдёт любой выбор.");
const nextRecommendedBlock = computed(() => blocks.filter((block) => !block.placed).sort((a, b) => b.width - a.width)[0]);
const placedBlocks = computed(() => blocks.filter((block) => block.placed).sort((a, b) => (a.placedIndex ?? 0) - (b.placedIndex ?? 0)));
const currentRoundId = computed(() => `tower:round:${session.step + 1}`);
let resultTimer = 0;

function blockTargetId(block: TowerBlock) {
  return `tower:block:${block.id}`;
}

function resetBlocks() {
  blocks.splice(0, blocks.length,
    { id: "block-1", label: "1", width: 260, color: "#8ecae6", placed: false },
    { id: "block-2", label: "2", width: 230, color: "#b7e4c7", placed: false },
    { id: "block-3", label: "3", width: 200, color: "#ffe082", placed: false },
    { id: "block-4", label: "4", width: 170, color: "#f7a6a6", placed: false },
    { id: "block-5", label: "5", width: 140, color: "#cdb4db", placed: false }
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
  }, 1400);
}

function chooseBlock(block: TowerBlock) {
  if (session.status !== "running" || block.placed) return;

  const expectedBlock = nextRecommendedBlock.value;
  const roundId = currentRoundId.value;
  const nextPlacedIndex = placedBlocks.value.length + 1;
  const isRecommended = block.id === expectedBlock?.id;

  block.placed = true;
  block.placedIndex = nextPlacedIndex;

  if (isRecommended) {
    feedbackMessage.value = "Хорошо. Блок встал на башню.";
    recordSuccess({ roundId, targetId: blockTargetId(block), expected: block.id, actual: block.id, isCorrect: true });
  } else {
    feedbackMessage.value = "Этот блок тоже подходит. Башня продолжает расти спокойно.";
    recordMistake({ roundId, targetId: blockTargetId(block), expectedTargetId: expectedBlock ? blockTargetId(expectedBlock) : undefined, expected: expectedBlock?.id, actual: block.id, isCorrect: false });
    if (session.status === "running") session.step += 1;
  }

  if (placedBlocks.value.length >= blocks.length && session.status === "running") {
    feedbackMessage.value = "Башня готова. Все блоки стоят на месте.";
    finishSession("game-complete");
  }
}

function restart() {
  clearResultTimer();
  resultVisible.value = false;
  resetBlocks();
  feedbackMessage.value = "Выбирай большой блок. Подсказка показывает спокойный порядок, но подойдёт любой выбор.";
  startSession();
}

resetBlocks();

watch(() => session.status, (status) => {
  if (status === "finished") scheduleResultDialog();
  else {
    clearResultTimer();
    resultVisible.value = false;
  }
});
</script>

<template>
  <div class="tower-shell">
    <GameHud title="Башня" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Построй башню</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-7">Следующий блок мягко подсвечен. Если выбрать другой, мы всё равно аккуратно поставим его в башню.</p>

            <div class="play-area">
              <v-card class="tower-card pa-5 pa-md-6" color="blue-lighten-5" rounded="xl" variant="flat">
                <div class="tower-stage" aria-label="Собранная башня">
                  <div class="tower-sky" />
                  <div class="tower-stack">
                    <div v-for="block in placedBlocks" :key="`placed-${block.id}`" class="tower-block tower-block--placed" :style="{ inlineSize: `${block.width}px`, background: block.color }">
                      {{ block.label }}
                    </div>
                  </div>
                  <div class="tower-ground" />
                </div>
                <div class="text-body-1 text-center text-medium-emphasis mt-4">{{ feedbackMessage }}</div>
              </v-card>

              <div class="block-choices" aria-label="Блоки для башни">
                <GameDwellButton v-for="block in blocks" :key="block.id" :target-id="blockTargetId(block)" :disabled="session.status !== 'running' || block.placed" :dwell-ms="session.settings.dwellMs" :min-height="136" :color="block.id === nextRecommendedBlock?.id ? 'green-lighten-5' : 'surface'" @select="chooseBlock(block)">
                  <template #default>
                    <div :class="['choice-content', { 'choice-content--recommended': block.id === nextRecommendedBlock?.id }]">
                      <div class="tower-block tower-block--choice" :style="{ inlineSize: `${block.width}px`, background: block.color, opacity: block.placed ? 0.22 : 1 }">
                        {{ block.label }}
                      </div>
                      <div v-if="block.id === nextRecommendedBlock?.id && !block.placed" class="text-caption text-green-darken-3 mt-2">следующий</div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Башня" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.tower-shell {
  background: linear-gradient(135deg, #eef7f6 0%, #fff8e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.play-area {
  align-items: stretch;
  display: grid;
  gap: 28px;
  grid-template-columns: minmax(320px, 1.2fr) minmax(360px, 1fr);
}

.tower-card {
  min-inline-size: 0;
}

.tower-stage {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-block-size: 430px;
  overflow: hidden;
  position: relative;
}

.tower-sky {
  background: radial-gradient(circle at 50% 50%, rgb(255 255 255 / 80%) 0 18%, transparent 19%);
  block-size: 160px;
  inline-size: 160px;
  inset-block-start: 26px;
  inset-inline-end: 32px;
  opacity: 0.65;
  position: absolute;
}

.tower-stack {
  align-items: center;
  display: flex;
  flex-direction: column-reverse;
  inline-size: 100%;
  min-block-size: 330px;
  justify-content: flex-start;
  position: relative;
  z-index: 2;
}

.tower-ground {
  background: linear-gradient(180deg, #c8e6c9 0%, #a5d6a7 100%);
  block-size: 34px;
  border-radius: 999px;
  box-shadow: 0 10px 22px rgb(76 125 80 / 18%);
  inline-size: min(360px, 96%);
  position: relative;
  z-index: 3;
}

.tower-block {
  align-items: center;
  border: 3px solid rgb(255 255 255 / 54%);
  border-radius: 20px;
  box-shadow: inset 0 -8px 14px rgb(0 0 0 / 10%), 0 8px 18px rgb(67 88 99 / 12%);
  color: rgb(42 48 56 / 72%);
  display: flex;
  font-size: 1.2rem;
  font-weight: 700;
  justify-content: center;
  margin-inline: auto;
  max-inline-size: 100%;
}

.tower-block--placed {
  block-size: 58px;
}

.tower-block--choice {
  block-size: 54px;
}

.block-choices {
  align-content: center;
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}

.choice-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.choice-content--recommended .tower-block--choice {
  outline: 5px solid rgb(76 175 80 / 28%);
  outline-offset: 5px;
}

@media (max-width: 960px) {
  .game-container {
    padding-block-start: 112px;
  }

  .play-area {
    grid-template-columns: 1fr;
  }

  .tower-stage {
    min-block-size: 360px;
  }

  .tower-stack {
    min-block-size: 290px;
  }

  .block-choices {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  .tower-stage {
    min-block-size: 230px;
  }

  .tower-stack {
    min-block-size: 190px;
  }

  .block-choices {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 104px;
  }

  .block-choices {
    grid-template-columns: 1fr;
  }

  .tower-block--placed,
  .tower-block--choice {
    block-size: 50px;
  }
}
</style>
