<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssets from "../../data/ttsAssets.json";
import { disposeOpenDoorCue, playOpenDoorCue } from "./audio";
import { advanceOpenDoor, createOpenDoorState, revealOpenDoor } from "./model";

const revealPauseMs = 2400;
const router = useRouter();
const { session, durationMs, metrics, recommendation, finishSession, recordSuccess, startSession } = useGameSessionFor("open-door", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.7, motionSpeed: 0.32, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false
});

const doorState = ref(createOpenDoorState(session.maxSteps));
const doorOpen = computed(() => doorState.value.phase === "revealed");
const currentReward = computed(() => doorState.value.reward);
const resultVisible = computed(() => session.status === "finished");
const targetMinHeight = computed(() => {
  const scaledHeight = 18 * Math.max(0.8, session.settings.targetScale);
  return `min(${scaledHeight.toFixed(2)}rem, calc(100dvh - 9.5rem))`;
});
const targetStyle = computed(() => ({
  "--open-door-target-scale": Math.max(0.8, session.settings.targetScale).toFixed(2),
  "--open-door-motion-duration": `${Math.round(360 + (1 - Math.min(1, session.settings.motionSpeed)) * 240)}ms`,
  "--open-door-glow": currentReward.value?.glow ?? "#ffe5a3",
  "--open-door-reward-color": currentReward.value?.color ?? "#e6a425"
}));
const openDoorTtsAssets = (ttsAssets as TtsAsset[]).filter((asset) => asset.game === "open-door");
let revealTimer: number | undefined;
let introTimer = 0;

function ttsAsset(id: string) {
  return openDoorTtsAssets.find((asset) => asset.id === id);
}

function clearRevealTimer() {
  if (revealTimer === undefined) return;
  window.clearTimeout(revealTimer);
  revealTimer = undefined;
}

function finishReveal() {
  if (session.status !== "running") return;

  doorState.value = advanceOpenDoor(doorState.value);
  revealTimer = undefined;
  if (doorState.value.phase === "complete") finishSession("game-complete");
}

function openDoor() {
  if (session.status !== "running" || doorState.value.phase !== "closed") return;

  const nextState = revealOpenDoor(doorState.value);
  const reward = nextState.reward;
  if (!reward) return;

  clearRevealTimer();
  doorState.value = nextState;
  recordSuccess({ targetId: `open-door:door:${nextState.openedCount}`, label: reward.label });
  playOpenDoorCue(session.settings.sound);
  playTtsAsset(session.settings.sound, ttsAsset(reward.ttsId), 0.32);
  revealTimer = window.setTimeout(finishReveal, revealPauseMs);
}

function restart() {
  clearRevealTimer();
  window.clearTimeout(introTimer);
  doorState.value = createOpenDoorState(session.maxSteps);
  startSession();
  playTtsAsset(session.settings.sound, ttsAsset("open-door.intro"), 0.36);
}

onMounted(() => {
  warmTtsAssets(session.settings.sound, openDoorTtsAssets);
  introTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset("open-door.intro"), 0.36);
  }, 450);
});

onUnmounted(() => {
  clearRevealTimer();
  window.clearTimeout(introTimer);
  disposeTtsAssets(openDoorTtsAssets);
  disposeOpenDoorCue();
});
</script>

<template>
  <main class="open-door-shell">
    <v-container class="open-door-container d-flex align-center justify-center" fluid>
      <GameDwellButton
        :target-id="`open-door:door:${session.step + 1}`"
        :dwell-ms="session.settings.dwellMs"
        :disabled="session.status !== 'running' || doorState.phase !== 'closed'"
        :min-height="targetMinHeight"
        :style="targetStyle"
        color="transparent"
        class="open-door-target"
        @select="openDoor"
      >
        <template #default="{ active }">
          <div class="open-door-stage" :aria-label="doorOpen ? undefined : 'Закрытая дверь. Удерживай взгляд, чтобы открыть.'">
            <div class="open-door-doorway" aria-hidden="true" />
            <div :class="['open-door-light', { 'open-door-light--visible': doorOpen }]" aria-hidden="true" />

            <div v-if="doorOpen && currentReward" class="open-door-reveal" aria-live="polite">
              <v-icon :icon="currentReward.icon" class="open-door-reveal-icon" />
              <span class="open-door-sr-only">{{ currentReward.label }}</span>
            </div>

            <div :class="['open-door-panel', { 'open-door-panel--open': doorOpen, 'open-door-panel--active': active }]" aria-hidden="true">
              <div class="open-door-panel-inset" />
              <div class="open-door-handle" />
            </div>
          </div>
        </template>
      </GameDwellButton>
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
  </main>
</template>

<style scoped>
.open-door-shell {
  background: linear-gradient(180deg, #172238 0%, #2c4160 54%, #667b8a 100%);
  block-size: 100dvh;
  overflow: hidden;
  position: relative;
}

.open-door-container {
  block-size: 100%;
  padding: clamp(1.5rem, 4dvh, 2.5rem);
  position: relative;
  z-index: 1;
}

.open-door-target {
  block-size: min(calc(18rem * var(--open-door-target-scale)), calc(100dvh - 9.5rem));
  inline-size: min(calc(14rem * var(--open-door-target-scale)), calc(100dvw - 3rem), 28rem);
  max-block-size: 32rem;
}

.open-door-target :deep(.dwell-button) {
  background: transparent !important;
  box-shadow: none;
  padding: 0 !important;
}

.open-door-target :deep(.dwell-button--active) {
  box-shadow: 0 0 0 0.28rem rgb(255 229 170 / 52%);
  transform: scale(1.015);
}

.open-door-stage {
  align-items: center;
  block-size: 100%;
  display: flex;
  inline-size: 100%;
  justify-content: center;
  perspective: 64rem;
  position: relative;
}

.open-door-doorway {
  background: linear-gradient(180deg, #172238 0%, #251a19 100%);
  border: clamp(0.65rem, 1.8dvh, 1rem) solid #6d4935;
  border-block-end-width: clamp(0.9rem, 2.4dvh, 1.3rem);
  border-radius: 3.2rem 3.2rem 0.7rem 0.7rem;
  box-shadow: 0 1.4rem 2.8rem rgb(23 20 24 / 42%), inset 0 0 2.2rem rgb(0 0 0 / 48%);
  inset: 0;
  position: absolute;
}

.open-door-light {
  background: radial-gradient(circle, var(--open-door-glow) 0%, rgb(255 245 214 / 52%) 40%, transparent 74%);
  block-size: 92%;
  border-radius: 999rem;
  inline-size: 110%;
  opacity: 0;
  position: absolute;
  transform: scale(0.74);
  transition: opacity var(--open-door-motion-duration) ease, transform var(--open-door-motion-duration) ease;
}

.open-door-light--visible {
  opacity: 0.96;
  transform: scale(1);
}

.open-door-reveal {
  align-items: center;
  color: var(--open-door-reward-color);
  display: flex;
  inset: 13% 12%;
  justify-content: center;
  position: absolute;
  z-index: 1;
}

.open-door-reveal-icon {
  filter: drop-shadow(0 0 1.4rem rgb(255 246 211 / 92%));
  font-size: clamp(7rem, 24dvh, 13rem);
}

.open-door-panel {
  background:
    linear-gradient(90deg, transparent 0 8%, rgb(255 229 179 / 10%) 8% 10%, transparent 10% 100%),
    linear-gradient(145deg, #a8734e 0%, #7b4a31 52%, #54301f 100%);
  border: clamp(0.55rem, 1.6dvh, 0.85rem) solid #5c3827;
  border-radius: 2.65rem 2.65rem 0.6rem 0.6rem;
  box-shadow: inset 0 0 0 0.18rem rgb(255 231 188 / 16%), 0 1.35rem 2.7rem rgb(31 23 23 / 36%);
  inset: 0;
  position: absolute;
  transform-origin: left center;
  transition: filter 180ms ease, transform var(--open-door-motion-duration) cubic-bezier(0.2, 0.75, 0.25, 1);
  z-index: 2;
}

.open-door-panel--active {
  filter: brightness(1.12);
}

.open-door-panel--open {
  transform: rotateY(-68deg);
}

.open-door-panel-inset {
  border: 0.25rem solid rgb(255 231 188 / 22%);
  border-radius: 2rem 2rem 0.5rem 0.5rem;
  inset: 7% 9% 20%;
  position: absolute;
}

.open-door-handle {
  background: #f6d58f;
  block-size: clamp(1.2rem, 3dvh, 1.65rem);
  border-radius: 999rem;
  box-shadow: 0 0 1.1rem rgb(255 218 142 / 68%);
  inline-size: clamp(1.2rem, 3dvh, 1.65rem);
  inset-block-start: 52%;
  inset-inline-end: 10%;
  position: absolute;
}

.open-door-sr-only {
  block-size: 0.0625rem;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  inline-size: 0.0625rem;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .open-door-light,
  .open-door-panel,
  .open-door-target :deep(.dwell-button) {
    transition-duration: 1ms;
  }
}
</style>
