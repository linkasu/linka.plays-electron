<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type StarZone = {
  id: string;
  label: string;
  x: number;
  y: number;
  hue: number;
};

type StarTrail = StarZone & {
  trailId: string;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("catch-star", {
  preset: "gentle",
  maxSteps: 9,
  dwellMs: 1300,
  sessionSeconds: 85,
  targetScale: 1.6,
  motionSpeed: 0.34,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const zones: StarZone[] = [
  { id: "center", label: "середина", x: 50, y: 56, hue: 48 },
  { id: "upper-left", label: "слева сверху", x: 24, y: 36, hue: 52 },
  { id: "upper-right", label: "справа сверху", x: 76, y: 36, hue: 42 },
  { id: "middle-left", label: "слева", x: 20, y: 58, hue: 58 },
  { id: "middle-right", label: "справа", x: 80, y: 58, hue: 46 },
  { id: "lower-left", label: "слева снизу", x: 30, y: 76, hue: 54 },
  { id: "lower-right", label: "справа снизу", x: 70, y: 76, hue: 38 },
  { id: "low-center", label: "снизу", x: 50, y: 80, hue: 62 },
  { id: "high-center", label: "сверху", x: 50, y: 32, hue: 44 }
];

const zoneIndex = ref(0);
const trail = reactive<StarTrail[]>([]);
const resultVisible = computed(() => session.status === "finished");
const activeZone = computed(() => zones[zoneIndex.value]);
const targetId = computed(() => `catch-star:${session.step + 1}:${activeZone.value.id}`);
const targetStyle = computed(() => ({
  insetInlineStart: `${activeZone.value.x}%`,
  insetBlockStart: `${activeZone.value.y}%`
}));
const targetTone = computed(() => `hsl(${activeZone.value.hue} 100% 72%)`);
const prompt = computed(() => session.status === "paused" ? "Пауза. Звезда подождёт." : "Удержи взгляд на звезде, и она мягко появится в новой зоне.");

function pickNextZone() {
  const current = zoneIndex.value;
  const stepOffset = 2 + Math.floor(Math.random() * (zones.length - 2));
  zoneIndex.value = (current + stepOffset) % zones.length;
}

function catchStar() {
  if (session.status !== "running") return;

  const caughtZone = activeZone.value;
  const nextStep = session.step + 1;
  trail.push({ ...caughtZone, trailId: `${caughtZone.id}-${Date.now()}` });
  if (trail.length > 6) trail.shift();

  recordSuccess({ targetId: targetId.value, zone: caughtZone.id, label: caughtZone.label });
  if (nextStep < session.maxSteps) pickNextZone();
}

function restart() {
  zoneIndex.value = 0;
  trail.splice(0);
  startSession();
}
</script>

<template>
  <div class="catch-star-shell">
    <div class="catch-star-sky" aria-hidden="true" />

    <GameHud
      title="Поймай звезду"
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

    <v-container class="catch-star-container d-flex align-start justify-center" fluid>
      <v-card class="catch-star-card pa-4 pa-sm-6" color="surface" elevation="8" rounded="xl">
        <div class="text-overline text-amber-darken-2">fixation gaze</div>
        <h1 class="text-h4 text-sm-h3 font-weight-bold">Поймай звезду</h1>
        <p class="text-body-1 text-sm-h6 text-medium-emphasis mb-0">{{ prompt }}</p>
      </v-card>
    </v-container>

    <div class="catch-star-stage" role="group" aria-label="Звёздная цель игры Поймай звезду">
      <div
        v-for="mark in trail"
        :key="mark.trailId"
        class="catch-star-trail"
        :style="{ insetInlineStart: `${mark.x}%`, insetBlockStart: `${mark.y}%`, '--trail-color': `hsl(${mark.hue} 100% 76%)` }"
        aria-hidden="true"
      />

      <GameDwellButton
        :target-id="targetId"
        :dwell-ms="session.settings.dwellMs"
        :disabled="session.status !== 'running'"
        :min-height="184"
        class="catch-star-target"
        color="amber-lighten-5"
        :style="targetStyle"
        @select="catchStar"
      >
        <template #default="{ active, progress }">
          <div
            class="catch-star-orb"
            :class="{ 'catch-star-orb--active': active }"
            :style="{ '--star-color': targetTone, '--star-progress': active ? progress : 0 }"
          >
            <v-icon icon="mdi-star" class="catch-star-icon" />
            <div class="text-subtitle-1 text-sm-h6 font-weight-bold">Звезда</div>
            <div class="text-caption text-medium-emphasis">{{ active ? 'Ловим мягко' : 'Смотри спокойно' }}</div>
          </div>
        </template>
      </GameDwellButton>
    </div>

    <GameResultDialog
      :model-value="resultVisible"
      title="Поймай звезду"
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
.catch-star-shell {
  background: linear-gradient(180deg, #071225 0%, #0c2142 54%, #1b345a 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.catch-star-sky {
  background: radial-gradient(circle at 18% 26%, rgb(255 224 151 / 18%), transparent 30%),
    radial-gradient(circle at 82% 32%, rgb(167 205 255 / 18%), transparent 34%),
    radial-gradient(circle at 50% 100%, rgb(255 214 111 / 14%), transparent 42%);
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.catch-star-sky::after {
  background-image: radial-gradient(circle, rgb(255 245 197 / 52%) 0 1px, transparent 1.5px);
  background-size: 92px 74px;
  content: "";
  inset: 0;
  opacity: 0.5;
  position: absolute;
}

.catch-star-container {
  min-block-size: 100vh;
  padding-block-start: 116px;
  pointer-events: none;
}

.catch-star-card {
  inline-size: min(680px, 92vw);
  opacity: 0.93;
  pointer-events: none;
  position: relative;
  text-align: center;
  z-index: 1;
}

.catch-star-stage {
  inset: 0;
  position: absolute;
  z-index: 2;
}

.catch-star-target {
  block-size: clamp(184px, 22vw, 232px);
  inline-size: clamp(184px, 22vw, 232px);
  position: absolute;
  transform: translate(-50%, -50%);
  transition: inset-block-start 780ms ease-in-out, inset-inline-start 780ms ease-in-out;
}

.catch-star-orb {
  align-items: center;
  block-size: 100%;
  color: #263238;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  justify-content: center;
  position: relative;
  text-shadow: 0 1px 16px rgb(255 255 255 / 70%);
}

.catch-star-orb::before {
  background: radial-gradient(circle, var(--star-color) 0%, rgb(255 255 255 / 82%) 34%, rgb(255 235 157 / 0%) 74%);
  border-radius: 999px;
  content: "";
  filter: blur(2px);
  inset: -1.35rem;
  opacity: calc(0.64 + (var(--star-progress) * 0.3));
  position: absolute;
  transform: scale(calc(0.88 + (var(--star-progress) * 0.18)));
  transition: opacity 180ms ease, transform 180ms ease;
  z-index: -1;
}

.catch-star-orb--active .catch-star-icon {
  transform: scale(1.14) rotate(12deg);
}

.catch-star-icon {
  color: var(--star-color);
  filter: drop-shadow(0 0 18px var(--star-color));
  font-size: clamp(3.4rem, 8vw, 5.8rem);
  transition: transform 220ms ease;
}

.catch-star-trail {
  background: radial-gradient(circle, var(--trail-color) 0%, rgb(255 255 255 / 42%) 35%, transparent 70%);
  block-size: clamp(58px, 10vw, 98px);
  border-radius: 999px;
  filter: blur(1px);
  inline-size: clamp(58px, 10vw, 98px);
  opacity: 0.48;
  position: absolute;
  transform: translate(-50%, -50%);
}

@media (max-width: 700px) {
  .catch-star-card {
    margin-block-start: auto;
  }
}
</style>
