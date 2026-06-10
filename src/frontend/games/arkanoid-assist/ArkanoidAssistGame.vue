<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type PlatformSectorId = "left" | "center" | "right";

type PlatformSector = {
  id: PlatformSectorId;
  label: string;
  hint: string;
  icon: string;
  color: string;
  x: number;
};

type ArkanoidBlock = {
  id: string;
  row: number;
  column: PlatformSectorId;
  label: string;
  color: string;
  x: number;
};

type ArkanoidRound = {
  roundId: string;
  targetBlock: ArkanoidBlock;
  requiredSector: PlatformSector;
};

const sectors: PlatformSector[] = [
  { id: "left", label: "Левый сектор", hint: "мягкий удар влево", icon: "mdi-arrow-top-left-bold-box-outline", color: "blue-lighten-5", x: 22 },
  { id: "center", label: "Центр", hint: "ровный удар", icon: "mdi-arrow-up-bold-box-outline", color: "teal-lighten-5", x: 50 },
  { id: "right", label: "Правый сектор", hint: "мягкий удар вправо", icon: "mdi-arrow-top-right-bold-box-outline", color: "amber-lighten-5", x: 78 }
];

const blockRows: ArkanoidBlock[][] = [
  [
    { id: "sky-left", row: 0, column: "left", label: "верхний левый", color: "#90caf9", x: 18 },
    { id: "sky-center", row: 0, column: "center", label: "верхний центр", color: "#80cbc4", x: 50 },
    { id: "sky-right", row: 0, column: "right", label: "верхний правый", color: "#ffd54f", x: 82 }
  ],
  [
    { id: "leaf-left", row: 1, column: "left", label: "средний левый", color: "#a5d6a7", x: 18 },
    { id: "leaf-center", row: 1, column: "center", label: "средний центр", color: "#b39ddb", x: 50 },
    { id: "leaf-right", row: 1, column: "right", label: "средний правый", color: "#ffcc80", x: 82 }
  ],
  [
    { id: "coral-left", row: 2, column: "left", label: "нижний левый", color: "#ef9a9a", x: 18 },
    { id: "coral-center", row: 2, column: "center", label: "нижний центр", color: "#ce93d8", x: 50 },
    { id: "coral-right", row: 2, column: "right", label: "нижний правый", color: "#fff59d", x: 82 }
  ],
  [
    { id: "quiet-center", row: 3, column: "center", label: "спокойный центр", color: "#b2dfdb", x: 50 }
  ]
];

const targetSequence = blockRows.flat();
const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("arkanoid-assist", {
  maxSteps: 10,
  dwellMs: 1200,
  sessionSeconds: 180,
  targetScale: 1.25,
  motionSpeed: 0.6
}, {
  finishOnMistakes: false
});

const clearedBlockIds = ref(new Set<string>());
const selectedSectorId = ref<PlatformSectorId>("center");
const lastMistakeSectorId = ref<PlatformSectorId>();
const lastHitBlockId = ref<string>();
const hintStrength = ref(0);
const feedbackMessage = ref("Посмотри на подсвеченный блок и выбери сектор платформы для мягкого удара.");

function generateRound(roundIndex: number): ArkanoidRound {
  const targetBlock = targetSequence[(roundIndex - 1) % targetSequence.length];
  const requiredSector = sectors.find((sector) => sector.id === targetBlock.column) ?? sectors[1];
  return {
    roundId: `arkanoid-assist:round:${roundIndex}`,
    targetBlock,
    requiredSector
  };
}

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound
});

const selectedSector = computed(() => sectors.find((sector) => sector.id === selectedSectorId.value) ?? sectors[1]);
const ballStyle = computed(() => ({
  "--ball-start-x": `${selectedSector.value.x}%`,
  "--ball-target-x": `${round.value.targetBlock.x}%`,
  "--ball-target-y": `${18 + round.value.targetBlock.row * 16}%`,
  "--ball-angle": `${(round.value.targetBlock.x - selectedSector.value.x) * 0.42}deg`
}));
const helperText = computed(() => hintStrength.value > 0
  ? `Мяч не потерялся. Подсказка: нужен ${round.value.requiredSector.label.toLowerCase()}.`
  : `Цель: ${round.value.targetBlock.label} блок. Выбери сектор платформы.`);

function sectorTargetId(sector: PlatformSector) {
  return `arkanoid-assist:sector:${sector.id}`;
}

function isCleared(block: ArkanoidBlock) {
  return clearedBlockIds.value.has(block.id);
}

function blockClasses(block: ArkanoidBlock) {
  return {
    "arkanoid-block--target": block.id === round.value.targetBlock.id,
    "arkanoid-block--cleared": isCleared(block),
    "arkanoid-block--hit": block.id === lastHitBlockId.value
  };
}

function chooseSector(sector: PlatformSector) {
  if (session.status !== "running") return;

  selectedSectorId.value = sector.id;
  const targetId = sectorTargetId(sector);
  const expectedTargetId = sectorTargetId(round.value.requiredSector);
  if (sector.id !== round.value.requiredSector.id) {
    lastMistakeSectorId.value = sector.id;
    lastHitBlockId.value = undefined;
    hintStrength.value = Math.min(3, hintStrength.value + 1);
    feedbackMessage.value = "Мяч мягко вернулся на платформу. Попробуй сектор, который ведёт к подсвеченному блоку.";
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: round.value.requiredSector.label, actual: sector.label, softReturn: true, isCorrect: false });
    recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "arkanoid-sector", strength: hintStrength.value });
    return;
  }

  clearedBlockIds.value = new Set([...clearedBlockIds.value, round.value.targetBlock.id]);
  lastMistakeSectorId.value = undefined;
  lastHitBlockId.value = round.value.targetBlock.id;
  hintStrength.value = 0;
  feedbackMessage.value = `Отлично. ${sector.hint} спокойно коснулся блока.`;
  recordSuccess({ roundId: round.value.roundId, targetId, answerId: sector.id, blockId: round.value.targetBlock.id, expected: round.value.requiredSector.label, actual: sector.label, isCorrect: true });
  if (session.status === "running") nextRound();
}

function sectorColor(sector: PlatformSector) {
  if (hintStrength.value > 0 && sector.id === round.value.requiredSector.id) return "primary";
  if (lastMistakeSectorId.value === sector.id) return "warning";
  return sector.color;
}

function restart() {
  clearedBlockIds.value = new Set();
  selectedSectorId.value = "center";
  lastMistakeSectorId.value = undefined;
  lastHitBlockId.value = undefined;
  hintStrength.value = 0;
  feedbackMessage.value = "Посмотри на подсвеченный блок и выбери сектор платформы для мягкого удара.";
  restartRoundGame();
}
</script>

<template>
  <div class="arkanoid-assist-shell">
    <GameHud title="Арканоид assist" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Strategy/control hybrid</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Выбери сектор платформы</h1>
                <p class="text-body-1 text-md-h6 text-medium-emphasis mb-0">{{ feedbackMessage }}</p>
              </div>
              <v-chip color="primary" size="large" variant="tonal">
                {{ helperText }}
              </v-chip>
            </div>

            <v-row align="stretch" class="ga-3" no-gutters>
              <v-col cols="12" lg="7" class="pe-lg-4">
                <v-card class="arkanoid-board pa-3 pa-md-5" color="indigo-lighten-5" rounded="xl" variant="flat">
                  <div class="arkanoid-stage" :style="ballStyle" aria-label="Поле арканоида">
                    <div class="block-grid" role="grid" aria-label="Блоки для мягкого удара">
                      <div v-for="(row, rowIndex) in blockRows" :key="rowIndex" class="block-row" role="row">
                        <div
                          v-for="block in row"
                          :key="block.id"
                          :class="['arkanoid-block', blockClasses(block)]"
                          :style="{ background: block.color }"
                          role="gridcell"
                        >
                          <v-icon v-if="block.id === round.targetBlock.id && !isCleared(block)" icon="mdi-bullseye-arrow" size="26" color="primary" />
                          <v-icon v-else-if="isCleared(block)" icon="mdi-check" size="24" color="success" />
                        </div>
                      </div>
                    </div>

                    <div class="ball-path" aria-hidden="true" />
                    <div class="arkanoid-ball" aria-hidden="true" />
                    <div class="platform">
                      <div class="platform-sector platform-sector--left" :class="{ 'platform-sector--selected': selectedSectorId === 'left' }" />
                      <div class="platform-sector platform-sector--center" :class="{ 'platform-sector--selected': selectedSectorId === 'center' }" />
                      <div class="platform-sector platform-sector--right" :class="{ 'platform-sector--selected': selectedSectorId === 'right' }" />
                    </div>
                  </div>
                </v-card>
              </v-col>

              <v-col cols="12" lg="5">
                <v-card class="pa-4 pa-md-5 h-100" color="surface" rounded="xl" variant="outlined">
                  <div class="text-overline text-secondary mb-2">Секторы платформы</div>
                  <div class="sector-grid">
                    <GameDwellButton
                      v-for="sector in sectors"
                      :key="sector.id"
                      :target-id="sectorTargetId(sector)"
                      :disabled="session.status !== 'running'"
                      :dwell-ms="session.settings.dwellMs"
                      :min-height="150"
                      :color="sectorColor(sector)"
                      @select="chooseSector(sector)"
                    >
                      <template #default>
                        <div :class="['sector-choice', { 'sector-choice--hinted': hintStrength > 0 && sector.id === round.requiredSector.id }]">
                          <v-icon :icon="sector.icon" size="48" color="primary" />
                          <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ sector.label }}</div>
                          <div class="text-body-2 text-medium-emphasis">{{ sector.hint }}</div>
                        </div>
                      </template>
                    </GameDwellButton>
                  </div>

                  <v-alert class="mt-4 text-body-1" color="info" icon="mdi-hand-heart-outline" rounded="xl" variant="tonal">
                    Если сектор не подошёл, мяч мягко возвращается. Игра продолжается без резкой потери мяча.
                  </v-alert>
                </v-card>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Арканоид assist" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.arkanoid-assist-shell {
  background: linear-gradient(135deg, #eef5ff 0%, #fff8e8 50%, #eefaf7 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.arkanoid-board {
  min-block-size: clamp(31rem, 67vh, 43rem);
}

.arkanoid-stage {
  background: radial-gradient(circle at 50% 18%, rgb(255 255 255 / 72%) 0%, transparent 34%), linear-gradient(180deg, #e8edff 0%, #f7fbff 100%);
  block-size: clamp(28rem, 61vh, 38rem);
  border: 0.25rem solid rgb(var(--v-theme-primary) / 14%);
  border-radius: 1.6rem;
  overflow: hidden;
  position: relative;
}

.block-grid {
  display: grid;
  gap: clamp(0.45rem, 1vw, 0.75rem);
  inline-size: min(88%, 35rem);
  inset-block-start: 7%;
  inset-inline: 0;
  margin-inline: auto;
  position: absolute;
  z-index: 2;
}

.block-row {
  display: grid;
  gap: clamp(0.45rem, 1vw, 0.75rem);
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.block-row:last-child {
  grid-template-columns: minmax(0, 1fr);
  margin-inline: auto;
  inline-size: 32%;
}

.arkanoid-block {
  align-items: center;
  aspect-ratio: 2.9;
  border: 0.18rem solid rgb(255 255 255 / 72%);
  border-radius: 1rem;
  box-shadow: 0 0.45rem 1rem rgb(42 58 90 / 12%);
  display: flex;
  justify-content: center;
  opacity: 0.95;
  transition: opacity 220ms ease, transform 220ms ease, box-shadow 220ms ease;
}

.arkanoid-block--target {
  box-shadow: 0 0 0 0.22rem rgb(var(--v-theme-primary) / 42%), 0 0.7rem 1.4rem rgb(var(--v-theme-primary) / 18%);
  transform: translateY(-0.14rem);
}

.arkanoid-block--cleared {
  opacity: 0.28;
  transform: scale(0.92);
}

.arkanoid-block--hit {
  box-shadow: 0 0 0 0.28rem rgb(var(--v-theme-success) / 44%), 0 0.9rem 1.5rem rgb(var(--v-theme-success) / 18%);
}

.ball-path {
  background: linear-gradient(180deg, rgb(var(--v-theme-primary) / 0%), rgb(var(--v-theme-primary) / 42%), rgb(var(--v-theme-primary) / 10%));
  block-size: calc(76% - var(--ball-target-y));
  border-radius: 999px;
  inline-size: 0.55rem;
  inset-block-end: 12%;
  inset-inline-start: var(--ball-start-x);
  opacity: 0.5;
  position: absolute;
  transform: translateX(-50%) rotate(var(--ball-angle));
  transform-origin: 50% 100%;
  z-index: 1;
}

.arkanoid-ball {
  background: radial-gradient(circle at 35% 30%, #ffffff 0 18%, #64b5f6 20% 64%, #1976d2 100%);
  block-size: clamp(2.5rem, 6vw, 3.8rem);
  border-radius: 999px;
  box-shadow: 0 0 1.2rem rgb(25 118 210 / 28%);
  inline-size: clamp(2.5rem, 6vw, 3.8rem);
  inset-block-end: 18%;
  inset-inline-start: var(--ball-start-x);
  position: absolute;
  transform: translateX(-50%);
  transition: inset-inline-start 260ms ease;
  z-index: 3;
}

.platform {
  background: linear-gradient(180deg, #5c6bc0 0%, #3949ab 100%);
  block-size: clamp(2.3rem, 5vw, 3.2rem);
  border-radius: 999px;
  box-shadow: 0 0.7rem 1.4rem rgb(57 73 171 / 22%);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  inline-size: min(72%, 26rem);
  inset-block-end: 7%;
  inset-inline: 0;
  margin-inline: auto;
  overflow: hidden;
  position: absolute;
  z-index: 2;
}

.platform-sector {
  background: rgb(255 255 255 / 8%);
  border-inline: 0.05rem solid rgb(255 255 255 / 22%);
  transition: background-color 220ms ease;
}

.platform-sector--selected {
  background: rgb(255 255 255 / 34%);
}

.sector-grid {
  display: grid;
  gap: 0.9rem;
}

.sector-choice {
  align-items: center;
  display: flex;
  flex-direction: column;
  text-align: center;
}

.sector-choice--hinted {
  filter: drop-shadow(0 0 0.8rem rgb(var(--v-theme-primary) / 24%));
}

@media (max-width: 960px) {
  .game-container {
    padding-block-start: 9.5rem;
  }
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 11rem;
  }

  .arkanoid-board {
    min-block-size: 27rem;
  }

  .arkanoid-stage {
    block-size: 25rem;
  }
}
</style>
