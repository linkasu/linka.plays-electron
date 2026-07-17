<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GazePointerOverlay from "../../components/game/GazePointerOverlay.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { solfegeChoiceNotes, solfegeGuidedProgress, solfegeGuidedStages, solfegeGuidedStageStart, solfegeMaxSteps, solfegeSelectionOutcome, type SolfegeMode, type SolfegeNote } from "./model";

type SolfegePhase = "selecting" | "demonstrating" | "repeating" | "free";

const blackKeyLayout = [
  { left: "10.6%", label: "до-диез" },
  { left: "23.1%", label: "ре-диез" },
  { left: "48.2%", label: "фа-диез" },
  { left: "60.7%", label: "соль-диез" },
  { left: "73.2%", label: "ля-диез" }
];

const router = useRouter();
const audioEnabled = ref(true);
const notePeakGain = 0.16;
const mode = ref<SolfegeMode>("guided");
const phase = ref<SolfegePhase>("selecting");
const activeStageIndex = ref(0);
const demonstrationNoteId = ref<string>();
const pendingSelection = ref(false);
const successNoteId = ref<string>();
const wrongNoteId = ref<string>();
const demoTimers = new Set<number>();
let feedbackTimer = 0;
let audioContext: AudioContext | undefined;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("solfege", {
  maxSteps: solfegeMaxSteps,
  overrides: { preset: "gentle", targetScale: 1.55, motionSpeed: 0.42, distractors: "none", hints: "high", dwellMs: 1300, sessionSeconds: 135 },
  finishOnMistakes: false,
  finishOnTimeout: false
});
pauseSession();

const resultVisible = computed(() => session.status === "finished");
const hasStarted = computed(() => phase.value !== "selecting");
const choiceNotes = solfegeChoiceNotes();
const currentStage = computed(() => solfegeGuidedStages[activeStageIndex.value]);
const completedInStage = computed(() => Math.max(0, Math.min(currentStage.value.sequence.length, session.step - solfegeGuidedStageStart(activeStageIndex.value))));
const expectedNote = computed(() => phase.value === "repeating" ? currentStage.value.sequence[completedInStage.value] : undefined);
const instructionTitle = computed(() => {
  if (phase.value === "demonstrating") return "Смотри и слушай";
  if (phase.value === "repeating") return "Повтори мелодию";
  return "Играй свободно";
});
const instructionText = computed(() => {
  if (phase.value === "demonstrating") return `Сейчас прозвучат ${currentStage.value.sequence.length} ноты по порядку.`;
  if (phase.value === "repeating") return "Нажимай подсвечиваемые клавиши по порядку.";
  return "Нажимай любые клавиши. Здесь нет ошибок.";
});

function noteTargetId(note: SolfegeNote) {
  return `solfege:${mode.value}:${session.step}:${note.id}`;
}

function isPlayed(note: SolfegeNote) {
  return currentStage.value.sequence.slice(0, completedInStage.value).some((played) => played.id === note.id);
}

function isSequenceStepComplete(index: number) {
  return index < completedInStage.value;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  pendingSelection.value = false;
  successNoteId.value = undefined;
  wrongNoteId.value = undefined;
}

function clearDemoTimers() {
  for (const timer of demoTimers) window.clearTimeout(timer);
  demoTimers.clear();
  demonstrationNoteId.value = undefined;
}

function scheduleDemo(callback: () => void, delayMs: number) {
  const timer = window.setTimeout(() => {
    demoTimers.delete(timer);
    callback();
  }, delayMs);
  demoTimers.add(timer);
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
  const note = phase.value === "demonstrating"
    ? currentStage.value.sequence.find((candidate) => candidate.id === demonstrationNoteId.value)
    : expectedNote.value;
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
    if (phase.value !== "free") playPromptNote();
  })();
}

function chooseNote(note: SolfegeNote) {
  if (session.status !== "running") return;
  const outcome = solfegeSelectionOutcome(mode.value, note.id, expectedNote.value?.id);

  if (outcome === "free") {
    clearFeedbackTimer();
    successNoteId.value = note.id;
    playNote(note);
    feedbackTimer = window.setTimeout(() => {
      successNoteId.value = undefined;
    }, 420);
    return;
  }

  if (phase.value !== "repeating" || pendingSelection.value) return;
  const expected = expectedNote.value;
  if (!expected) return;

  clearFeedbackTimer();
  const targetId = noteTargetId(note);
  const expectedTargetId = noteTargetId(expected);

  if (outcome === "mistake") {
    pendingSelection.value = true;
    wrongNoteId.value = note.id;
    playNote(note);
    recordMistake({ targetId, expectedTargetId, selectedId: note.id, expectedId: expected.id });
    feedbackTimer = window.setTimeout(() => {
      pendingSelection.value = false;
      wrongNoteId.value = undefined;
    }, 1200);
    return;
  }

  const progress = solfegeGuidedProgress(session.step);
  pendingSelection.value = true;
  successNoteId.value = note.id;
  playNote(note);
  recordSuccess({ targetId, stageId: progress?.stage.id, stageNote: (progress?.noteIndex ?? 0) + 1, noteId: note.id, label: note.label, octaveLabel: note.octaveLabel });

  const nextProgress = solfegeGuidedProgress(session.step);
  if (session.status === "running" && nextProgress) {
    feedbackTimer = window.setTimeout(() => {
      resetFeedback();
      if (nextProgress.stageIndex !== activeStageIndex.value) runDemonstration(nextProgress.stageIndex);
    }, nextProgress.stageIndex === activeStageIndex.value ? 620 : 820);
  }
}

function runDemonstration(stageIndex: number) {
  clearDemoTimers();
  resetFeedback();
  activeStageIndex.value = stageIndex;
  phase.value = "demonstrating";
  const sequence = solfegeGuidedStages[stageIndex].sequence;
  const initialDelay = 320;
  const noteInterval = 820;

  sequence.forEach((note, index) => {
    const noteDelay = initialDelay + index * noteInterval;
    scheduleDemo(() => {
      demonstrationNoteId.value = note.id;
      playNote(note);
    }, noteDelay);
    scheduleDemo(() => {
      if (demonstrationNoteId.value === note.id) demonstrationNoteId.value = undefined;
    }, noteDelay + 560);
  });

  scheduleDemo(() => {
    demonstrationNoteId.value = undefined;
    phase.value = "repeating";
  }, initialDelay + sequence.length * noteInterval);
}

function startGame(nextMode: SolfegeMode) {
  clearDemoTimers();
  resetFeedback();
  mode.value = nextMode;
  activeStageIndex.value = 0;
  startSession();
  void ensureAudio();

  if (nextMode === "free") {
    phase.value = "free";
    return;
  }

  runDemonstration(0);
}

function selectMode() {
  clearDemoTimers();
  resetFeedback();
  pauseSession();
  phase.value = "selecting";
}

function pauseGame() {
  if (session.status !== "running") return;
  clearDemoTimers();
  resetFeedback();
  pauseSession();
}

function resumeGame() {
  if (session.status !== "paused") return;
  const replayDemonstration = phase.value === "demonstrating";
  resumeSession();
  if (mode.value !== "guided") return;

  const progress = solfegeGuidedProgress(session.step);
  if (!progress) return;
  if (replayDemonstration || progress.stageIndex !== activeStageIndex.value) {
    runDemonstration(progress.stageIndex);
  } else {
    phase.value = "repeating";
  }
}

function restart() {
  startGame("guided");
}

onUnmounted(() => {
  clearDemoTimers();
  clearFeedbackTimer();
  void audioContext?.close().catch(() => undefined);
});
</script>

<template>
  <div class="solfege-shell">
    <GameHud
      v-if="hasStarted"
      title="Сольфеджио"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="mode === 'guided' ? session.score : undefined"
      :mistakes="mode === 'guided' ? session.mistakes : undefined"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      :show-progress="false"
      :show-timer="false"
      @pause="pauseGame"
      @resume="resumeGame"
    />
    <GazePointerOverlay v-else />

    <v-container class="solfege-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="solfege-panel pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="top-controls mb-3 ga-2">
              <v-btn v-if="hasStarted" aria-label="Выбрать другой режим" color="secondary" prepend-icon="mdi-swap-horizontal" rounded="xl" size="large" variant="tonal" @click="selectMode">Режим</v-btn>
              <v-btn :aria-label="audioEnabled ? 'Выключить звук' : 'Включить звук'" :icon="audioEnabled ? 'mdi-volume-low' : 'mdi-volume-off'" color="primary" rounded="xl" size="large" variant="tonal" @click="toggleAudio" />
            </div>

            <div v-if="phase === 'selecting'" class="mode-selection text-center">
              <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Выбери режим</h1>
              <p class="text-body-1 text-medium-emphasis mb-6">Сначала можно повторять короткие мелодии или просто познакомиться с пианино.</p>
              <v-row justify="center">
                <v-col cols="12" sm="6">
                  <GameDwellButton target-id="solfege:mode:guided" :dwell-ms="session.settings.dwellMs" min-height="11rem" color="indigo-lighten-5" @select="startGame('guided')">
                    <template #default>
                      <div class="d-flex flex-column align-center justify-center ga-3 pa-4">
                        <v-icon color="indigo-darken-2" icon="mdi-music-note-plus" size="4rem" />
                        <div class="text-h5 font-weight-bold">Повтори мелодию</div>
                        <div class="text-body-2 text-grey-darken-3">Сначала послушай 2 ноты, затем 3 и 4</div>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
                <v-col cols="12" sm="6">
                  <GameDwellButton target-id="solfege:mode:free" :dwell-ms="session.settings.dwellMs" min-height="11rem" color="teal-lighten-5" @select="startGame('free')">
                    <template #default>
                      <div class="d-flex flex-column align-center justify-center ga-3 pa-4">
                        <v-icon color="teal-darken-2" icon="mdi-piano" size="4rem" />
                        <div class="text-h5 font-weight-bold">Свободное пианино</div>
                        <div class="text-body-2 text-grey-darken-3">Играй любые ноты без ошибок и подсказок</div>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>
            </div>

            <template v-else>
              <div class="solfege-instruction text-center mb-3">
                <div v-if="mode === 'guided'" class="text-overline text-secondary">Мелодия {{ activeStageIndex + 1 }} из {{ solfegeGuidedStages.length }} · нот в мелодии: {{ currentStage.sequence.length }}</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold">{{ instructionTitle }}</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">{{ instructionText }}</p>
              </div>

              <v-card v-if="mode === 'guided'" class="score-card pa-4 pa-md-5 mb-5" color="indigo-lighten-5" rounded="xl" variant="flat">
              <div class="score-staff" :aria-label="`Мелодия из ${currentStage.sequence.length} нот`">
                <div v-for="line in 5" :key="line" class="staff-line" />
                <div class="note-bubbles">
                  <div
                    v-for="(note, index) in currentStage.sequence"
                    :key="`bubble-${activeStageIndex}-${index}`"
                    class="note-bubble"
                    :class="{ 'note-bubble--played': isSequenceStepComplete(index), 'note-bubble--current': phase === 'repeating' && index === completedInStage }"
                    :style="{ '--note-color': note.color }"
                  >
                    <span>{{ index + 1 }}</span>
                    <small>{{ note.label }}</small>
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
                    :disabled="session.status !== 'running' || pendingSelection || phase === 'demonstrating'"
                    :dwell-ms="session.settings.dwellMs"
                    min-height="100%"
                    color="surface"
                    @select="chooseNote(note)"
                  >
                    <template #default="{ active }">
                     <div
                        class="white-key"
                        :class="{ 'white-key--played': mode === 'guided' && isPlayed(note), 'white-key--success': successNoteId === note.id, 'white-key--hint': expectedNote?.id === note.id, 'white-key--demo': demonstrationNoteId === note.id, 'white-key--wrong': wrongNoteId === note.id, 'white-key--active': active }"
                        :style="{ '--note-color': note.color }"
                      >
                        <span>{{ note.label }}</span>
                      </div>
                    </template>
                  </GameDwellButton>
                </div>
              </div>
            </v-card>
            </template>
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
  position: relative;
}

.score-card,
.piano-card {
  border: 2px solid rgb(var(--v-theme-primary) / 12%);
}

.top-controls {
  display: flex;
  justify-content: flex-end;
  inset-block-start: 0.5rem;
  inset-inline-end: 0.5rem;
  position: absolute;
  z-index: 2;
}

.mode-selection {
  padding-block: clamp(4rem, 10dvh, 7rem) clamp(1rem, 4dvh, 3rem);
}

.solfege-instruction {
  padding-inline: 4.5rem;
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
  display: flex;
  gap: 0.625rem;
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
  flex: 1 1 0;
  flex-direction: column;
  font-weight: 800;
  inline-size: 100%;
  justify-content: center;
  min-block-size: 54px;
  opacity: 0.46;
}

.note-bubble--current {
  box-shadow: 0 0 0 0.375rem color-mix(in srgb, var(--note-color) 32%, transparent);
  opacity: 1;
}

.note-bubble small {
  font-weight: 700;
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
.white-key--hint,
.white-key--demo {
  background: linear-gradient(180deg, color-mix(in srgb, var(--note-color) 48%, white) 0%, #fffaf0 100%);
}

.white-key--hint,
.white-key--demo,
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
    padding-block-start: 9.5rem;
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

 .solfege-instruction p {
    display: none;
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
 .score-staff {
    block-size: 9.375rem;
  }
}

@media (max-width: 75rem) {
 .black-keys {
    display: none;
  }

 .solfege-panel,
 .piano-card {
    padding: 0.5rem !important;
  }

 .piano-frame {
    border-radius: 1.25rem;
    padding: 0.25rem;
  }

  .white-keyboard {
    gap: 0.125rem;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    min-block-size: clamp(10rem, 32dvh, 18rem);
  }

 .white-key {
    border-radius: 1rem;
    padding-block-end: 0;
  }

 .white-key-target :deep(.dwell-progress) {
    --dwell-size: min(7rem, 70%) !important;
  }
}

@media (max-width: 75rem) and (max-height: 47.5rem) {
 .white-keyboard {
    min-block-size: min(34dvh, 14rem);
  }
}

@media (min-width: 75.001rem) {
 .piano-frame {
    padding-inline: 0.5rem;
  }

 .white-keyboard {
    gap: 0;
  }
}
</style>
