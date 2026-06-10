<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type LightZone = {
  id: string;
  label: string;
  x: number;
  y: number;
  hue: number;
};

type LightTrail = LightZone & {
  trailId: string;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("catch-light", {
  preset: "gentle",
  maxSteps: 9,
  dwellMs: 1300,
  sessionSeconds: 85,
  targetScale: 1.6,
  motionSpeed: 0.36,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const zones: LightZone[] = [
  { id: "center", label: "середина", x: 50, y: 56, hue: 48 },
  { id: "upper-left", label: "слева сверху", x: 24, y: 38, hue: 54 },
  { id: "upper-right", label: "справа сверху", x: 76, y: 38, hue: 42 },
  { id: "middle-left", label: "слева", x: 20, y: 58, hue: 178 },
  { id: "middle-right", label: "справа", x: 80, y: 58, hue: 202 },
  { id: "lower-left", label: "слева снизу", x: 30, y: 76, hue: 286 },
  { id: "lower-right", label: "справа снизу", x: 70, y: 76, hue: 326 },
  { id: "low-center", label: "снизу", x: 50, y: 80, hue: 120 },
  { id: "high-center", label: "сверху", x: 50, y: 34, hue: 34 }
];

const zoneIndex = ref(0);
const trail = reactive<LightTrail[]>([]);
const resultVisible = computed(() => session.status === "finished");
const activeZone = computed(() => zones[zoneIndex.value]);
const targetId = computed(() => `catch-light:${session.step + 1}:${activeZone.value.id}`);
const targetStyle = computed(() => ({
  insetInlineStart: `${activeZone.value.x}%`,
  insetBlockStart: `${activeZone.value.y}%`
}));
const targetTone = computed(() => `hsl(${activeZone.value.hue} 100% 72%)`);
const prompt = computed(() => session.status === "paused" ? "Пауза. Свет подождёт." : "Удержи взгляд на светлом круге, и он плавно переедет дальше.");

function pickNextZone() {
  const current = zoneIndex.value;
  const stepOffset = 2 + Math.floor(Math.random() * (zones.length - 2));
  zoneIndex.value = (current + stepOffset) % zones.length;
}

function catchLight() {
  if (session.status !== "running") return;

  const litZone = activeZone.value;
  const nextStep = session.step + 1;
  trail.push({ ...litZone, trailId: `${litZone.id}-${Date.now()}` });
  if (trail.length > 5) trail.shift();

  recordSuccess({ targetId: targetId.value, zone: litZone.id, label: litZone.label });
  if (nextStep < session.maxSteps) pickNextZone();
}

function restart() {
  zoneIndex.value = 0;
  trail.splice(0);
  startSession();
}
</script>

<template>
  <div class="catch-light-shell">
    <div class="catch-light-glow" aria-hidden="true" />

    <GameHud
      title="Поймай свет"
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

    <v-container class="catch-light-container d-flex align-start justify-center" fluid>
      <v-card class="catch-light-card pa-4 pa-sm-6" color="surface" elevation="8" rounded="xl">
        <div class="text-overline text-amber-darken-2">first target gaze</div>
        <h1 class="text-h4 text-sm-h3 font-weight-bold">Поймай свет</h1>
        <p class="text-body-1 text-sm-h6 text-medium-emphasis mb-0">{{ prompt }}</p>
      </v-card>
    </v-container>

    <div class="catch-light-stage" role="group" aria-label="Световая цель игры Поймай свет">
      <div
        v-for="mark in trail"
        :key="mark.trailId"
        class="catch-light-trail"
        :style="{ insetInlineStart: `${mark.x}%`, insetBlockStart: `${mark.y}%`, '--trail-color': `hsl(${mark.hue} 100% 76%)` }"
        aria-hidden="true"
      />

      <GameDwellButton
        :target-id="targetId"
        :dwell-ms="session.settings.dwellMs"
        :disabled="session.status !== 'running'"
        :min-height="180"
        class="catch-light-target"
        color="amber-lighten-4"
        :style="targetStyle"
        @select="catchLight"
      >
        <template #default="{ active, progress }">
          <div
            class="catch-light-orb"
            :class="{ 'catch-light-orb--active': active }"
            :style="{ '--light-color': targetTone, '--light-progress': active ? progress : 0 }"
          >
            <v-icon icon="mdi-brightness-5" class="catch-light-icon" />
            <div class="text-subtitle-1 text-sm-h6 font-weight-bold">Свет</div>
            <div class="text-caption text-medium-emphasis">{{ active ? 'Ещё чуть-чуть' : 'Смотри спокойно' }}</div>
          </div>
        </template>
      </GameDwellButton>
    </div>

    <GameResultDialog
      :model-value="resultVisible"
      title="Поймай свет"
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
.catch-light-shell {
  background: linear-gradient(180deg, #10233f 0%, #183c58 50%, #2d4f5f 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.catch-light-glow {
  background: radial-gradient(circle at 20% 24%, rgb(255 224 151 / 24%), transparent 32%),
    radial-gradient(circle at 82% 34%, rgb(146 217 255 / 20%), transparent 34%),
    radial-gradient(circle at 50% 100%, rgb(255 214 111 / 18%), transparent 42%);
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.catch-light-container {
  min-block-size: 100vh;
  padding-block-start: 116px;
  pointer-events: none;
}

.catch-light-card {
  inline-size: min(680px, 92vw);
  opacity: 0.92;
  pointer-events: none;
  position: relative;
  text-align: center;
  z-index: 1;
}

.catch-light-stage {
  inset: 0;
  position: absolute;
  z-index: 2;
}

.catch-light-target {
  block-size: clamp(180px, 22vw, 230px);
  inline-size: clamp(180px, 22vw, 230px);
  position: absolute;
  transform: translate(-50%, -50%);
  transition: inset-block-start 760ms ease-in-out, inset-inline-start 760ms ease-in-out;
}

.catch-light-orb {
  align-items: center;
  block-size: 100%;
  color: #263238;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  justify-content: center;
  position: relative;
  text-shadow: 0 1px 16px rgb(255 255 255 / 68%);
}

.catch-light-orb::before {
  background: radial-gradient(circle, var(--light-color) 0%, rgb(255 255 255 / 80%) 38%, rgb(255 235 157 / 0%) 72%);
  border-radius: 999px;
  content: "";
  filter: blur(2px);
  inset: -1.4rem;
  opacity: calc(0.62 + (var(--light-progress) * 0.32));
  position: absolute;
  transform: scale(calc(0.88 + (var(--light-progress) * 0.18)));
  transition: opacity 180ms ease, transform 180ms ease;
  z-index: -1;
}

.catch-light-orb--active .catch-light-icon {
  transform: scale(1.12) rotate(10deg);
}

.catch-light-icon {
  color: var(--light-color);
  filter: drop-shadow(0 0 18px var(--light-color));
  font-size: clamp(3.2rem, 8vw, 5.6rem);
  transition: transform 220ms ease;
}

.catch-light-trail {
  background: radial-gradient(circle, var(--trail-color) 0%, rgb(255 255 255 / 40%) 35%, transparent 70%);
  block-size: clamp(56px, 10vw, 96px);
  border-radius: 999px;
  filter: blur(1px);
  inline-size: clamp(56px, 10vw, 96px);
  opacity: 0.5;
  position: absolute;
  transform: translate(-50%, -50%);
}

@media (max-width: 700px) {
  .catch-light-card {
    margin-block-start: auto;
  }
}
</style>
