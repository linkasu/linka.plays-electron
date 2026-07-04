<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssets from "../../data/ttsAssets.json";
import { disposeOpenDoorPiano, playOpenDoorCue, setOpenDoorPianoActive, tickOpenDoorPiano, warmOpenDoorPiano } from "./audio";

type DoorReveal = {
  icon: string;
  label: string;
  glow: string;
  ttsId: string;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSessionFor("open-door", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.7, motionSpeed: 0.32, distractors: "none", hints: "high", sound: true },
  finishOnMistakes: false
});

const reveals: DoorReveal[] = [
  { icon: "mdi-lightbulb-on", label: "тёплый свет", glow: "#ffe5a3", ttsId: "open-door.warm-light" },
  { icon: "mdi-heart", label: "розовое сердце", glow: "#ffc2d6", ttsId: "open-door.pink-heart" },
  { icon: "mdi-flower", label: "зелёный цветок", glow: "#c9f4c7", ttsId: "open-door.green-flower" },
  { icon: "mdi-star", label: "фиолетовая звезда", glow: "#f9e7ff", ttsId: "open-door.violet-star" },
  { icon: "mdi-weather-sunny", label: "лучик солнца", glow: "#ffdf8a", ttsId: "open-door.sun-ray" },
  { icon: "mdi-cloud", label: "пушистое облако", glow: "#d7ecff", ttsId: "open-door.fluffy-cloud" },
  { icon: "mdi-music-note", label: "нота", glow: "#d8d1ff", ttsId: "open-door.music-note" },
  { icon: "mdi-creation", label: "золотая искра", glow: "#ffe7bd", ttsId: "open-door.gold-spark" }
];

const doorOpen = ref(false);
const currentReveal = ref(reveals[0]);
const resultVisible = computed(() => session.status === "finished");
const openDoorTtsAssets = (ttsAssets as TtsAsset[]).filter((asset) => asset.game === "open-door");
let closeTimer: number | undefined;
let introTimer = 0;
let audioFrame = 0;

function ttsAsset(id: string) {
  return openDoorTtsAssets.find((asset) => asset.id === id);
}

function clearCloseTimer() {
  if (closeTimer === undefined) return;
  window.clearTimeout(closeTimer);
  closeTimer = undefined;
}

function closeDoorForNextStep() {
  if (session.status !== "running") return;
  doorOpen.value = false;
  closeTimer = undefined;
}

function openDoor() {
  if (session.status !== "running" || doorOpen.value) return;

  clearCloseTimer();
  currentReveal.value = reveals[session.step % reveals.length];
  doorOpen.value = true;
  recordSuccess({ targetId: `open-door:door:${session.step + 1}`, label: currentReveal.value.label });
  playOpenDoorCue(session.settings.sound);
  playTtsAsset(session.settings.sound, ttsAsset(currentReveal.value.ttsId), 1);

  if (session.status === "running" && session.step < session.maxSteps) {
    closeTimer = window.setTimeout(closeDoorForNextStep, 1250);
  }
}

function restart() {
  clearCloseTimer();
  window.clearTimeout(introTimer);
  doorOpen.value = false;
  currentReveal.value = reveals[0];
  startSession();
  playTtsAsset(session.settings.sound, ttsAsset("open-door.intro"), 0.92);
}

function tickAudio() {
  tickOpenDoorPiano(session.settings.sound);
  setOpenDoorPianoActive(session.settings.sound, session.status === "running");
  audioFrame = requestAnimationFrame(tickAudio);
}

onMounted(() => {
  warmTtsAssets(session.settings.sound, openDoorTtsAssets);
  warmOpenDoorPiano(session.settings.sound);
  introTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset("open-door.intro"), 0.92);
  }, 450);
  audioFrame = requestAnimationFrame(tickAudio);
});

onUnmounted(() => {
  clearCloseTimer();
  window.clearTimeout(introTimer);
  cancelAnimationFrame(audioFrame);
  disposeTtsAssets(openDoorTtsAssets);
  disposeOpenDoorPiano();
});
</script>

<template>
  <div class="open-door-shell">
    <div class="open-door-ambient" aria-hidden="true">
      <span class="open-door-orb open-door-orb--one" />
      <span class="open-door-orb open-door-orb--two" />
      <span class="open-door-orb open-door-orb--three" />
    </div>

    <GameHud
      title="Открой дверцу"
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

    <v-container class="open-door-container d-flex align-center justify-center" fluid>
      <v-card class="open-door-scene pa-4 pa-sm-6 pa-md-8" color="transparent" elevation="0">
        <GameDwellButton
          :target-id="`open-door:door:${session.step + 1}`"
          :dwell-ms="session.settings.dwellMs"
          :disabled="session.status !== 'running' || doorOpen"
          :min-height="320"
          color="brown-lighten-4"
          class="open-door-target mx-auto"
          @select="openDoor"
        >
          <template #default="{ active, progress }">
            <div class="open-door-stage" :style="{ '--open-door-glow': currentReveal.glow }">
              <div :class="['open-door-light', { 'open-door-light--visible': doorOpen }]" />

              <div v-if="doorOpen" class="open-door-reveal">
                <v-icon :icon="currentReveal.icon" class="open-door-reveal-icon" />
              </div>

              <div :class="['open-door-panel', { 'open-door-panel--open': doorOpen, 'open-door-panel--active': active }]">
                <div class="open-door-panel-top" aria-hidden="true" />
                <v-icon icon="mdi-door" class="open-door-icon" />
                <div class="open-door-handle" aria-hidden="true" />
              </div>
            </div>
          </template>
        </GameDwellButton>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Открой дверцу"
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
.open-door-shell {
  background: linear-gradient(180deg, #182136 0%, #243654 48%, #40536a 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.open-door-container {
  min-block-size: 100vh;
  padding-block-start: 72px;
}

.open-door-ambient {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.open-door-orb {
  background: rgb(255 232 177 / 24%);
  border-radius: 999px;
  filter: blur(2px);
  position: absolute;
}

.open-door-orb--one {
  block-size: 9rem;
  inline-size: 9rem;
  inset-block-start: 16%;
  inset-inline-start: 9%;
}

.open-door-orb--two {
  block-size: 13rem;
  inline-size: 13rem;
  inset-block-end: 10%;
  inset-inline-end: 7%;
}

.open-door-orb--three {
  block-size: 6rem;
  inline-size: 6rem;
  inset-block-start: 24%;
  inset-inline-end: 22%;
}

.open-door-scene {
  inline-size: min(780px, 100%);
  position: relative;
  z-index: 1;
}

.open-door-target {
  inline-size: min(520px, 100%);
}

.open-door-stage {
  align-items: center;
  color: #5c321e;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 380px;
  overflow: hidden;
  position: relative;
}

.open-door-light {
  background: radial-gradient(circle, var(--open-door-glow) 0%, rgb(255 245 214 / 48%) 38%, transparent 72%);
  block-size: 118%;
  border-radius: 999px;
  inline-size: 118%;
  opacity: 0;
  position: absolute;
  transform: scale(0.72);
  transition: opacity 300ms ease, transform 460ms ease;
}

.open-door-light--visible {
  opacity: 0.94;
  transform: scale(1);
}

.open-door-reveal {
  align-items: center;
  color: #4d321e;
  display: flex;
  flex-direction: column;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  position: absolute;
  text-align: center;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.open-door-reveal-icon {
  filter: drop-shadow(0 0 22px rgb(255 235 184 / 86%));
  font-size: clamp(4.2rem, 15vw, 7rem);
}

.open-door-panel {
  background: linear-gradient(135deg, #9d6948 0%, #7b4a31 54%, #5c321f 100%);
  border: 10px solid rgb(72 39 24 / 42%);
  border-radius: 42px 42px 18px 18px;
  box-shadow: inset 0 0 0 3px rgb(255 231 188 / 18%), 0 22px 46px rgb(40 28 22 / 28%);
  block-size: clamp(210px, 42vw, 278px);
  inline-size: clamp(170px, 42vw, 232px);
  position: relative;
  transform-origin: left center;
  transition: transform 520ms ease, filter 240ms ease;
  z-index: 2;
}

.open-door-panel--active {
  filter: brightness(1.08);
}

.open-door-panel--open {
  transform: perspective(860px) rotateY(-84deg) translateX(-54px);
}

.open-door-panel-top {
  border: 4px solid rgb(255 231 188 / 24%);
  border-radius: 32px 32px 14px 14px;
  inset: 18px 22px 68px;
  position: absolute;
}

.open-door-icon {
  color: rgb(255 229 179 / 72%);
  font-size: clamp(4rem, 12vw, 6rem);
  inset-block-start: 50%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translate(-50%, -54%);
}

.open-door-handle {
  background: #f5d085;
  block-size: 1.25rem;
  border-radius: 999px;
  box-shadow: 0 0 18px rgb(255 210 126 / 58%);
  inline-size: 1.25rem;
  inset-block-start: 52%;
  inset-inline-end: 24px;
  position: absolute;
}

@media (max-width: 640px) {
 .open-door-container {
    align-items: flex-start !important;
    padding-block-start: 82px;
  }

 .open-door-stage {
    min-block-size: 330px;
  }
}
</style>
