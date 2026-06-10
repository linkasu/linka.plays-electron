<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type SoundObject = {
  id: string;
  title: string;
  aacLabel: string;
  soundLabel: string;
  icon: string;
  accent: string;
  wash: string;
  frequency: number;
  pulse: number;
};

type WhatSoundsRound = {
  roundId: string;
  target: SoundObject;
  choices: SoundObject[];
};

const soundObjects: SoundObject[] = [
  { id: "cat", title: "Кот", aacLabel: "кот", soundLabel: "мягкое мяу", icon: "mdi-cat", accent: "#9b6a48", wash: "#fff0df", frequency: 392, pulse: 0.95 },
  { id: "dog", title: "Собака", aacLabel: "собака", soundLabel: "тихий гав", icon: "mdi-dog", accent: "#7d6a57", wash: "#f3eadf", frequency: 349.23, pulse: 0.86 },
  { id: "bell", title: "Колокольчик", aacLabel: "звон", soundLabel: "лёгкий звон", icon: "mdi-bell-outline", accent: "#d49a2f", wash: "#fff4cf", frequency: 523.25, pulse: 1.14 },
  { id: "duck", title: "Утка", aacLabel: "утка", soundLabel: "тихое кря", icon: "mdi-duck", accent: "#d1a12e", wash: "#fff6d8", frequency: 440, pulse: 1.02 },
  { id: "water", title: "Вода", aacLabel: "вода", soundLabel: "мягкая вода", icon: "mdi-water", accent: "#4f9fd8", wash: "#e5f5ff", frequency: 329.63, pulse: 0.78 },
  { id: "train", title: "Поезд", aacLabel: "поезд", soundLabel: "далёкий поезд", icon: "mdi-train", accent: "#6a78c8", wash: "#ecefff", frequency: 293.66, pulse: 0.7 },
  { id: "bird", title: "Птичка", aacLabel: "птица", soundLabel: "лёгкая песня", icon: "mdi-bird", accent: "#71a84d", wash: "#eff9de", frequency: 587.33, pulse: 1.22 },
  { id: "speaker", title: "Динамик", aacLabel: "звук", soundLabel: "тёплая нота", icon: "mdi-volume-high", accent: "#986fc7", wash: "#f4ebff", frequency: 493.88, pulse: 1.08 }
];

const router = useRouter();
const selectedObjectId = ref("");
const lastMistakeObjectId = ref("");
const feedbackMessage = ref("Посмотри, от какой AAC-карточки расходится мягкая волна.");
const mistakenObjectIds = new Set<string>();
let nextRoundTimer = 0;
let audioContext: AudioContext | undefined;
let audioUnavailable = false;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("what-sounds", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120,
  targetScale: 1.55,
  motionSpeed: 0.42,
  distractors: "none",
  hints: "high",
  sound: false
}, {
  finishOnMistakes: false
});

const round = reactive<WhatSoundsRound>(createRound(0));
const resultVisible = computed(() => session.status === "finished");
const promptText = computed(() => `Что звучит: ${round.target.soundLabel}?`);

function createRound(step: number): WhatSoundsRound {
  const count = Math.min(4, 2 + Math.floor(step / 3));
  const offset = (step * 3) % soundObjects.length;
  const choices = Array.from({ length: count }, (_, index) => soundObjects[(offset + index) % soundObjects.length]);
  if (step % 2 === 1) choices.reverse();

  return {
    roundId: `what-sounds-${step}`,
    target: choices[(step + 1) % choices.length],
    choices
  };
}

function setRound(step: number) {
  Object.assign(round, createRound(step));
  selectedObjectId.value = "";
  lastMistakeObjectId.value = "";
  mistakenObjectIds.clear();
  feedbackMessage.value = "Волна видна всегда. Тихий звук можно включить, но он не обязателен.";
  void playObjectCue(round.target, "prompt");
}

function objectTargetId(object: SoundObject) {
  return `what-sounds:${round.roundId}:${object.id}`;
}

function objectStyle(object: SoundObject, index: number) {
  return {
    "--sound-accent": object.accent,
    "--sound-wash": object.wash,
    "--sound-delay": `${index * 170}ms`,
    "--sound-pulse": object.pulse.toString()
  };
}

function chooseObject(object: SoundObject) {
  if (session.status !== "running" || selectedObjectId.value) return;

  if (object.id !== round.target.id) {
    lastMistakeObjectId.value = object.id;
    feedbackMessage.value = `Почти. Нужная карточка — «${round.target.title}». Посмотри на мягкую волну и попробуй ещё раз.`;
    if (!mistakenObjectIds.has(object.id)) {
      mistakenObjectIds.add(object.id);
      recordMistake({ roundId: round.roundId, selectedId: object.id, targetId: round.target.id, expected: round.target.soundLabel });
    }
    return;
  }

  selectedObjectId.value = object.id;
  feedbackMessage.value = `Верно, звучит «${object.title}».`;
  recordSuccess({ roundId: round.roundId, targetId: object.id, word: object.aacLabel, sound: object.soundLabel });
  void playObjectCue(object, "success");

  if (session.status === "running") {
    window.clearTimeout(nextRoundTimer);
    nextRoundTimer = window.setTimeout(() => setRound(session.step), 1050);
  }
}

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : undefined;
}

async function playObjectCue(object: SoundObject, kind: "prompt" | "success") {
  if (!session.settings.sound || audioUnavailable) return;

  try {
    audioContext = audioContext ?? createAudioContext();
    if (!audioContext) return;
    if (audioContext.state === "suspended") await audioContext.resume();
    if (audioContext.state !== "running") return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const startAt = audioContext.currentTime + 0.04;
    const duration = kind === "success" ? 0.68 : 0.86;
    const endAt = startAt + duration;

    oscillator.type = kind === "success" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(object.frequency, startAt);
    oscillator.frequency.linearRampToValueAtTime(object.frequency * object.pulse, startAt + duration * 0.55);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(kind === "success" ? 0.04 : 0.026, startAt + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.05);
  } catch {
    audioUnavailable = true;
  }
}

function restart() {
  window.clearTimeout(nextRoundTimer);
  audioUnavailable = false;
  startSession();
  setRound(0);
}

watch(() => session.settings.sound, (enabled) => {
  if (enabled) void playObjectCue(round.target, "prompt");
});

onUnmounted(() => {
  window.clearTimeout(nextRoundTimer);
  void audioContext?.close().catch(() => undefined);
});
</script>

<template>
  <div class="what-sounds-shell">
    <div class="what-sounds-backdrop" aria-hidden="true" />

    <GameHud
      title="Что звучит?"
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

    <v-container class="what-sounds-container d-flex align-center justify-center" fluid>
      <v-card class="what-sounds-panel pa-4 pa-sm-6 pa-md-8" color="surface" rounded="xl" elevation="8">
        <div class="text-center mb-5">
          <div class="text-overline text-primary">AAC + listening, звук выключен по умолчанию</div>
          <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">Что звучит?</h1>
          <p class="text-h6 text-medium-emphasis mb-2">{{ promptText }}</p>
          <p class="text-body-1 text-medium-emphasis mb-0">Выбери большую карточку по видимой волне. Ошибка только мягко подскажет.</p>
        </div>

        <div class="d-flex flex-column flex-sm-row align-center justify-space-between ga-3 mb-5">
          <v-alert class="flex-grow-1" color="primary" icon="mdi-waveform" rounded="xl" variant="tonal">
            {{ feedbackMessage }}
          </v-alert>
          <v-switch
            v-model="session.settings.sound"
            class="what-sounds-toggle"
            color="primary"
            density="compact"
            hide-details
            inset
            label="Тихий звук"
          />
        </div>

        <div class="what-sounds-grid" :class="`what-sounds-grid--${round.choices.length}`" role="group" aria-label="Выбор объекта по визуальной звуковой волне">
          <GameDwellButton
            v-for="(object, index) in round.choices"
            :key="objectTargetId(object)"
            class="what-sounds-target"
            :target-id="objectTargetId(object)"
            :disabled="session.status !== 'running' || Boolean(selectedObjectId)"
            :dwell-ms="session.settings.dwellMs"
            :min-height="230"
            color="surface"
            @select="chooseObject(object)"
          >
            <template #default="{ active, progress }">
              <div
                class="sound-card"
                :class="{
                  'sound-card--target': object.id === round.target.id,
                  'sound-card--active': active,
                  'sound-card--selected': selectedObjectId === object.id,
                  'sound-card--mistake': lastMistakeObjectId === object.id
                }"
                :style="objectStyle(object, index)"
              >
                <div v-if="object.id === round.target.id" class="sound-waves" aria-hidden="true">
                  <span class="sound-wave sound-wave--one" />
                  <span class="sound-wave sound-wave--two" />
                  <span class="sound-wave sound-wave--three" />
                </div>
                <div class="sound-glow" :style="{ opacity: object.id === round.target.id ? 0.46 + progress * 0.2 : active ? 0.28 : 0.16 }" aria-hidden="true" />
                <v-icon class="sound-icon" :icon="object.icon" />
                <div class="text-h5 text-md-h4 font-weight-bold mt-4">{{ object.title }}</div>
                <v-chip class="mt-3 text-uppercase" color="primary" rounded="pill" size="large" variant="tonal">
                  {{ object.aacLabel }}
                </v-chip>
                <div class="text-body-2 text-medium-emphasis mt-3">
                  {{ selectedObjectId === object.id ? 'Выбрано' : lastMistakeObjectId === object.id ? 'Не эта карточка' : active ? 'Держи взгляд' : 'Посмотри сюда' }}
                </div>
              </div>
            </template>
          </GameDwellButton>
        </div>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Что звучит?"
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
.what-sounds-shell {
  background: linear-gradient(135deg, #edf8ff 0%, #fff7df 52%, #f3ecff 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.what-sounds-backdrop {
  background: radial-gradient(circle at 15% 22%, rgb(255 255 255 / 70%), transparent 25%),
    radial-gradient(circle at 82% 18%, rgb(135 202 255 / 28%), transparent 30%),
    radial-gradient(circle at 54% 92%, rgb(255 218 150 / 30%), transparent 44%);
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.what-sounds-container {
  min-block-size: 100vh;
  padding-block-start: 118px;
  position: relative;
  z-index: 1;
}

.what-sounds-panel {
  inline-size: min(1120px, 100%);
}

.what-sounds-toggle {
  min-inline-size: 154px;
}

.what-sounds-grid {
  display: grid;
  gap: clamp(16px, 2vw, 24px);
}

.what-sounds-grid--2 {
  grid-template-columns: repeat(2, minmax(220px, 1fr));
}

.what-sounds-grid--3 {
  grid-template-columns: repeat(3, minmax(190px, 1fr));
}

.what-sounds-grid--4 {
  grid-template-columns: repeat(4, minmax(170px, 1fr));
}

.what-sounds-target :deep(.dwell-button) {
  background: linear-gradient(180deg, var(--sound-wash), rgb(var(--v-theme-surface))) !important;
}

.sound-card {
  align-items: center;
  block-size: 100%;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 210px;
  overflow: hidden;
  position: relative;
}

.sound-card--active,
.sound-card--selected {
  transform: scale(1.02);
}

.sound-card--mistake {
  filter: saturate(0.72);
}

.sound-card > :not(.sound-waves, .sound-glow) {
  position: relative;
  z-index: 1;
}

.sound-glow {
  background: radial-gradient(circle, color-mix(in srgb, var(--sound-accent) 42%, transparent), transparent 68%);
  block-size: 210px;
  border-radius: 999px;
  inline-size: 210px;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translate(-50%, -50%);
}

.sound-icon {
  color: var(--sound-accent);
  filter: drop-shadow(0 18px 26px color-mix(in srgb, var(--sound-accent) 30%, transparent));
  font-size: clamp(5.2rem, 10vw, 8rem);
}

.sound-waves {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.sound-wave {
  animation: sound-wave calc(2300ms / var(--sound-pulse)) ease-out infinite;
  animation-delay: var(--sound-delay);
  border: 4px solid color-mix(in srgb, var(--sound-accent) 46%, transparent);
  border-radius: 999px;
  block-size: 72px;
  inline-size: 72px;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  opacity: 0;
  position: absolute;
  transform: translate(-50%, -50%) scale(0.55);
}

.sound-wave--two {
  animation-delay: calc(var(--sound-delay) + 520ms);
}

.sound-wave--three {
  animation-delay: calc(var(--sound-delay) + 1040ms);
}

@keyframes sound-wave {
  0% {
    opacity: 0.42;
    transform: translate(-50%, -50%) scale(0.62);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2.65);
  }
}

@media (max-width: 900px) {
  .what-sounds-grid,
  .what-sounds-grid--2,
  .what-sounds-grid--3,
  .what-sounds-grid--4 {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }
}

@media (max-width: 560px) {
  .what-sounds-container {
    padding-block-start: 168px;
  }

  .what-sounds-grid,
  .what-sounds-grid--2,
  .what-sounds-grid--3,
  .what-sounds-grid--4 {
    grid-template-columns: 1fr;
  }
}
</style>
