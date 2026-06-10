<script setup lang="ts">
import { computed, onUnmounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Pebble = {
  id: string;
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
  size: number;
  hue: number;
  icon: string;
};

type Wave = {
  id: string;
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
  hue: number;
  note: string;
};

const layouts = [
  [
    { x: 24, y: 60, size: 220, hue: 205, icon: "mdi-music-note" },
    { x: 52, y: 48, size: 250, hue: 278, icon: "mdi-music-note-eighth" },
    { x: 78, y: 64, size: 218, hue: 148, icon: "mdi-music-clef-treble" }
  ],
  [
    { x: 20, y: 46, size: 210, hue: 166, icon: "mdi-music-note-eighth" },
    { x: 48, y: 66, size: 260, hue: 222, icon: "mdi-music-note" },
    { x: 74, y: 42, size: 226, hue: 318, icon: "mdi-music-clef-treble" }
  ],
  [
    { x: 27, y: 70, size: 232, hue: 286, icon: "mdi-music-clef-treble" },
    { x: 55, y: 42, size: 238, hue: 134, icon: "mdi-music-note" },
    { x: 81, y: 61, size: 216, hue: 198, icon: "mdi-music-note-eighth" }
  ],
  [
    { x: 21, y: 56, size: 224, hue: 216, icon: "mdi-music-note" },
    { x: 50, y: 38, size: 214, hue: 344, icon: "mdi-music-clef-treble" },
    { x: 77, y: 72, size: 256, hue: 156, icon: "mdi-music-note-eighth" }
  ]
] as const;

const waveNotes = ["ля", "ми", "до", "соль", "ре"];
const mobilePebblePoints = [
  { x: 50, y: 34 },
  { x: 50, y: 60 },
  { x: 50, y: 86 }
] as const;
const router = useRouter();
const waves = reactive<Wave[]>([]);
const pebbles = reactive<Pebble[]>(createPebbles(0));
const resultVisible = computed(() => session.status === "finished");
let waveTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("musical-pebbles", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1350,
  sessionSeconds: 90,
  targetScale: 1.65,
  motionSpeed: 0.36,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

function createPebbles(step: number): Pebble[] {
  const layout = layouts[step % layouts.length];
  return layout.map((pebble, index) => ({
    ...pebble,
    mobileX: mobilePebblePoints[index]?.x ?? 50,
    mobileY: mobilePebblePoints[index]?.y ?? 60,
    id: `pebble-${step}-${index}`
  }));
}

function pebbleStyle(pebble: Pebble) {
  return {
    "--pebble-x": `${pebble.x}%`,
    "--pebble-y": `${pebble.y}%`,
    "--pebble-mobile-x": `${pebble.mobileX}%`,
    "--pebble-mobile-y": `${pebble.mobileY}%`,
    "--pebble-size": `${pebble.size}px`,
    "--pebble-hue": pebble.hue
  };
}

function waveStyle(wave: Wave) {
  return {
    "--wave-x": `${wave.x}%`,
    "--wave-y": `${wave.y}%`,
    "--wave-mobile-x": `${wave.mobileX}%`,
    "--wave-mobile-y": `${wave.mobileY}%`,
    "--wave-hue": wave.hue
  };
}

function refreshPebbles(step: number) {
  pebbles.splice(0, pebbles.length, ...createPebbles(step));
}

function addWave(pebble: Pebble) {
  waves.push({
    id: `wave-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    x: pebble.x,
    y: pebble.y,
    mobileX: pebble.mobileX,
    mobileY: pebble.mobileY,
    hue: pebble.hue,
    note: waveNotes[(session.step + waves.length) % waveNotes.length]
  });
  if (waves.length > 5) waves.shift();

  window.clearTimeout(waveTimer);
  waveTimer = window.setTimeout(() => {
    waves.splice(0, Math.max(0, waves.length - 2));
  }, 2200);
}

function selectPebble(pebble: Pebble) {
  if (session.status !== "running") return;
  addWave(pebble);
  recordSuccess({ targetId: pebble.id, hue: pebble.hue, response: "visual-wave" });
  if (session.status === "running") refreshPebbles(session.step);
}

function restart() {
  waves.splice(0);
  startSession();
  refreshPebbles(0);
}

onUnmounted(() => {
  window.clearTimeout(waveTimer);
});
</script>

<template>
  <div class="musical-pebbles-shell">
    <GameHud
      title="Музыкальные камешки"
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

    <div class="pebble-stage" aria-label="Музыкальные камешки: смотри на крупный камешек, чтобы появилась мягкая волна">
      <div class="soft-horizon" aria-hidden="true" />
      <div v-for="wave in waves" :key="wave.id" class="music-wave" :style="waveStyle(wave)" aria-hidden="true">
        <span class="wave-note">{{ wave.note }}</span>
        <span class="wave-ring wave-ring--one" />
        <span class="wave-ring wave-ring--two" />
        <span class="wave-ring wave-ring--three" />
      </div>

      <GameDwellButton
        v-for="pebble in pebbles"
        :key="pebble.id"
        class="pebble-target"
        :style="pebbleStyle(pebble)"
        :target-id="pebble.id"
        :dwell-ms="session.settings.dwellMs"
        :disabled="session.status !== 'running'"
        :min-height="pebble.size"
        color="surface"
        @select="selectPebble(pebble)"
      >
        <template #default="{ active, progress }">
          <div class="pebble-body" :class="{ 'pebble-body--active': active }" :style="pebbleStyle(pebble)">
            <v-icon class="pebble-icon" :icon="pebble.icon" />
            <div class="pebble-glow" :style="{ opacity: active ? 0.42 + progress * 0.4 : 0.22 }" />
          </div>
        </template>
      </GameDwellButton>
    </div>

    <GameResultDialog
      :model-value="resultVisible"
      title="Музыкальные камешки"
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
.musical-pebbles-shell {
  background: linear-gradient(180deg, #eef8ff 0%, #f7f1ff 46%, #e8f6ef 100%);
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.pebble-stage {
  block-size: 100%;
  inline-size: 100%;
  position: relative;
}

.soft-horizon {
  background: radial-gradient(ellipse at 50% 72%, rgb(255 255 255 / 74%) 0%, rgb(255 255 255 / 32%) 32%, transparent 68%);
  block-size: 62%;
  filter: blur(2px);
  inline-size: 120%;
  inset-block-end: -20%;
  inset-inline-start: -10%;
  position: absolute;
}

.pebble-target {
  inline-size: min(var(--pebble-size), 29vw);
  inset-block-start: var(--pebble-y);
  inset-inline-start: var(--pebble-x);
  position: absolute;
  transform: translate(-50%, -50%);
}

.pebble-target :deep(.dwell-button) {
  background: transparent !important;
  box-shadow: none;
  padding: 0 !important;
}

.pebble-target :deep(.dwell-progress) {
  opacity: 0.72;
}

.pebble-body {
  aspect-ratio: 1.18 / 1;
  background: radial-gradient(circle at 34% 28%, hsl(var(--pebble-hue) 88% 94% / 0.92), hsl(var(--pebble-hue) 54% 73% / 0.9) 42%, hsl(var(--pebble-hue) 38% 51% / 0.94) 100%);
  border: 2px solid hsl(var(--pebble-hue) 76% 90% / 0.72);
  border-radius: 48% 52% 54% 46% / 45% 43% 57% 55%;
  box-shadow: 0 24px 42px hsl(var(--pebble-hue) 42% 36% / 0.2), inset -18px -18px 32px hsl(var(--pebble-hue) 34% 32% / 0.22), inset 18px 18px 28px rgb(255 255 255 / 0.34);
  display: grid;
  inline-size: 100%;
  min-block-size: clamp(168px, 23vw, var(--pebble-size));
  overflow: hidden;
  place-items: center;
  position: relative;
  transition: transform 220ms ease, filter 220ms ease;
}

.pebble-body--active {
  filter: saturate(1.08) brightness(1.04);
  transform: scale(1.04);
}

.pebble-icon {
  color: rgb(255 255 255 / 0.72);
  filter: drop-shadow(0 4px 10px hsl(var(--pebble-hue) 48% 28% / 0.28));
  font-size: clamp(4.6rem, 9vw, 7rem);
  z-index: 1;
}

.pebble-glow {
  background: radial-gradient(circle, rgb(255 255 255 / 0.92), transparent 62%);
  block-size: 56%;
  border-radius: 999px;
  filter: blur(12px);
  inline-size: 56%;
  inset-block-start: 13%;
  inset-inline-start: 16%;
  position: absolute;
  transition: opacity 180ms ease;
}

.music-wave {
  block-size: 1px;
  inline-size: 1px;
  inset-block-start: var(--wave-y);
  inset-inline-start: var(--wave-x);
  pointer-events: none;
  position: absolute;
  z-index: 1;
}

.wave-ring {
  animation: wave-expand 2.1s ease-out forwards;
  border: 4px solid hsl(var(--wave-hue) 86% 66% / 0.34);
  border-radius: 45% 55% 50% 50% / 52% 46% 54% 48%;
  inset: 0;
  position: absolute;
  transform: translate(-50%, -50%) scale(0.28);
}

.wave-ring--two {
  animation-delay: 180ms;
  border-color: hsl(calc(var(--wave-hue) + 34) 92% 72% / 0.28);
}

.wave-ring--three {
  animation-delay: 360ms;
  border-color: hsl(calc(var(--wave-hue) - 24) 88% 78% / 0.22);
}

.wave-note {
  animation: note-float 1.8s ease-out forwards;
  color: hsl(var(--wave-hue) 70% 38% / 0.72);
  font-size: clamp(1.3rem, 3.2vw, 2.4rem);
  font-weight: 800;
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 2;
}

@keyframes wave-expand {
  0% {
    block-size: 64px;
    inline-size: 90px;
    opacity: 0.66;
  }

  100% {
    block-size: min(48vw, 430px);
    inline-size: min(58vw, 520px);
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes note-float {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.88);
  }

  22% {
    opacity: 0.72;
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -150%) scale(1.08);
  }
}

@media (max-width: 720px) {
  .pebble-target {
    inline-size: min(var(--pebble-size), 56vw, 220px);
    inset-block-start: var(--pebble-mobile-y);
    inset-inline-start: var(--pebble-mobile-x);
  }

  .pebble-body {
    min-block-size: clamp(168px, 50vw, var(--pebble-size));
  }

  .music-wave {
    inset-block-start: var(--wave-mobile-y);
    inset-inline-start: var(--wave-mobile-x);
  }
}
</style>
