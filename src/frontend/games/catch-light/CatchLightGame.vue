<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeCatchLightPiano, playCatchLightCue, setCatchLightPianoActive, tickCatchLightPiano, warmCatchLightPiano } from "./audio";

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
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSessionFor("catch-light", {
  maxSteps: 9,
  overrides: { preset: "gentle", targetScale: 1.6, motionSpeed: 0.36, distractors: "none", hints: "high", sound: true },
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
  playCatchLightCue(session.settings.sound);
  if (nextStep < session.maxSteps) pickNextZone();
}

function restart() {
  zoneIndex.value = 0;
  trail.splice(0);
  startSession();
}

onMounted(() => {
  warmCatchLightPiano(session.settings.sound);
  setCatchLightPianoActive(session.settings.sound, session.status === "running");
});

watch(() => session.status, (status) => {
  setCatchLightPianoActive(session.settings.sound, status === "running");
});

onUnmounted(() => {
  disposeCatchLightPiano();
});
</script>

<template>
  <div class="catch-light-shell">
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
  background: #080f19;
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
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
  justify-content: center;
  position: relative;
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

.catch-light-orb--active.catch-light-icon {
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
</style>
