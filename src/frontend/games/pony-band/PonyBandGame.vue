<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStartPromptAudio } from "../../composables/useStartPromptAudio";
import { gameArtSrc } from "../../core/gameArt";
import { resolveMenuRoute } from "../../core/menuMode";
import { createPonyBand } from "./band";
import {
  beatSeconds,
  conductorArtId,
  nextStyleIndex,
  ponyArtId,
  ponyRoles,
  ponyStyles,
  type PonyRole,
} from "./model";

const ponyColors: Record<PonyRole, string> = {
  beat: "#ff9f43",
  bass: "#4aa3ff",
  chords: "#3ccf91",
  keys: "#f2c300",
  lead: "#a77bf3",
  sparkle: "#ff6fae",
};

const router = useRouter();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  recordEvent,
  startSession,
} = useGameSessionFor("pony-band", {
  maxSteps: 8,
  overrides: {
    preset: "gentle",
    targetScale: 1.45,
    motionSpeed: 0.5,
    distractors: "none",
    hints: "high",
    sound: true,
  },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
});
const soundEnabled = toRef(session.settings, "sound");
useStartPromptAudio({ gameId: "pony-band", soundEnabled });

const styleIndex = ref(0);
const style = computed(() => ponyStyles[styleIndex.value]);
const playing = reactive(new Set<PonyRole>());
const resultVisible = computed(() => session.status === "finished");
const canPlay = computed(() => session.status === "running");
const band = createPonyBand(style.value);

/** Active ponies bob to the beat of the music. */
const beatStyle = computed(() => ({ "--pony-beat": `${beatSeconds(style.value)}s` }));

function togglePony(role: PonyRole) {
  if (!canPlay.value) return;
  const on = !playing.has(role);
  if (on) playing.add(role);
  else playing.delete(role);
  recordEvent("target-click", { targetId: `pony-band:${role}`, on, style: style.value.id });
  void band.setRole(role, on);
}

function changeStyle() {
  if (!canPlay.value) return;
  styleIndex.value = nextStyleIndex(styleIndex.value);
  recordEvent("target-click", { targetId: "pony-band:conductor", style: style.value.id });
  void band.setStyle(style.value);
}

function ponyLabel(role: PonyRole) {
  const instrument = style.value.instruments[role];
  return playing.has(role) ? `Пони играет: ${instrument}` : `Пони с инструментом: ${instrument}`;
}

function restart() {
  band.stopAll();
  playing.clear();
  startSession();
}

watch(
  () => session.status,
  (status) => {
    if (status === "paused") band.pause();
    else if (status === "running") band.resume();
    else if (status === "finished") {
      band.stopAll();
      playing.clear();
    }
  },
);
watch(soundEnabled, (value) => band.setMuted(!value), { immediate: true });

onMounted(() => {
  void band.preload(style.value);
});

onUnmounted(() => {
  band.dispose();
});

if (import.meta.env.DEV) {
  (window as unknown as { __ponyBand?: typeof band }).__ponyBand = band;
}
</script>

<template>
  <div class="pony-band-shell" :style="beatStyle">
    <GameHud
      title="Пони-оркестр"
      :step="session.step"
      :max-steps="session.maxSteps"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      :show-progress="false"
      :show-timer="false"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <main class="pony-stage">
      <GameDwellButton
        class="conductor"
        target-id="pony-band:conductor"
        :disabled="!canPlay"
        :dwell-ms="session.settings.dwellMs"
        min-height="0"
        color="#fffaf0"
        @select="changeStyle"
      >
        <template #default>
          <div class="conductor-content" :aria-label="`Дирижёр: ${style.title}`">
            <img
              :key="style.id"
              class="conductor-art"
              :src="gameArtSrc(conductorArtId(style.id))"
              alt=""
            />
            <div class="conductor-title text-h5 text-md-h4 font-weight-bold">
              {{ style.title }}
            </div>
          </div>
        </template>
      </GameDwellButton>

      <div class="ponies">
        <GameDwellButton
          v-for="role in ponyRoles"
          :key="role"
          :class="['pony', { 'pony--playing': playing.has(role) }]"
          :style="{ '--pony-color': ponyColors[role] }"
          :target-id="`pony-band:${role}`"
          :disabled="!canPlay"
          :dwell-ms="session.settings.dwellMs"
          min-height="0"
          :pressed="playing.has(role)"
          @select="togglePony(role)"
        >
          <template #default>
            <div class="pony-content" :aria-label="ponyLabel(role)">
              <img
                :key="`${style.id}:${role}`"
                class="pony-art"
                :src="gameArtSrc(ponyArtId(style.id, role))"
                alt=""
              />
              <span v-if="playing.has(role)" class="pony-notes" aria-hidden="true">♪ ♫</span>
            </div>
          </template>
        </GameDwellButton>
      </div>
    </main>

    <GameResultDialog
      :model-value="resultVisible"
      title="Пони-оркестр"
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
.pony-band-shell {
  background: linear-gradient(180deg, #fff8ec 0%, #f3ecff 100%);
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.pony-stage {
  box-sizing: border-box;
  display: grid;
  gap: clamp(1rem, 2.4vmin, 2rem);
  grid-template-columns: minmax(12rem, 0.8fr) 3fr;
  block-size: calc(100dvh - var(--game-hud-clearance, 10.5rem));
  inset-block-start: var(--game-hud-clearance, 10.5rem);
  inset-inline: 0;
  padding: clamp(0.5rem, 1.6vmin, 1.25rem) clamp(1rem, 3vw, 2.5rem) clamp(1rem, 3vmin, 2rem);
  position: absolute;
}

.ponies {
  display: grid;
  gap: clamp(1rem, 2.4vmin, 2rem);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  min-block-size: 0;
}

.conductor,
.pony {
  min-block-size: 0;
}

.conductor :deep(.dwell-button),
.pony :deep(.dwell-button) {
  block-size: 100%;
  border-radius: clamp(1rem, 3vmin, 2rem) !important;
  padding: clamp(0.25rem, 1vmin, 0.75rem) !important;
}

/* Disabled while paused: keep the pictures bright. */
.pony :deep(.v-card--disabled > *),
.conductor :deep(.v-card--disabled > *) {
  opacity: 1;
}

.pony :deep(.dwell-button) {
  background: color-mix(in srgb, var(--pony-color) 12%, #fffdf8) !important;
  border: 0.25rem solid color-mix(in srgb, var(--pony-color) 35%, transparent) !important;
  transition:
    background 0.3s ease,
    border-color 0.3s ease;
}

.pony--playing :deep(.dwell-button) {
  background: color-mix(in srgb, var(--pony-color) 38%, #fffdf8) !important;
  border-color: var(--pony-color) !important;
  box-shadow: 0 0 1.5rem color-mix(in srgb, var(--pony-color) 55%, transparent) !important;
}

.pony-content,
.conductor-content {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  inline-size: 100%;
  justify-content: center;
  min-block-size: 0;
  position: relative;
}

.pony-art,
.conductor-art {
  flex: 1 1 auto;
  inline-size: 100%;
  min-block-size: 0;
  object-fit: contain;
}

.pony--playing .pony-art {
  animation: pony-bob var(--pony-beat, 0.5s) ease-in-out infinite alternate;
  transform-origin: 50% 100%;
}

@keyframes pony-bob {
  from {
    transform: translateY(0) rotate(-2deg);
  }
  to {
    transform: translateY(-4%) rotate(2deg);
  }
}

.pony-notes {
  animation: notes-float calc(var(--pony-beat, 0.5s) * 4) linear infinite;
  color: var(--pony-color);
  font-size: clamp(1.5rem, 4.5vmin, 3rem);
  font-weight: 700;
  inset-block-start: 4%;
  inset-inline-end: 8%;
  pointer-events: none;
  position: absolute;
  text-shadow: 0 0.1rem 0.2rem rgb(0 0 0 / 20%);
}

@keyframes notes-float {
  0% {
    opacity: 0;
    transform: translateY(30%);
  }
  25% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-60%);
  }
}

.conductor-title {
  color: #5b3f8c;
  flex: 0 0 auto;
  padding-block-end: clamp(0.25rem, 1vmin, 0.75rem);
}

@media (prefers-reduced-motion: reduce) {
  .pony--playing .pony-art,
  .pony-notes {
    animation: none;
  }
}
</style>
