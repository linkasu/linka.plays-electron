<script setup lang="ts">
import { computed, onUnmounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type SoapCircle = {
  id: string;
  x: number;
  y: number;
  size: number;
  hue: number;
  delay: number;
  selected: boolean;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordSuccess, startSession } = useGameSession("soap-circles", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 85,
  targetScale: 1.6,
  motionSpeed: 0.32,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const circles = reactive<SoapCircle[]>([]);
const resultVisible = computed(() => session.status === "finished");

const positions = [
  { x: 27, y: 36 },
  { x: 70, y: 34 },
  { x: 38, y: 66 },
  { x: 76, y: 68 },
  { x: 20, y: 61 },
  { x: 58, y: 53 }
];
const hues = [188, 198, 212, 274, 306, 326];
let circleIndex = 0;
let finishTimer: number | undefined;

function clearFinishTimer() {
  if (finishTimer === undefined) return;
  window.clearTimeout(finishTimer);
  finishTimer = undefined;
}

function createCircle(slot: number): SoapCircle {
  const position = positions[(circleIndex + slot) % positions.length];
  const hue = hues[(circleIndex + slot * 2) % hues.length];
  const circle: SoapCircle = {
    id: `soap-circle-${Date.now()}-${circleIndex}-${slot}`,
    x: position.x,
    y: position.y,
    size: 18 + ((circleIndex + slot) % 3) * 2.2,
    hue,
    delay: -0.55 * ((circleIndex + slot) % 5),
    selected: false
  };
  circleIndex += 1;
  return circle;
}

function resetCircles() {
  circleIndex = 0;
  circles.splice(0, circles.length, createCircle(0), createCircle(1), createCircle(2), createCircle(3));
}

function circleStyle(circle: SoapCircle) {
  return {
    "--circle-hue": `${circle.hue}`,
    "--circle-size": `${circle.size}vw`,
    "--float-delay": `${circle.delay}s`,
    insetBlockStart: `${circle.y}%`,
    insetInlineStart: `${circle.x}%`
  };
}

function selectCircle(circle: SoapCircle) {
  if (session.status !== "running" || circle.selected) return;

  circle.selected = true;
  recordSuccess({ targetId: circle.id, hue: circle.hue, mode: "soft-dissolve" });

  const completed = session.step >= session.maxSteps;
  window.setTimeout(() => {
    const index = circles.findIndex((item) => item.id === circle.id);
    if (index === -1) return;
    if (completed || session.status !== "running") {
      circles.splice(index, 1);
      return;
    }
    circles.splice(index, 1, createCircle(index));
  }, 780);

  if (completed) {
    clearFinishTimer();
    finishTimer = window.setTimeout(() => finishSession("max-steps"), 920);
  }
}

function restart() {
  clearFinishTimer();
  resetCircles();
  startSession();
}

resetCircles();

onUnmounted(() => {
  clearFinishTimer();
});
</script>

<template>
  <div class="soap-circles-shell">
    <div class="soap-circles-glow" aria-hidden="true" />
    <div class="soap-circles-wave soap-circles-wave--one" aria-hidden="true" />
    <div class="soap-circles-wave soap-circles-wave--two" aria-hidden="true" />

    <GameHud
      title="Мыльные круги"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <main class="soap-circles-stage" aria-label="Мыльные круги для выбора взглядом">
      <section class="soap-circles-copy text-center">
        <div class="text-overline text-cyan-darken-2">gaze basics</div>
        <h1 class="text-h4 text-sm-h3 font-weight-bold mb-2">Выбери мыльный круг</h1>
        <p class="text-body-1 text-sm-h6 mb-0">Смотри спокойно: круг мягко расширится и растворится.</p>
      </section>

      <GameDwellButton
        v-for="circle in circles"
        :key="circle.id"
        :target-id="circle.id"
        :dwell-ms="session.settings.dwellMs"
        :disabled="session.status !== 'running' || circle.selected || session.step >= session.maxSteps"
        :min-height="180"
        class="soap-circle-target"
        color="transparent"
        :style="circleStyle(circle)"
        @select="selectCircle(circle)"
      >
        <template #default="{ active, progress }">
          <div
            :class="['soap-circle', { 'soap-circle--active': active, 'soap-circle--selected': circle.selected }]"
            :style="{ '--circle-progress': `${circle.selected ? 1 : active ? progress : 0}` }"
          >
            <span class="soap-circle-shine" aria-hidden="true" />
            <span class="soap-circle-core" aria-hidden="true" />
            <span class="soap-circle-label">{{ circle.selected ? 'Тихо тает' : active ? 'Смотри' : 'Круг' }}</span>
          </div>
        </template>
      </GameDwellButton>

      <v-card class="soap-circles-progress px-4 py-3" color="cyan-lighten-5" rounded="xl" variant="tonal">
        <div class="text-body-2 font-weight-medium">Растворено кругов: {{ session.step }} из {{ session.maxSteps }}</div>
        <div class="text-caption text-medium-emphasis">Ошибок нет: можно смотреть на любой большой круг.</div>
      </v-card>
    </main>

    <GameResultDialog
      :model-value="resultVisible"
      title="Мыльные круги"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.soap-circles-shell {
  background: linear-gradient(180deg, #dffaff 0%, #f2fbff 50%, #ddf4f0 100%);
  color: #174056;
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.soap-circles-glow {
  background: radial-gradient(circle at 18% 22%, rgb(255 255 255 / 82%), transparent 28%),
    radial-gradient(circle at 76% 30%, rgb(173 235 255 / 38%), transparent 30%),
    radial-gradient(circle at 54% 86%, rgb(255 205 239 / 28%), transparent 38%);
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.soap-circles-wave {
  background: rgb(255 255 255 / 34%);
  border-radius: 50%;
  filter: blur(1px);
  inline-size: 78vw;
  min-inline-size: 720px;
  opacity: 0.55;
  pointer-events: none;
  position: absolute;
}

.soap-circles-wave--one {
  block-size: 28vh;
  inset-block-end: -16vh;
  inset-inline-start: -18vw;
}

.soap-circles-wave--two {
  block-size: 22vh;
  inset-block-end: -12vh;
  inset-inline-end: -20vw;
}

.soap-circles-stage {
  block-size: 100vh;
  min-block-size: 620px;
  padding-block-start: 110px;
  position: relative;
  z-index: 1;
}

.soap-circles-copy {
  inline-size: min(680px, calc(100% - 32px));
  margin-inline: auto;
  text-shadow: 0 1px 18px rgb(255 255 255 / 72%);
}

.soap-circle-target {
  animation: soap-float 5.6s ease-in-out infinite;
  animation-delay: var(--float-delay);
  block-size: clamp(150px, var(--circle-size), 236px);
  inline-size: clamp(150px, var(--circle-size), 236px);
  position: absolute;
  transform: translate(-50%, -50%);
}

.soap-circle-target:deep(.dwell-button) {
  background: transparent !important;
  box-shadow: none !important;
  overflow: visible;
  padding: 0 !important;
}

.soap-circle-target:deep(.dwell-progress) {
  background: radial-gradient(closest-side, transparent 73%, rgb(255 255 255 / 78%) 74% 81%, transparent 82%),
    conic-gradient(rgb(53 173 203 / 72%) calc(var(--dwell-progress) * 1%), transparent 0);
  box-shadow: 0 0 0 10px rgb(255 255 255 / 20%);
}

.soap-circle {
  align-items: center;
  background: radial-gradient(circle at 32% 24%, rgb(255 255 255 / 86%) 0 9%, transparent 10%),
    radial-gradient(circle at 64% 70%, hsl(var(--circle-hue) 94% 86% / 48%) 0 22%, transparent 46%),
    radial-gradient(circle at 50% 50%, hsl(var(--circle-hue) 92% 82% / 34%) 0 58%, hsl(calc(var(--circle-hue) + 54) 92% 80% / 46%) 73%, rgb(255 255 255 / 72%) 76%, transparent 80%);
  block-size: 100%;
  border: 2px solid rgb(255 255 255 / 68%);
  border-radius: 50%;
  box-shadow: inset -18px -22px 42px rgb(86 169 205 / 18%), inset 14px 18px 34px rgb(255 255 255 / 44%), 0 18px 54px rgb(59 166 197 / 16%);
  display: flex;
  inline-size: 100%;
  justify-content: center;
  opacity: calc(0.88 + (var(--circle-progress) * 0.12));
  position: relative;
  transform: scale(calc(1 + (var(--circle-progress) * 0.08)));
  transition: opacity 780ms ease, transform 780ms ease, filter 780ms ease;
}

.soap-circle--active {
  filter: saturate(1.12) brightness(1.04);
}

.soap-circle--selected {
  filter: blur(0.5px) saturate(1.2) brightness(1.08);
  opacity: 0;
  transform: scale(1.45);
}

.soap-circle-shine {
  border: 2px solid rgb(255 255 255 / 58%);
  border-block-end-color: transparent;
  border-inline-start-color: transparent;
  border-radius: 50%;
  block-size: 62%;
  inline-size: 62%;
  inset-block-start: 13%;
  inset-inline-start: 16%;
  position: absolute;
  transform: rotate(-20deg);
}

.soap-circle-core {
  background: radial-gradient(circle, rgb(255 255 255 / 36%), transparent 64%);
  block-size: 52%;
  border-radius: 50%;
  inline-size: 52%;
  position: absolute;
}

.soap-circle-label {
  align-self: center;
  background: rgb(255 255 255 / 36%);
  border-radius: 999px;
  color: #24556d;
  font-size: clamp(0.92rem, 1.7vw, 1.12rem);
  font-weight: 700;
  padding: 0.28rem 0.72rem;
  position: relative;
  text-shadow: 0 1px 10px rgb(255 255 255 / 82%);
}

.soap-circles-progress {
  inset-block-end: max(18px, env(safe-area-inset-bottom));
  inset-inline-start: 50%;
  max-inline-size: min(520px, calc(100% - 32px));
  position: absolute;
  text-align: center;
  transform: translateX(-50%);
}

@keyframes soap-float {
  0%,
  100% {
    margin-block-start: -4px;
  }

  50% {
    margin-block-start: 10px;
  }
}

@media (max-width: 720px) {
  .soap-circles-stage {
    min-block-size: 680px;
    padding-block-start: 104px;
  }

  .soap-circle-target {
    block-size: clamp(136px, 34vw, 190px);
    inline-size: clamp(136px, 34vw, 190px);
  }
}

@media (max-width: 520px) {
  .soap-circles-copy p {
    font-size: 0.98rem !important;
  }
}
</style>
