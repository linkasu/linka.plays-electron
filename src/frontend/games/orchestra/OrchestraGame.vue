<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";

type OrchestraInstrument = {
  id: string;
  label: string;
  section: string;
  icon: string;
  color: string;
  frequency: number;
};

const instruments: OrchestraInstrument[] = [
  { id: "piano", label: "Пианино", section: "первое", icon: "mdi-piano", color: "#8fb7ff", frequency: 261.63 },
  { id: "violin", label: "Скрипка", section: "вторая", icon: "mdi-violin", color: "#f0a6c6", frequency: 329.63 },
  { id: "trumpet", label: "Труба", section: "третья", icon: "mdi-trumpet", color: "#ffd166", frequency: 392 },
  { id: "guitar", label: "Гитара", section: "четвёртая", icon: "mdi-guitar-acoustic", color: "#c9a27e", frequency: 349.23 },
  { id: "saxophone", label: "Саксофон", section: "пятая", icon: "mdi-saxophone", color: "#f7b267", frequency: 440 },
  { id: "bells", label: "Колокольчики", section: "шестая", icon: "mdi-bell-outline", color: "#9ad9c2", frequency: 523.25 },
  { id: "voice", label: "Тихий голос", section: "седьмая", icon: "mdi-microphone-variant", color: "#b9a7f7", frequency: 587.33 },
  { id: "note", label: "Мягкая нота", section: "восьмая", icon: "mdi-music-note-eighth", color: "#9fd7f5", frequency: 659.25 }
];

const router = useRouter();
const feedbackMessage = ref("Выбирай инструменты по порядку. Подсказка показывает, кто вступает следующим.");
const audioEnabled = ref(false);
let audioContext: AudioContext | null = null;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("orchestra", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.55, motionSpeed: 0.42, distractors: "none", hints: "high" },
  finishOnMistakes: false
});

const resultVisible = computed(() => session.status === "finished");
const placedInstruments = computed(() => instruments.slice(0, session.step));
const nextInstrument = computed(() => instruments[session.step]);
const choiceInstruments = computed(() => {
  const step = session.step % instruments.length;
  const offsets = step % 2 === 0 ? [0, 1, 3, 5] : [2, 0, 4, 6];
  return offsets.map((offset) => instruments[(step + offset) % instruments.length]);
});

function instrumentTargetId(instrument: OrchestraInstrument) {
  return `orchestra:${session.step}:${instrument.id}`;
}

function isPlaced(instrument: OrchestraInstrument) {
  return placedInstruments.value.some((placed) => placed.id === instrument.id);
}

async function ensureAudio() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") await audioContext.resume();
    return audioContext.state === "running";
  } catch {
    return false;
  }
}

function playSoftTone(instrument: OrchestraInstrument) {
  if (!audioEnabled.value) return;

  void (async () => {
    try {
      if (!await ensureAudio() || !audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(instrument.frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.018, now + 0.08);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.55);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.58);
    } catch {
      // Audio is optional: any playback failure degrades to silence.
    }
  })();
}

function toggleAudio() {
  if (audioEnabled.value) {
    audioEnabled.value = false;
    feedbackMessage.value = "Звук выключен. Оркестр продолжает играть только визуально.";
    return;
  }

  audioEnabled.value = true;
  void (async () => {
    if (!await ensureAudio()) {
      audioEnabled.value = false;
      feedbackMessage.value = "Звук недоступен. Игра продолжается тихо.";
    } else {
      feedbackMessage.value = "Звук включён очень тихо.";
    }
  })();
}

function chooseInstrument(instrument: OrchestraInstrument) {
  if (session.status !== "running") return;

  const expected = nextInstrument.value;
  if (!expected) return;

  if (instrument.id !== expected.id) {
    recordMistake({ targetId: instrumentTargetId(instrument), selectedId: instrument.id, expectedId: expected.id });
    feedbackMessage.value = `Сейчас ждём ${expected.label.toLowerCase()}. ${instrument.label} вступит позже.`;
    return;
  }

  recordSuccess({ targetId: instrumentTargetId(instrument), instrumentId: instrument.id, label: instrument.label });
  playSoftTone(instrument);
  feedbackMessage.value = `${instrument.label} вступает очень тихо. Оркестр становится полнее.`;
}

function restart() {
  feedbackMessage.value = "Выбирай инструменты по порядку. Подсказка показывает, кто вступает следующим.";
  startSession();
}

onUnmounted(() => {
  void audioContext?.close().catch(() => undefined);
});
</script>

<template>
  <div class="orchestra-shell">
    <GameHud
      title="Оркестр"
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

    <v-container class="orchestra-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="orchestra-panel pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="d-flex flex-column flex-md-row align-center justify-space-between ga-4 mb-5">
              <div class="text-center text-md-start">
                <div class="text-overline text-primary mb-1">Последовательность инструментов</div>
                <h1 class="text-h3 text-md-h2 font-weight-bold">Собери тихий оркестр</h1>
                <p class="text-h6 text-medium-emphasis mt-2 mb-0">Выбирай инструмент, который должен вступить следующим. Ошибка только подсказывает порядок.</p>
              </div>
              <v-btn :prepend-icon="audioEnabled ? 'mdi-volume-low' : 'mdi-volume-off'" color="primary" rounded="xl" size="large" variant="tonal" @click="toggleAudio">
                {{ audioEnabled ? "Тихий звук включён" : "Звук выключен" }}
              </v-btn>
            </div>

            <v-card class="conductor-card pa-4 pa-md-5 mb-5" color="indigo-lighten-5" rounded="xl" variant="flat">
              <div class="text-caption text-medium-emphasis mb-1">Следующий вступает</div>
              <div v-if="nextInstrument" class="d-flex flex-wrap align-center ga-3">
                <v-avatar :color="nextInstrument.color" size="64">
                  <v-icon :icon="nextInstrument.icon" size="42" />
                </v-avatar>
                <div>
                  <div class="text-h5 text-md-h4 font-weight-bold">{{ nextInstrument.label }}</div>
                  <div class="text-body-1 text-medium-emphasis">{{ nextInstrument.section }} партия оркестра</div>
                </div>
              </div>
              <div v-else class="text-h5 text-md-h4 font-weight-bold">Оркестр собран.</div>
            </v-card>

            <div class="orchestra-layout">
              <v-card class="stage-card pa-4 pa-md-5" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                <div class="stage-arc" aria-label="Собранный тихий оркестр">
                  <div class="conductor" aria-hidden="true">
                    <v-icon icon="mdi-metronome" size="68" />
                  </div>
                  <div v-for="instrument in instruments" :key="`stage-${instrument.id}`" class="stage-seat" :class="{ 'stage-seat--filled': isPlaced(instrument) }" :style="{ '--instrument-color': instrument.color }">
                    <v-icon :icon="instrument.icon" size="42" />
                  </div>
                </div>
                <v-alert class="mt-4 text-body-1 text-md-h6" color="primary" icon="mdi-music-box-outline" rounded="xl" variant="tonal">
                  {{ feedbackMessage }}
                </v-alert>
              </v-card>

              <div class="choice-grid">
                <GameDwellButton
                  v-for="instrument in choiceInstruments"
                  :key="`${session.step}-${instrument.id}`"
                  :target-id="instrumentTargetId(instrument)"
                  :disabled="session.status !== 'running'"
                  :dwell-ms="session.settings.dwellMs"
                  :min-height="128"
                  color="surface"
                  @select="chooseInstrument(instrument)"
                >
                  <template #default="{ active, progress }">
                    <div class="instrument-card" :class="{ 'instrument-card--active': active }" :style="{ '--instrument-color': instrument.color, '--instrument-progress': progress }">
                      <v-icon class="instrument-icon" :icon="instrument.icon" />
                      <div class="instrument-card__label text-h5 font-weight-bold mt-3">{{ instrument.label }}</div>
                      <div class="instrument-card__hint text-body-2 mt-2">{{ active ? "Держи взгляд" : "Посмотри сюда" }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Оркестр"
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
.orchestra-shell {
  background: radial-gradient(circle at 18% 12%, rgb(196 214 255 / 54%), transparent 34%), linear-gradient(135deg, #f7f3ff 0%, #eef8ff 48%, #fff7e8 100%);
  min-block-size: 100vh;
}

.orchestra-container {
  min-block-size: 100vh;
  padding-block-start: 128px;
}

.orchestra-panel {
  overflow: hidden;
}

.conductor-card {
  border: 2px solid rgb(var(--v-theme-primary) / 16%);
}

.orchestra-layout {
  align-items: stretch;
  display: grid;
  gap: 28px;
  grid-template-columns: 1.15fr 1fr;
}

.stage-card {
  min-inline-size: 0;
}

.stage-arc {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  min-block-size: 330px;
  position: relative;
}

.conductor {
  align-items: center;
  background: rgb(255 255 255 / 70%);
  border: 2px solid rgb(var(--v-theme-primary) / 18%);
  border-radius: 999px;
  color: rgb(var(--v-theme-primary));
  display: flex;
  inline-size: 116px;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  justify-content: center;
  min-block-size: 116px;
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.stage-seat {
  align-items: center;
  background: rgb(255 255 255 / 58%);
  border: 2px dashed color-mix(in srgb, var(--instrument-color) 44%, white);
  border-radius: 28px;
  color: color-mix(in srgb, var(--instrument-color) 74%, #334155);
  display: flex;
  justify-content: center;
  min-block-size: 116px;
  opacity: 0.34;
  transition: opacity 220ms ease, transform 220ms ease, background 220ms ease;
}

.stage-seat--filled {
  background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--instrument-color) 28%, white), rgb(255 255 255 / 78%));
  border-style: solid;
  box-shadow: 0 16px 30px color-mix(in srgb, var(--instrument-color) 20%, transparent);
  opacity: 1;
  transform: translateY(-4px);
}

.choice-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.instrument-card {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
}

.instrument-card::before {
  background: radial-gradient(circle, color-mix(in srgb, var(--instrument-color) 34%, transparent), transparent 68%);
  block-size: 150px;
  border-radius: 999px;
  content: "";
  inline-size: 150px;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  opacity: calc(0.32 + var(--instrument-progress) * 0.34);
  position: absolute;
  transform: translate(-50%, -50%);
}

.instrument-card > * {
  position: relative;
  z-index: 1;
}

.instrument-icon {
  color: color-mix(in srgb, var(--instrument-color) 78%, #243b53);
  filter: drop-shadow(0 12px 20px color-mix(in srgb, var(--instrument-color) 24%, transparent));
  font-size: clamp(4.5rem, 9vw, 7rem);
  transition: transform 220ms ease;
}

.instrument-card--active .instrument-icon {
  transform: scale(1.08) rotate(-2deg);
}

@media (max-width: 960px) {
  .orchestra-container {
    padding-block-start: 116px;
  }

  .orchestra-layout {
    grid-template-columns: 1fr;
  }

  .stage-arc {
    min-block-size: 260px;
  }
}

@media (max-height: 820px) {
  .orchestra-container {
    padding-block-start: 7.25rem;
  }

  .stage-card {
    display: none;
  }

  .orchestra-panel > .d-flex,
  .conductor-card {
    display: none !important;
  }

  .orchestra-layout {
    grid-template-columns: 1fr;
  }

  .choice-grid {
    gap: 12px;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .instrument-card__label,
  .instrument-card__hint {
    color: #1f2a27 !important;
  }

  .instrument-card__hint {
    display: none;
  }

  .instrument-icon {
    font-size: clamp(3rem, 8vw, 4.5rem);
  }
}

@media (max-width: 600px) {
  .choice-grid {
    grid-template-columns: 1fr;
  }

  .stage-arc {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .conductor {
    inline-size: 88px;
    min-block-size: 88px;
  }
}
</style>
