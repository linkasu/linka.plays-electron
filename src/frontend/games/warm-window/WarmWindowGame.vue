<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssets from "../../data/ttsAssets.json";
import { disposeWarmWindowPiano, playWarmWindowCue, setWarmWindowPianoActive, tickWarmWindowPiano, warmWarmWindowPiano } from "./audio";

type WindowTarget = {
  id: string;
  label: string;
  animal: string;
  ttsId: string;
  gridColumn: number;
  gridRow: number;
  lit: boolean;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSessionFor("warm-window", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.6, motionSpeed: 0.35, distractors: "none", hints: "high", sound: true },
  finishOnMistakes: false
});

const windows = reactive<WindowTarget[]>([
  { id: "warm-window:window:1", label: "котик", animal: "🐱", ttsId: "warm-window.cat", gridColumn: 1, gridRow: 1, lit: false },
  { id: "warm-window:window:2", label: "щенок", animal: "🐶", ttsId: "warm-window.dog", gridColumn: 2, gridRow: 1, lit: false },
  { id: "warm-window:window:3", label: "зайчик", animal: "🐰", ttsId: "warm-window.rabbit", gridColumn: 3, gridRow: 1, lit: false },
  { id: "warm-window:window:4", label: "лисёнок", animal: "🦊", ttsId: "warm-window.fox", gridColumn: 1, gridRow: 2, lit: false },
  { id: "warm-window:window:5", label: "медвежонок", animal: "🐻", ttsId: "warm-window.bear", gridColumn: 2, gridRow: 2, lit: false },
  { id: "warm-window:window:6", label: "панда", animal: "🐼", ttsId: "warm-window.panda", gridColumn: 3, gridRow: 2, lit: false },
  { id: "warm-window:window:7", label: "лягушонок", animal: "🐸", ttsId: "warm-window.frog", gridColumn: 1, gridRow: 3, lit: false },
  { id: "warm-window:window:8", label: "птичка", animal: "🐦", ttsId: "warm-window.bird", gridColumn: 3, gridRow: 3, lit: false }
]);

const resultVisible = computed(() => session.status === "finished");
const warmWindowTtsAssets = (ttsAssets as TtsAsset[]).filter((asset) => asset.game === "warm-window");
let audioFrame = 0;
let introTimer = 0;

function ttsAsset(id: string) {
  return warmWindowTtsAssets.find((asset) => asset.id === id);
}

function lightWindow(windowTarget: WindowTarget) {
  if (session.status !== "running" || windowTarget.lit) return;
  windowTarget.lit = true;
  recordSuccess({ targetId: windowTarget.id, label: windowTarget.label });
  playWarmWindowCue(session.settings.sound);
  playTtsAsset(session.settings.sound, ttsAsset(windowTarget.ttsId), 1);
}

function restart() {
  for (const windowTarget of windows) windowTarget.lit = false;
  startSession();
  playTtsAsset(session.settings.sound, ttsAsset("warm-window.intro"), 0.92);
}

function tickAudio() {
  tickWarmWindowPiano(session.settings.sound);
  setWarmWindowPianoActive(session.settings.sound, session.status === "running");
  audioFrame = requestAnimationFrame(tickAudio);
}

onMounted(() => {
  warmTtsAssets(session.settings.sound, warmWindowTtsAssets);
  warmWarmWindowPiano(session.settings.sound);
  introTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset("warm-window.intro"), 0.92);
  }, 450);
  audioFrame = requestAnimationFrame(tickAudio);
});

onUnmounted(() => {
  cancelAnimationFrame(audioFrame);
  window.clearTimeout(introTimer);
  disposeTtsAssets(warmWindowTtsAssets);
  disposeWarmWindowPiano();
});
</script>

<template>
  <div class="warm-window-shell">
    <div class="warm-window-sky" aria-hidden="true">
      <span class="warm-window-star warm-window-star--one" />
      <span class="warm-window-star warm-window-star--two" />
      <span class="warm-window-star warm-window-star--three" />
    </div>

    <GameHud
      title="Тёплое окно"
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

    <v-container class="warm-window-container d-flex align-center justify-center" fluid>
      <v-card class="warm-window-scene pa-4 pa-sm-6 pa-md-8" color="transparent" elevation="0">
        <div class="warm-window-house" role="group" aria-label="Дом с окнами для игры Тёплое окно">
          <div class="warm-window-roof" aria-hidden="true">
            <div class="warm-window-chimney"></div>
            <div class="warm-window-roof-triangle"></div>
          </div>
          <div class="warm-window-body">
            <div class="warm-window-grid">
              <GameDwellButton
                v-for="windowTarget in windows"
                :key="windowTarget.id"
                :target-id="windowTarget.id"
                :dwell-ms="session.settings.dwellMs"
                :disabled="session.status !== 'running' || windowTarget.lit"
                :min-height="92"
                :color="windowTarget.lit ? 'amber-lighten-4' : 'blue-grey-darken-3'"
                class="warm-window-target"
                :style="{ gridColumn: windowTarget.gridColumn, gridRow: windowTarget.gridRow }"
                @select="lightWindow(windowTarget)"
              >
                <template #default="{ active, progress }">
                  <div :class="['warm-window-pane', { 'warm-window-pane--lit': windowTarget.lit, 'warm-window-pane--active': active }]">
                    <span v-if="windowTarget.lit" class="warm-window-animal" aria-hidden="true">{{ windowTarget.animal }}</span>
                    <span v-else class="warm-window-emoji" aria-hidden="true">🪟</span>
                  </div>
                </template>
              </GameDwellButton>

              <div class="warm-window-door" aria-hidden="true">
                <v-icon icon="mdi-home-heart" />
              </div>
            </div>
          </div>
        </div>

      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Тёплое окно"
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
.warm-window-shell {
  background: linear-gradient(180deg, #19213b 0%, #283655 48%, #3f4659 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.warm-window-container {
  min-block-size: 100vh;
  padding-block: 64px 24px;
}

.warm-window-sky {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.warm-window-star {
  background: rgb(255 238 188 / 72%);
  border-radius: 999px;
  box-shadow: 0 0 34px rgb(255 226 163 / 42%);
  block-size: 0.6rem;
  inline-size: 0.6rem;
  position: absolute;
}

.warm-window-star--one {
  inset-block-start: 18%;
  inset-inline-start: 15%;
}

.warm-window-star--two {
  inset-block-start: 28%;
  inset-inline-end: 18%;
  transform: scale(0.75);
}

.warm-window-star--three {
  inset-block-start: 12%;
  inset-inline-end: 34%;
  transform: scale(0.55);
}

.warm-window-scene {
  inline-size: min(1320px, 98vw);
  position: relative;
  z-index: 1;
}

.warm-window-house {
  margin-inline: auto;
  max-inline-size: min(1160px, 96vw);
  padding-block-start: clamp(68px, 10vh, 118px);
  position: relative;
}

.warm-window-roof {
  block-size: clamp(128px, 16vh, 188px);
  inline-size: 100%;
  inset-block-start: 0;
  inset-inline-start: 0;
  position: absolute;
  z-index: 0;
}

.warm-window-roof-triangle {
  background: linear-gradient(135deg, #8f4638 0%, #b95f46 52%, #74352f 100%);
  block-size: 100%;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
  filter: drop-shadow(0 24px 34px rgb(30 19 28 / 28%));
  inline-size: 100%;
  position: relative;
  z-index: 1;
}

.warm-window-chimney {
  background: linear-gradient(180deg, #8c4438 0%, #69342f 100%);
  block-size: clamp(58px, 7vh, 86px);
  border-radius: 10px 10px 2px 2px;
  box-shadow: inset 0 0 0 2px rgb(255 215 185 / 18%), 0 14px 26px rgb(30 19 28 / 24%);
  inline-size: clamp(46px, 5vw, 70px);
  inset-block-start: clamp(12px, 2vh, 22px);
  inset-inline-end: 24%;
  position: absolute;
  z-index: 0;
}

.warm-window-body {
  background: linear-gradient(180deg, #f0c796 0%, #d7a26f 100%);
  border: 10px solid rgb(112 70 58 / 44%);
  border-radius: 36px 36px 24px 24px;
  box-shadow: inset 0 0 0 2px rgb(255 244 214 / 28%), 0 28px 70px rgb(16 18 32 / 36%);
  margin-inline: auto;
  max-inline-size: min(1040px, 94vw);
  padding: clamp(24px, 3.4vw, 46px);
  position: relative;
  z-index: 1;
}

.warm-window-grid {
  display: grid;
  gap: clamp(18px, 2.6vw, 34px);
  grid-template-columns: repeat(3, minmax(136px, 1fr));
  grid-template-rows: repeat(3, clamp(124px, 15.8vh, 176px));
}

.warm-window-target {
  min-block-size: clamp(124px, 15.8vh, 176px);
}

.warm-window-pane {
  align-items: center;
  color: rgb(222 232 238 / 92%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 100%;
  text-shadow: none;
  transition: color 180ms ease, filter 180ms ease, transform 180ms ease;
}

.warm-window-pane--active {
  color: #fff7dd;
  transform: scale(1.04);
}

.warm-window-pane--lit {
  color: #744118;
  filter: drop-shadow(0 0 18px rgb(255 200 102 / 64%));
}

.warm-window-emoji,
.warm-window-animal {
  filter: drop-shadow(0 0 18px rgb(255 223 154 / 72%));
  font-family: "Twemoji Mozilla", "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
  font-size: clamp(3.8rem, 7.6vw, 6.6rem);
  line-height: 1;
}

.warm-window-emoji {
  filter: drop-shadow(0 0 14px rgb(210 228 238 / 38%));
  opacity: 0.86;
}

.warm-window-door {
  align-items: center;
  background: linear-gradient(180deg, #7c503d, #5c352d);
  border-radius: 24px 24px 8px 8px;
  block-size: 100%;
  color: #ffd88b;
  display: flex;
  font-size: clamp(2.8rem, 5.4vw, 4.6rem);
  grid-column: 2;
  grid-row: 3;
  justify-content: center;
  min-block-size: clamp(124px, 15.8vh, 176px);
}

@media (max-width: 640px) {
  .warm-window-container {
    align-items: flex-start !important;
    padding-block: 82px 16px;
  }

  .warm-window-house {
    max-inline-size: 96vw;
    padding-block-start: 54px;
  }

  .warm-window-body {
    border-width: 7px;
    padding: 14px;
  }

  .warm-window-grid {
    gap: 10px;
    grid-template-columns: repeat(3, minmax(68px, 1fr));
    grid-template-rows: repeat(3, clamp(76px, 20vw, 96px));
  }

  .warm-window-target,
  .warm-window-door {
    min-block-size: clamp(76px, 20vw, 96px);
  }
}
</style>
