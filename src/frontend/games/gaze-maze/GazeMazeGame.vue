<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeGazeMazeAudio, playGazeMazeHintMelody, playGazeMazeStepMelody, warmGazeMazeAudio } from "./audio";

type PathNode = {
  id: string;
  label: string;
  x: number;
  y: number;
};

type SelectableNode = PathNode & {
  pathIndex: number;
};

const pathNodes: PathNode[] = [
  { id: "start", label: "Старт", x: 13, y: 22 },
  { id: "soft-turn", label: "Мягкий поворот", x: 35, y: 19 },
  { id: "quiet-down", label: "Тихий спуск", x: 44, y: 47 },
  { id: "left-corner", label: "Левый угол", x: 20, y: 47 },
  { id: "middle", label: "Середина", x: 20, y: 76 },
  { id: "wide-corridor", label: "Широкий коридор", x: 58, y: 68 },
  { id: "last-turn", label: "Поворот к выходу", x: 66, y: 87 },
  { id: "exit", label: "Выход", x: 86, y: 87 }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("gaze-maze", {
  preset: "gentle",
  maxSteps: 7,
  dwellMs: 1300,
  sessionSeconds: 120,
  targetScale: 1.55,
  motionSpeed: 0.45,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const feedbackText = ref("Смотри на подсвеченный огонёк: он покажет следующий мягкий шаг.");
const hintedIndex = ref<number>();
const lastChoiceIndex = ref<number>();
let feedbackTimer = 0;

const selectableNodes = computed<SelectableNode[]>(() => pathNodes.slice(1).map((node, index) => ({ ...node, pathIndex: index + 1 })));
const currentPathIndex = computed(() => Math.min(session.step + 1, pathNodes.length - 1));
const currentNode = computed(() => pathNodes[currentPathIndex.value]);
const resultVisible = computed(() => session.status === "finished");
const mazeLinePoints = computed(() => pathNodes.map((node) => `${node.x},${node.y}`).join(" "));
const completedLinePoints = computed(() => pathNodes.slice(0, Math.min(session.step, pathNodes.length - 1) + 1).map((node) => `${node.x},${node.y}`).join(" "));

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function showFeedback(text: string, delay = 1800) {
  feedbackText.value = text;
  clearFeedbackTimer();
  feedbackTimer = window.setTimeout(() => {
    feedbackText.value = session.status === "running"
      ? `Следующий шаг: ${currentNode.value.label.toLowerCase()}.`
      : "Путь найден спокойно.";
  }, delay);
}

function targetId(node: SelectableNode) {
  return `gaze-maze:waypoint:${node.id}`;
}

function isCompleted(node: SelectableNode) {
  return node.pathIndex <= session.step;
}

function isCurrent(node: SelectableNode) {
  return session.status === "running" && node.pathIndex === currentPathIndex.value;
}

function waypointStyle(node: SelectableNode) {
  const scale = isCurrent(node) ? 1.12 : isCompleted(node) ? 0.9 : 0.98;
  return {
    "--x": node.x,
    "--y": node.y,
    "--waypoint-scale": scale
  };
}

function selectWaypoint(node: SelectableNode) {
  if (session.status !== "running" || isCompleted(node)) return;

  const selectedTargetId = targetId(node);
  const expectedNode = currentNode.value;
  const expectedTargetId = `gaze-maze:waypoint:${expectedNode.id}`;
  lastChoiceIndex.value = node.pathIndex;

  if (node.pathIndex === currentPathIndex.value) {
    hintedIndex.value = undefined;
    void playGazeMazeStepMelody(session.settings.sound);
    recordSuccess({
      targetId: selectedTargetId,
      waypointId: node.id,
      waypointLabel: node.label,
      pathIndex: node.pathIndex,
      isExit: node.id === "exit"
    });
    showFeedback(node.id === "exit" ? "Выход найден. Лабиринт пройден без спешки." : "Да, это следующий шаг. Путь мягко светится.", 1300);
    return;
  }

  hintedIndex.value = currentPathIndex.value;
  void playGazeMazeHintMelody(session.settings.sound);
  recordMistake({
    targetId: selectedTargetId,
    expectedTargetId,
    waypointId: node.id,
    expectedWaypointId: expectedNode.id,
    selectedPathIndex: node.pathIndex,
    expectedPathIndex: currentPathIndex.value,
    hintOnly: true
  });
  recordHint({
    targetId: expectedTargetId,
    reason: "next-waypoint-needed",
    selectedWaypointId: node.id,
    expectedWaypointId: expectedNode.id
  });
  showFeedback(`Это тоже часть лабиринта, но сейчас нужен ${expectedNode.label.toLowerCase()}. Ошибки не проваливают игру.`, 2400);
}

function restart() {
  clearFeedbackTimer();
  hintedIndex.value = undefined;
  lastChoiceIndex.value = undefined;
  feedbackText.value = "Смотри на подсвеченный огонёк: он покажет следующий мягкий шаг.";
  startSession();
}

onMounted(() => {
  warmGazeMazeAudio(session.settings.sound);
});

watch(() => session.settings.sound, (enabled) => {
  warmGazeMazeAudio(enabled);
});

onUnmounted(() => {
  clearFeedbackTimer();
  disposeGazeMazeAudio();
});
</script>

<template>
  <div class="gaze-maze-shell">
    <GameHud title="Лабиринт взгляда-указателя" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="gaze-maze-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="gaze-maze-panel pa-3 pa-md-5" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-primary text-center mb-1">Следующий шаг взглядом</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">Найди путь к выходу</h1>
            <p class="feedback-line text-body-1 text-md-h6 text-medium-emphasis text-center mb-3">{{ feedbackText }}</p>

            <div class="gaze-maze-stage mx-auto" role="group" aria-label="Широкий лабиринт с waypoint">
              <svg class="gaze-maze-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline class="gaze-maze-path__shadow" :points="mazeLinePoints" />
                <polyline class="gaze-maze-path__lane" :points="mazeLinePoints" />
                <polyline v-if="session.step > 0" class="gaze-maze-path__done" :points="completedLinePoints" />
              </svg>

              <div class="gaze-maze-start" :style="{ '--x': pathNodes[0].x, '--y': pathNodes[0].y }">
                <v-icon icon="mdi-map-marker-check-outline" />
                <span>Старт</span>
              </div>

              <GameDwellButton
                v-for="node in selectableNodes"
                :key="node.id"
                :class="['gaze-maze-waypoint', {
                  'gaze-maze-waypoint--current': isCurrent(node),
                  'gaze-maze-waypoint--completed': isCompleted(node),
                  'gaze-maze-waypoint--hint': hintedIndex === node.pathIndex,
                  'gaze-maze-waypoint--mistake': lastChoiceIndex === node.pathIndex && !isCurrent(node) && !isCompleted(node)
                }]"
                :style="waypointStyle(node)"
                :target-id="targetId(node)"
                :disabled="session.status !== 'running' || isCompleted(node)"
                :dwell-ms="session.settings.dwellMs"
                min-height="100%"
                color="surface"
                @select="selectWaypoint(node)"
              >
                <template #default="{ active, progress }">
                  <div class="gaze-maze-waypoint__content">
                    <v-icon :icon="node.id === 'exit' ? 'mdi-door-open' : isCompleted(node) ? 'mdi-check-circle-outline' : 'mdi-circle-slice-8'" />
                    <div class="gaze-maze-waypoint__label">{{ node.id === 'exit' ? 'Выход' : node.pathIndex }}</div>
                    <div class="gaze-maze-waypoint__hint">
                      {{ isCurrent(node) ? active && progress > 0.65 ? 'держи' : 'сюда' : isCompleted(node) ? 'готово' : '' }}
                    </div>
                  </div>
                </template>
              </GameDwellButton>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Лабиринт взгляда-указателя" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.gaze-maze-shell {
  background: radial-gradient(circle at 18% 12%, rgb(255 236 180 / 54%), transparent 32%), linear-gradient(135deg, #eef8f6 0%, #f8f4ff 52%, #fff8e8 100%);
  block-size: 100vh;
  overflow: hidden;
}

.gaze-maze-container {
  block-size: 100vh;
  padding-block: clamp(5rem, 10vh, 7rem) clamp(0.75rem, 3vh, 2rem);
}

.gaze-maze-panel {
  max-block-size: calc(100vh - 6rem);
  overflow: hidden;
}

.feedback-line {
  min-block-size: 1.5rem;
}

.gaze-maze-stage {
  aspect-ratio: 16 / 9;
  background: linear-gradient(145deg, rgb(229 247 242 / 94%), rgb(239 240 255 / 96%));
  border: 0.75rem solid rgb(255 255 255 / 76%);
  border-radius: 2rem;
  box-shadow: inset 0 0 0 0.125rem rgb(var(--v-theme-primary) / 10%), 0 1.5rem 4rem rgb(70 90 116 / 18%);
  block-size: clamp(21rem, 55vh, 34rem);
  inline-size: min(100%, 62rem);
  min-block-size: 0;
  overflow: hidden;
  position: relative;
}

.gaze-maze-path {
  block-size: 100%;
  inline-size: 100%;
  inset: 0;
  position: absolute;
}

.gaze-maze-path polyline {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.gaze-maze-path__shadow {
  stroke: rgb(86 109 137 / 18%);
  stroke-width: 20;
}

.gaze-maze-path__lane {
  stroke: rgb(255 255 255 / 90%);
  stroke-width: 14;
}

.gaze-maze-path__done {
  stroke: rgb(var(--v-theme-primary) / 58%);
  stroke-width: 8;
}

.gaze-maze-start,
.gaze-maze-waypoint {
  inset-block-start: calc(var(--y) * 1%);
  inset-inline-start: calc(var(--x) * 1%);
  position: absolute;
  transform: translate(-50%, -50%);
}

.gaze-maze-start {
  align-items: center;
  background: rgb(255 255 255 / 88%);
  border: 0.25rem solid rgb(var(--v-theme-secondary) / 32%);
  border-radius: 999px;
  color: rgb(var(--v-theme-secondary));
  display: flex;
  font-weight: 800;
  gap: 0.35rem;
  padding: 0.55rem 0.8rem;
  z-index: 2;
}

.gaze-maze-waypoint {
  block-size: clamp(5.1rem, min(9vw, 14vh), 8rem);
  inline-size: clamp(5.1rem, min(9vw, 14vh), 8rem);
  transform: translate(-50%, -50%) scale(var(--waypoint-scale));
  transition: filter 180ms ease, opacity 180ms ease, transform 180ms ease;
  z-index: 3;
}

.gaze-maze-waypoint :deep(.dwell-button) {
  border: 0.3rem solid rgb(255 255 255 / 82%);
  border-radius: 999px !important;
  box-shadow: 0 1rem 2.25rem rgb(70 85 120 / 18%);
  color: #243631;
  padding: 0 !important;
}

.gaze-maze-waypoint :deep(.dwell-hitbox) {
  block-size: 100%;
}

.gaze-maze-waypoint--current {
  filter: drop-shadow(0 0 1.6rem rgb(var(--v-theme-primary) / 42%));
}

.gaze-maze-waypoint--current :deep(.dwell-button) {
  border-color: rgb(var(--v-theme-primary) / 54%);
}

.gaze-maze-waypoint--completed {
  opacity: 0.76;
}

.gaze-maze-waypoint--hint {
  filter: drop-shadow(0 0 1.9rem rgb(var(--v-theme-secondary) / 54%));
}

.gaze-maze-waypoint--mistake {
  opacity: 0.82;
}

.gaze-maze-waypoint__content {
  align-items: center;
  block-size: 100%;
  color: #243631;
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1;
}

.gaze-maze-waypoint__content .v-icon {
  font-size: clamp(1.8rem, 3.6vw, 3.1rem);
}

.gaze-maze-waypoint__label {
  color: rgb(var(--v-theme-on-surface));
  font-size: clamp(1rem, 1.9vw, 1.45rem);
  font-weight: 900;
  margin-block-start: 0.25rem;
}

.gaze-maze-waypoint__hint {
  color: rgb(var(--v-theme-on-surface) / 90%);
  font-size: clamp(0.72rem, 1.25vw, 0.9rem);
  font-weight: 700;
  margin-block-start: 0.25rem;
}

@media (max-width: 720px) {
  .gaze-maze-container {
    padding-block-start: 5rem;
  }

  .gaze-maze-stage {
    aspect-ratio: 4 / 3;
    block-size: clamp(19rem, 53vh, 24rem);
    min-block-size: 0;
  }

  .gaze-maze-waypoint {
    block-size: clamp(4.7rem, 17vw, 6rem);
    inline-size: clamp(4.7rem, 17vw, 6rem);
  }
}

@media (min-width: 721px) and (max-width: 900px), (max-height: 700px) {
  .gaze-maze-container {
    padding-block-start: 5rem;
  }

  .gaze-maze-stage {
    block-size: clamp(20rem, 52vh, 26rem);
    min-block-size: 0;
  }
}
</style>
