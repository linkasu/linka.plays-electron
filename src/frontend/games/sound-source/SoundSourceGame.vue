<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";

type SoundSource = {
  id: string;
  title: string;
  soundLabel: string;
  icon: string;
  visual?: string;
  accent: string;
  wash: string;
  soundPath: string;
  cueMs: number;
  volume: number;
};

type SoundRound = {
  roundId: string;
  target: SoundSource;
  choices: SoundSource[];
};

type CachedSourceAudio = {
  audio: HTMLAudioElement;
  sourceNode?: MediaElementAudioSourceNode;
  pannerNode?: StereoPannerNode;
};

const soundSources: SoundSource[] = [
  {
    id: "shell",
    title: "Ракушка",
    soundLabel: "морская волна",
    icon: "mdi-waves",
    visual: "🐚",
    accent: "#5ab8c8",
    wash: "#ddfbff",
    soundPath: "/audio/sfx/sound-source/shell-wave.mp3",
    cueMs: 1700,
    volume: 0.38
  },
  {
    id: "bell",
    title: "Колокольчик",
    soundLabel: " звон",
    icon: "mdi-bell-outline",
    accent: "#f0b64a",
    wash: "#fff1c8",
    soundPath: "/audio/sfx/sound-source/bell.mp3",
    cueMs: 2200,
    volume: 0.32
  },
  {
    id: "bird",
    title: "Птичка",
    soundLabel: "лёгкая песня",
    icon: "mdi-bird",
    accent: "#8dbb5d",
    wash: "#eef8d8",
    soundPath: "/audio/sfx/sound-source/bird.mp3",
    cueMs: 1200,
    volume: 0.34
  },
  {
    id: "stream",
    title: "Ручей",
    soundLabel: " вода",
    icon: "mdi-water",
    accent: "#6b9dec",
    wash: "#e5f0ff",
    soundPath: "/audio/sfx/sound-source/stream.mp3",
    cueMs: 1800,
    volume: 0.36
  },
  {
    id: "leaf",
    title: "Лист",
    soundLabel: "шорох листа",
    icon: "mdi-leaf",
    accent: "#68b78d",
    wash: "#e4f8ec",
    soundPath: "/audio/sfx/sound-source/leaf.mp3",
    cueMs: 1200,
    volume: 0.32
  },
  {
    id: "speaker",
    title: "Динамик",
    soundLabel: "тёплая нота",
    icon: "mdi-speaker",
    accent: "#b28be8",
    wash: "#f2e9ff",
    soundPath: "/audio/sfx/sound-source/speaker.mp3",
    cueMs: 1100,
    volume: 0.28
  }
];

const router = useRouter();
const selectedSourceId = ref("");
const lastMistakeSourceId = ref("");
const pendingAudio = ref(false);
const feedbackMessage = ref("Найди объект, от которого расходятся волны.");
const mistakenSourceIds = new Set<string>();
let nextRoundTimer = 0;
let audioContext: AudioContext | undefined;
let currentAudio: CachedSourceAudio | undefined;
let stopAudioTimer = 0;
let playbackToken = 0;
const audioCache = new Map<string, CachedSourceAudio>();

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("sound-source", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.55, motionSpeed: 0.45, distractors: "none", hints: "high", sound: true },
  finishOnMistakes: false
});

const round = reactive<SoundRound>(createRound(0));
const resultVisible = computed(() => session.status === "finished");
const promptText = computed(() => "Где этот звук?");
const promptAudio = useGamePromptAudio({ gameId: "sound-source", soundEnabled: toRef(session.settings, "sound") });

function createRound(step: number): SoundRound {
  const count = Math.min(4, 2 + Math.floor(step / 3));
  const offset = (step * 2) % soundSources.length;
  const choices = Array.from({ length: count }, (_, index) => soundSources[(offset + index) % soundSources.length]);
  if (step % 2 === 1) choices.reverse();

  return {
    roundId: `sound-source-${step}`,
    target: choices[(step + 1) % choices.length],
    choices
  };
}

function setRound(step: number) {
  Object.assign(round, createRound(step));
  selectedSourceId.value = "";
  lastMistakeSourceId.value = "";
  mistakenSourceIds.clear();
  feedbackMessage.value = "Смотри на объект с волнами. звук включён, а волну видно всегда.";
  void playRoundPromptAndCue(180);
}

function sourceTargetId(source: SoundSource) {
  return `sound-source:${round.roundId}:${source.id}`;
}

function sourceStyle(source: SoundSource, index: number) {
  return {
    "--source-accent": source.accent,
    "--source-wash": source.wash,
    "--source-delay": `${index * 180}ms`
  };
}

function sourcePan(source: SoundSource) {
  const index = round.choices.findIndex((choice) => choice.id === source.id);
  if (index < 0 || round.choices.length < 2) return 0;
  return ((index / (round.choices.length - 1)) * 2 - 1) * 0.62;
}

async function chooseSource(source: SoundSource) {
  if (session.status !== "running" || selectedSourceId.value || pendingAudio.value) return;

  const token = ++playbackToken;

  if (source.id !== round.target.id) {
    pendingAudio.value = true;
    lastMistakeSourceId.value = source.id;
    feedbackMessage.value = "Почти. Посмотри, откуда расходятся волны, и попробуй ещё раз.";
    if (!mistakenSourceIds.has(source.id)) {
      mistakenSourceIds.add(source.id);
      recordMistake({ roundId: round.roundId, selectedId: source.id, targetId: round.target.id, expected: round.target.soundLabel });
    }
    await promptAudio.playSequenceAndWait(["sound-source.mistake"], 80);
    await playSourceCue(round.target, "source");
    if (token === playbackToken) {
      pendingAudio.value = false;
      lastMistakeSourceId.value = "";
    }
    return;
  }

  pendingAudio.value = true;
  selectedSourceId.value = source.id;
  feedbackMessage.value = `Да, это «${source.title}». Волна найдена.`;
  recordSuccess({ roundId: round.roundId, targetId: source.id, sound: source.soundLabel });
  await playSourceCue(source, "success");
  await promptAudio.playSequenceAndWait(["sound-source.correct"], 80);

  if (token === playbackToken && session.status === "running") {
    window.clearTimeout(nextRoundTimer);
    nextRoundTimer = window.setTimeout(() => setRound(session.step), 260);
  } else if (token === playbackToken) {
    pendingAudio.value = false;
  }
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : undefined;
}

async function connectSourceAudio(entry: CachedSourceAudio, pan: number) {
  audioContext = audioContext ?? createAudioContext();
  if (!audioContext) return;
  if (audioContext.state === "suspended") await audioContext.resume();
  if (!entry.sourceNode) {
    entry.sourceNode = audioContext.createMediaElementSource(entry.audio);
    entry.pannerNode = audioContext.createStereoPanner();
    entry.sourceNode.connect(entry.pannerNode).connect(audioContext.destination);
  }
  if (entry.pannerNode) entry.pannerNode.pan.value = pan;
}

function getSourceAudio(source: SoundSource) {
  let entry = audioCache.get(source.soundPath);
  if (!entry) {
    const audio = new Audio(source.soundPath);
    audio.preload = "auto";
    audio.volume = source.volume;
    entry = { audio };
    audioCache.set(source.soundPath, entry);
  }
  return entry;
}

function warmSourceAudio() {
  if (!session.settings.sound) return;
  for (const source of soundSources) {
    try {
      getSourceAudio(source).audio.load();
    } catch {
      // Object sounds are supportive only; gameplay continues with visual waves.
    }
  }
}

function stopCurrentAudio(invalidatePlayback = true) {
  window.clearTimeout(stopAudioTimer);
  if (invalidatePlayback) {
    playbackToken += 1;
    pendingAudio.value = false;
    promptAudio.cancelPending();
  }
  if (!currentAudio) return;
  currentAudio.audio.pause();
  currentAudio.audio.currentTime = 0;
}

async function playSourceCue(source: SoundSource, kind: "source" | "success") {
  if (!session.settings.sound) return;

  try {
    stopCurrentAudio(false);
    const entry = getSourceAudio(source);
    const audio = entry.audio;
    await connectSourceAudio(entry, sourcePan(source));
    currentAudio = entry;
    audio.currentTime = 0;
    audio.volume = Math.min(0.42, kind === "success" ? source.volume + 0.04 : source.volume);
    await audio.play();
    stopAudioTimer = window.setTimeout(() => {
      if (currentAudio !== entry) return;
      audio.pause();
      audio.currentTime = 0;
    }, source.cueMs);
    await wait(source.cueMs);
  } catch {
    // Audio is optional: autoplay/load failures must not disable later user-triggered attempts.
  }
}

async function playRoundPromptAndCue(delayMs = 0) {
  const token = ++playbackToken;
  pendingAudio.value = true;
  await promptAudio.playSequenceAndWait(["sound-source.prompt"], delayMs);
  await playSourceCue(round.target, "source");
  if (token === playbackToken) pendingAudio.value = false;
}

function restart() {
  window.clearTimeout(nextRoundTimer);
  stopCurrentAudio();
  startSession();
  setRound(0);
}

watch(() => session.settings.sound, (enabled) => {
  if (!enabled) {
    stopCurrentAudio();
    return;
  }
  warmSourceAudio();
  void playRoundPromptAndCue(120);
});

onMounted(() => {
  promptAudio.warm();
  warmSourceAudio();
  void playRoundPromptAndCue(450);
});

onUnmounted(() => {
  window.clearTimeout(nextRoundTimer);
  stopCurrentAudio();
  audioCache.clear();
});
</script>

<template>
  <div class="sound-source-shell">
    <div class="sound-source-backdrop" aria-hidden="true" />

    <GameHud
      title="Где звук?"
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

    <v-container class="sound-source-container d-flex align-center justify-center" fluid>
      <v-card class="sound-source-panel pa-3 pa-sm-4 pa-md-6" color="surface" rounded="xl" elevation="8">
        <div class="text-center mb-3">
          <div class="text-overline text-primary"> звук и визуальная волна</div>
          <h1 class="text-h4 text-md-h2 font-weight-bold mb-1">Где звук?</h1>
          <p class="text-body-1 text-md-h6 text-medium-emphasis mb-1">{{ promptText }}</p>
          <p class="text-body-2 text-md-body-1 text-medium-emphasis mb-0">Выбери один из крупных объектов. Ошибка только подскажет, где искать волну.</p>
        </div>

        <div class="d-flex align-center mb-3">
          <v-alert class="flex-grow-1" color="primary" icon="mdi-waves" rounded="xl" variant="tonal">
            {{ feedbackMessage }}
          </v-alert>
        </div>

        <div class="sound-source-grid" :class="`sound-source-grid--${round.choices.length}`" role="group" aria-label="Выбор источника звука или визуальной волны">
          <GameDwellButton
            v-for="(source, index) in round.choices"
            :key="sourceTargetId(source)"
            class="sound-source-target"
            :target-id="sourceTargetId(source)"
            :disabled="session.status !== 'running' || Boolean(selectedSourceId) || pendingAudio"
            :dwell-ms="session.settings.dwellMs"
            min-height="clamp(10rem, 28vh, 14rem)"
            color="surface"
            @select="chooseSource(source)"
          >
            <template #default="{ active, progress }">
              <div
                class="source-card"
                :class="{
                  'source-card--target': source.id === round.target.id,
                  'source-card--active': active,
                  'source-card--selected': selectedSourceId === source.id,
                  'source-card--mistake': lastMistakeSourceId === source.id
                }"
                :style="sourceStyle(source, index)"
              >
                <div v-if="source.id === round.target.id" class="source-waves" aria-hidden="true">
                  <span class="source-wave source-wave--one" />
                  <span class="source-wave source-wave--two" />
                  <span class="source-wave source-wave--three" />
                </div>
                <div class="source-glow" :style="{ opacity: source.id === round.target.id ? 0.44 + progress * 0.22 : active ? 0.28 : 0.18 }" aria-hidden="true" />
                <span v-if="source.visual" class="source-emoji" aria-hidden="true">{{ source.visual }}</span>
                <v-icon v-else class="source-icon" :icon="source.icon" />
                <div class="text-h6 text-md-h4 font-weight-bold mt-2">{{ source.title }}</div>
                <div class="source-caption text-body-2 mt-1">
                  {{ selectedSourceId === source.id ? 'Волна найдена' : lastMistakeSourceId === source.id ? 'Не отсюда' : active ? 'Держи взгляд' : 'Посмотри сюда' }}
                </div>
              </div>
            </template>
          </GameDwellButton>
        </div>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Где звук?"
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
.sound-source-shell {
  background: linear-gradient(135deg, #eef8ff 0%, #fff7dc 48%, #f4ecff 100%);
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.sound-source-backdrop {
  background: radial-gradient(circle at 18% 20%, rgb(255 255 255 / 70%), transparent 26%),
    radial-gradient(circle at 82% 18%, rgb(168 218 255 / 34%), transparent 30%),
    radial-gradient(circle at 50% 88%, rgb(255 214 153 / 28%), transparent 42%);
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.sound-source-container {
  min-block-size: 100vh;
  padding-block: 5rem 1.25rem;
  position: relative;
  z-index: 1;
}

.sound-source-panel {
  inline-size: min(1120px, 100%);
}

.sound-source-grid {
  display: grid;
  gap: clamp(16px, 2vw, 24px);
}

.sound-source-grid--2 {
  grid-template-columns: repeat(2, minmax(220px, 1fr));
}

.sound-source-grid--3 {
  grid-template-columns: repeat(3, minmax(190px, 1fr));
}

.sound-source-grid--4 {
  grid-template-columns: repeat(4, minmax(170px, 1fr));
}

.sound-source-target :deep(.dwell-button) {
  background: linear-gradient(180deg, var(--source-wash), rgb(var(--v-theme-surface))) !important;
}

.source-card {
  align-items: center;
  block-size: 100%;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 9.5rem;
  overflow: hidden;
  position: relative;
}

.source-card--active,
.source-card--selected {
  transform: scale(1.02);
}

.source-card--mistake {
  filter: saturate(0.74);
}

.source-card > :not(.source-waves,.source-glow) {
  position: relative;
  z-index: 1;
}

.source-glow {
  background: radial-gradient(circle, color-mix(in srgb, var(--source-accent) 42%, transparent), transparent 68%);
  block-size: 11rem;
  border-radius: 999px;
  inline-size: 11rem;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translate(-50%, -50%);
}

.source-icon {
  color: var(--source-accent);
  filter: drop-shadow(0 18px 26px color-mix(in srgb, var(--source-accent) 30%, transparent));
  font-size: clamp(4.1rem, min(8vw, 13vh), 7rem);
}

.source-emoji {
  filter: drop-shadow(0 18px 26px color-mix(in srgb, var(--source-accent) 30%, transparent));
  font-size: clamp(4.1rem, min(8vw, 13vh), 7rem);
  line-height: 1;
}

.source-caption {
  color: #445852;
}

.source-waves {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.source-wave {
  animation: source-wave 2300ms ease-out infinite;
  animation-delay: var(--source-delay);
  border: 4px solid color-mix(in srgb, var(--source-accent) 46%, transparent);
  border-radius: 999px;
  block-size: 72px;
  inline-size: 72px;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  opacity: 0;
  position: absolute;
  transform: translate(-50%, -50%) scale(0.55);
}

.source-wave--two {
  animation-delay: calc(var(--source-delay) + 520ms);
}

.source-wave--three {
  animation-delay: calc(var(--source-delay) + 1040ms);
}

@keyframes source-wave {
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
 .sound-source-grid,
 .sound-source-grid--2,
 .sound-source-grid--3,
 .sound-source-grid--4 {
    grid-template-columns: repeat(2, minmax(150px, 1fr));
  }
}

@media (max-width: 560px) {
 .sound-source-container {
    padding-block: 6.5rem 1rem;
  }

 .sound-source-grid,
 .sound-source-grid--2,
 .sound-source-grid--3,
 .sound-source-grid--4 {
    grid-template-columns: 1fr;
  }
}
</style>
