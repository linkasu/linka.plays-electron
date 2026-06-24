<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateSolfegeSequence, nextSolfegeSequenceNote, solfegeChoiceNotes, solfegeMaxSteps, solfegeNotes, type SolfegeNote } from "./model";

const blackKeyLayout = [
  { left: "10.6%", label: "до-диез" },
  { left: "23.1%", label: "ре-диез" },
  { left: "48.2%", label: "фа-диез" },
  { left: "60.7%", label: "соль-диез" },
  { left: "73.2%", label: "ля-диез" }
];

const router = useRouter();
const audioEnabled = ref(true);
const noteSequence = ref(generateSolfegeSequence());
const notePeakGain = 0.8;
const pendingSelection = ref(false);
const successNoteId = ref<string>();
const successStep = ref<number>();
const wrongNoteId = ref<string>();
const hintedNoteId = ref<string>();
let feedbackTimer = 0;
let audioContext: AudioContext | undefined;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("solfege", {
  maxSteps: solfegeMaxSteps,
  overrides: { preset: "gentle", targetScale: 1.55, motionSpeed: 0.42, distractors: "none", hints: "high", dwellMs: 1300, sessionSeconds: 135 },
  finishOnMistakes: false
});

const resultVisible = computed(() => session.status === "finished");
const displayStep = computed(() => successStep.value ?? session.step);
const playedNotes = computed(() => noteSequence.value.slice(0, session.step));
const nextNote = computed(() => nextSolfegeSequenceNote(noteSequence.value, displayStep.value));
const choiceNotes = computed(() => solfegeChoiceNotes(displayStep.value));

function noteTargetId(note: SolfegeNote) {
  return `solfege:${session.step}:${note.id}`;
}

function isPlayed(note: SolfegeNote) {
  return playedNotes.value.some((played) => played.id === note.id);
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  pendingSelection.value = false;
  successNoteId.value = undefined;
  successStep.value = undefined;
  wrongNoteId.value = undefined;
  hintedNoteId.value = undefined;
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

function playNote(note: SolfegeNote) {
  if (!audioEnabled.value) return;
  void (async () => {
    try {
      if (!await ensureAudio() || !audioContext) return;
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(note.frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(notePeakGain, now + 0.08);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.58);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.62);
    } catch {
      // Audio is optional: any playback failure degrades to silence.
    }
  })();
}

function playPromptNote(delayMs = 0) {
  const note = nextNote.value;
  if (!note) return;
  window.setTimeout(() => playNote(note), delayMs);
}

function toggleAudio() {
  if (audioEnabled.value) {
    audioEnabled.value = false;
    return;
  }

  audioEnabled.value = true;
  void (async () => {
    if (!await ensureAudio()) {
      audioEnabled.value = false;
      return;
    }
    playPromptNote();
  })();
}

function chooseNote(note: SolfegeNote) {
  if (session.status !== "running" || pendingSelection.value) return;
  const expected = nextNote.value;
  if (!expected) return;

  clearFeedbackTimer();
  const targetId = noteTargetId(note);
  const expectedTargetId = noteTargetId(expected);

  if (note.id !== expected.id) {
    pendingSelection.value = true;
    wrongNoteId.value = note.id;
    hintedNoteId.value = undefined;
    playNote(note);
    recordMistake({ targetId, expectedTargetId, selectedId: note.id, expectedId: expected.id });
    feedbackTimer = window.setTimeout(() => {
      pendingSelection.value = false;
      wrongNoteId.value = undefined;
      hintedNoteId.value = undefined;
      playPromptNote(120);
    }, 1200);
    return;
  }

  pendingSelection.value = true;
  successStep.value = session.step;
  successNoteId.value = note.id;
  hintedNoteId.value = undefined;
  playNote(note);
  recordSuccess({ targetId, noteId: note.id, label: note.label, octaveLabel: note.octaveLabel });
  if (session.status === "running" && session.step < session.maxSteps) {
    feedbackTimer = window.setTimeout(() => {
      resetFeedback();
      playPromptNote(180);
    }, 760);
  }
}

function restart() {
  resetFeedback();
  noteSequence.value = generateSolfegeSequence();
  startSession();
}

onUnmounted(() => {
  clearFeedbackTimer();
  void audioContext?.close().catch(() => undefined);
});

onMounted(() => {
  playPromptNote(520);
});
</script>

<template>
  <div class="solfege-shell">
    <GameHud
      title="Сольфеджио"
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

    <v-container class="solfege-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="solfege-panel pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="top-controls mb-3">
              <v-btn :aria-label="audioEnabled ? 'Выключить звук' : 'Включить звук'" :icon="audioEnabled ? 'mdi-volume-low' : 'mdi-volume-off'" color="primary" rounded="xl" size="large" variant="tonal" @click="toggleAudio" />
            </div>

            <v-card class="score-card pa-4 pa-md-5 mb-5" color="indigo-lighten-5" rounded="xl" variant="flat">
              <div class="score-staff" aria-label="Прогресс по нотам октавы">
                <div v-for="line in 5" :key="line" class="staff-line" />
                <div class="note-bubbles">
                  <div
                    v-for="note in solfegeNotes"
                    :key="`bubble-${note.id}`"
                    class="note-bubble"
                    :class="{ 'note-bubble--played': isPlayed(note) }"
                    :style="{ '--note-color': note.color }"
                  >
                  </div>
                </div>
              </div>
            </v-card>

            <v-card class="piano-card pa-4 pa-md-5 mb-5" color="blue-grey-lighten-5" rounded="xl" variant="flat">
              <div class="piano-frame" aria-label="Пианино: одна октава">
                <div class="black-keys" aria-hidden="true">
                  <div v-for="key in blackKeyLayout" :key="key.label" class="black-key" :style="{ left: key.left }" />
                </div>
                <div class="white-keyboard">
                  <GameDwellButton
                    v-for="note in choiceNotes"
                    :key="`key-${session.step}-${note.id}`"
                    class="white-key-target"
                    :target-id="noteTargetId(note)"
                    :disabled="session.status !== 'running' || pendingSelection"
                    :dwell-ms="session.settings.dwellMs"
                    min-height="100%"
                    color="surface"
                    @select="chooseNote(note)"
                  >
                    <template #default="{ active }">
                      <div
                        class="white-key"
                        :class="{ 'white-key--played': isPlayed(note), 'white-key--success': successNoteId === note.id, 'white-key--hint': hintedNoteId === note.id, 'white-key--wrong': wrongNoteId === note.id, 'white-key--active': active }"
                        :style="{ '--note-color': note.color }"
                      >
                        <span aria-hidden="true" />
                      </div>
                    </template>
                  </GameDwellButton>
                </div>
              </div>
            </v-card>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Сольфеджио"
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
.solfege-shell {
  background: radial-gradient(circle at 15% 8%, rgb(255 224 178 / 55%), transparent 34%), linear-gradient(135deg, #fff8e7 0%, #edf7ff 52%, #f5ecff 100%);
  min-block-size: 100vh;
}

.solfege-container {
  min-block-size: 100vh;
  padding-block-start: 128px;
}

.solfege-panel {
  background: rgb(255 252 245 / 94%);
  overflow: hidden;
}

.score-card,
.piano-card {
  border: 2px solid rgb(var(--v-theme-primary) / 12%);
}

.top-controls {
  display: flex;
  justify-content: flex-end;
}

.score-staff {
  block-size: 104px;
  position: relative;
}

.staff-line {
  background: rgb(69 82 80 / 18%);
  block-size: 2px;
  inline-size: 100%;
  inset-inline: 0;
  position: absolute;
}

.staff-line:nth-child(1) { inset-block-start: 18%; }
.staff-line:nth-child(2) { inset-block-start: 34%; }
.staff-line:nth-child(3) { inset-block-start: 50%; }
.staff-line:nth-child(4) { inset-block-start: 66%; }
.staff-line:nth-child(5) { inset-block-start: 82%; }

.note-bubbles {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  inset: 0;
  position: absolute;
}

.note-bubble {
  align-items: center;
  background: rgb(255 255 255 / 82%);
  border: 2px solid color-mix(in srgb, var(--note-color) 34%, white);
  border-radius: 999px;
  color: #40524f;
  display: flex;
  font-weight: 800;
  inline-size: 100%;
  justify-content: center;
  min-block-size: 54px;
  opacity: 0.46;
}

.note-bubble--played {
  background: color-mix(in srgb, var(--note-color) 54%, white);
  opacity: 1;
}

.piano-frame {
  background: linear-gradient(180deg, #4b5563 0%, #1f2937 100%);
  border-radius: 28px;
  box-shadow: inset 0 -12px 0 rgb(0 0 0 / 16%), 0 22px 38px rgb(31 41 55 / 18%);
  padding: 24px 20px 18px;
  position: relative;
}

.white-keyboard {
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  min-block-size: 210px;
  position: relative;
  z-index: 1;
}

.white-key-target {
  min-inline-size: 0;
}

.white-key-target :deep(.dwell-button) {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

.white-key-target :deep(.dwell-progress) {
  --dwell-size: min(92px, 72%) !important;
}

.white-key {
  align-items: center;
  background: linear-gradient(180deg, #fff 0%, #f7f4ea 100%);
  border: 2px solid rgb(64 82 79 / 12%);
  border-radius: 0 0 18px 18px;
  box-shadow: inset 0 -12px 0 rgb(31 41 55 / 6%);
  color: #40524f;
  display: flex;
  flex-direction: column;
  font-weight: 900;
  justify-content: flex-end;
  min-inline-size: 0;
  padding-block-end: 18px;
  transition: background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  min-block-size: 100%;
}

.white-key span {
  font-size: clamp(1.1rem, 2vw, 2rem);
}

.white-key small {
  color: #667775;
  font-weight: 700;
}

.white-key--played,
.white-key--success,
.white-key--hint {
  background: linear-gradient(180deg, color-mix(in srgb, var(--note-color) 48%, white) 0%, #fffaf0 100%);
}

.white-key--hint,
.white-key--active {
  box-shadow: inset 0 -12px 0 rgb(31 41 55 / 6%), 0 0 0 6px color-mix(in srgb, var(--note-color) 25%, transparent);
  transform: translateY(-4px);
}

.white-key--wrong {
  animation: note-wrong 240ms ease-in-out 2;
}

.black-keys {
  inset-block-start: 24px;
  inset-inline: 20px;
  position: absolute;
  z-index: 2;
}

.black-key {
  background: linear-gradient(180deg, #2f3542 0%, #111827 100%);
  border-radius: 0 0 12px 12px;
  block-size: 116px;
  box-shadow: 0 10px 18px rgb(0 0 0 / 20%);
  inline-size: 7.8%;
  position: absolute;
  transform: translateX(-50%);
}

@keyframes note-wrong {
  0%, 100% { transform: translateX(0); }
  35% { transform: translateX(-0.35rem); }
  70% { transform: translateX(0.35rem); }
}

@media (max-width: 960px) {
  .solfege-container {
    padding-block-start: 116px;
  }

  .score-card {
    margin-block-end: 1rem !important;
  }
}

@media (max-height: 920px) {
  .score-card {
    display: none !important;
  }

  .piano-card {
    margin-block-end: 1rem !important;
  }
}

@media (max-height: 760px) {
  .solfege-container {
    align-items: flex-start !important;
    min-block-size: auto;
    padding-block-start: 4.75rem;
  }

  .solfege-panel {
    padding: 1rem !important;
  }

  .score-card {
    display: none !important;
  }

  .piano-card {
    margin-block-end: 0.85rem !important;
    padding: 1rem !important;
  }

  .piano-frame {
    padding: 16px 12px 12px;
  }

  .white-keyboard {
    min-block-size: 130px;
  }

  .black-keys {
    inset-block-start: 16px;
    inset-inline: 12px;
  }

  .black-key {
    block-size: 72px;
  }

}

@media (max-width: 600px) {
  .note-bubbles {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .score-staff {
    block-size: 150px;
  }
}
</style>
