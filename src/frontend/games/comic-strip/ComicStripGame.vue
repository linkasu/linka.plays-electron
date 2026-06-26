<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";
import { generateComicStripRound, getComicFrameChoices, type ComicFrame } from "./model";

const storyAdvanceMs = 1300;
const storiesPerSession = 2;
const comicFeedback = createStandardGameFeedback();
const storyNotes = [55, 60, 62, 64, 67, 69, 72];
const storyNoteByFrameIndex = [60, 64, 67];
const storyFrequencyByFrameIndex = [261.63, 329.63, 392];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("comic-strip", {
  maxSteps: 6,
  overrides: { sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const storyRoundIndex = ref(1);
const placedFrameIds = ref<string[]>([]);
const lastMistakeFrameId = ref<string>();
const feedbackText = ref("Выбери первый кадр. Ошибки не страшны: подсказка поможет.");
const isAdvancingStory = ref(false);
const isSpeaking = ref(false);
const completedStories = ref(0);
const promptAudio = useGamePromptAudio({ gameId: "comic-strip", soundEnabled: toRef(session.settings, "sound") });
let advanceTimer = 0;

const round = computed(() => generateComicStripRound(storyRoundIndex.value));
const nextFrameIndex = computed(() => placedFrameIds.value.length);
const nextFrame = computed(() => round.value.story.frames[nextFrameIndex.value]);
const placedFrames = computed(() => placedFrameIds.value.map((frameId) => round.value.story.frames.find((frame) => frame.id === frameId)).filter((frame): frame is ComicFrame => Boolean(frame)));
const choices = computed(() => nextFrame.value ? getComicFrameChoices(round.value.story, nextFrameIndex.value, storyRoundIndex.value) : []);
const hintText = computed(() => {
  if (!nextFrame.value) return round.value.story.finalMessage;
  return "Выбери, какой кадр должен быть следующим в истории.";
});

function frameTargetId(frame: ComicFrame) {
  return `comic-strip:${round.value.roundId}:frame:${frame.id}`;
}

function frameBySlot(slotIndex: number) {
  return placedFrames.value[slotIndex];
}

function clearAdvanceTimer() {
  window.clearTimeout(advanceTimer);
  advanceTimer = 0;
}

function startNextStory() {
  storyRoundIndex.value += 1;
  placedFrameIds.value = [];
  lastMistakeFrameId.value = undefined;
  isAdvancingStory.value = false;
  isSpeaking.value = false;
  feedbackText.value = "Начинается новая история. Выбери первый кадр.";
  promptAudio.play("comic-strip.prompt", 300);
}

function playFrameNote(frameIndex: number) {
  const safeIndex = Math.max(0, Math.min(storyNoteByFrameIndex.length - 1, frameIndex));
  void playSoftPianoMelody(session.settings.sound, {
    notesToLoad: storyNotes,
    sampled: [{ note: storyNoteByFrameIndex[safeIndex], at: 0, duration: 0.48, velocity: 30 }],
    fallback: [{ frequency: storyFrequencyByFrameIndex[safeIndex], at: 0, duration: 0.44, peak: 0.034 }],
    lengthSeconds: 0.52
  });
}

async function chooseFrame(frame: ComicFrame) {
  if (session.status !== "running" || isAdvancingStory.value || isSpeaking.value || !nextFrame.value) return;

  const expectedFrame = nextFrame.value;
  const targetId = frameTargetId(frame);
  const expectedTargetId = frameTargetId(expectedFrame);
  if (frame.id === expectedFrame.id) {
    const completedFrameIndex = nextFrameIndex.value;
    isAdvancingStory.value = true;
    placedFrameIds.value = [...placedFrameIds.value, frame.id];
    lastMistakeFrameId.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: frame.id, expected: expectedFrame.caption, actual: frame.caption, isCorrect: true });
    playFrameNote(completedFrameIndex);
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(["comic-strip.correct"], 80);
    isSpeaking.value = false;

    if (placedFrameIds.value.length >= round.value.story.frames.length) {
      feedbackText.value = round.value.story.finalMessage;
      void comicFeedback.playSuccess(session.settings.sound);
      completedStories.value += 1;
      if (completedStories.value >= storiesPerSession) {
        await promptAudio.playSequenceAndWait(["comic-strip.complete"], 100);
        finishSession("max-steps");
      } else {
        clearAdvanceTimer();
        advanceTimer = window.setTimeout(startNextStory, storyAdvanceMs);
      }
      return;
    }

    feedbackText.value = "Верно. Теперь выбери следующий кадр.";
    isAdvancingStory.value = false;
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: frame.id, expected: expectedFrame.caption, actual: frame.caption, isCorrect: false });
  isAdvancingStory.value = true;
  lastMistakeFrameId.value = frame.id;
  feedbackText.value = "Посмотри на историю и попробуй выбрать другой кадр.";
  void comicFeedback.playMistake(session.settings.sound);
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["comic-strip.mistake"], 80);
  isSpeaking.value = false;
  advanceTimer = window.setTimeout(() => {
    isAdvancingStory.value = false;
    lastMistakeFrameId.value = undefined;
  }, 700);
}

function restart() {
  clearAdvanceTimer();
  promptAudio.cancelPending();
  storyRoundIndex.value = 1;
  completedStories.value = 0;
  placedFrameIds.value = [];
  lastMistakeFrameId.value = undefined;
  isAdvancingStory.value = false;
  isSpeaking.value = false;
  feedbackText.value = "Выбери первый кадр. Ошибки не страшны: подсказка поможет.";
  startSession();
  promptAudio.play("comic-strip.prompt", 450);
}

onMounted(() => {
  promptAudio.warm();
  warmSoftPiano(session.settings.sound, storyNotes);
  comicFeedback.warm(session.settings.sound);
  promptAudio.play("comic-strip.prompt", 450);
});

onUnmounted(() => {
  clearAdvanceTimer();
  promptAudio.cancelPending();
  comicFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #fff7e8 0%, #eef8ff 48%, #f6f0ff 100%)" padding-top="5rem">
    <template #hud>
      <GameHud title="Комикс" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="comic-strip-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="comic-card pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="comic-overline text-overline text-secondary text-center mb-2">Последовательность</div>
            <h1 class="comic-title text-h3 text-md-h2 font-weight-bold text-center mb-2">Комикс</h1>
            <p class="comic-prompt text-h6 text-md-h5 text-medium-emphasis text-center mb-2">{{ round.story.prompt }}</p>
            <p class="comic-feedback text-body-1 text-md-h6 text-center mb-5">{{ feedbackText }}</p>

            <v-row class="mb-5" dense justify="center">
              <v-col v-for="slotIndex in 3" :key="slotIndex" cols="4" md="4">
                <v-card class="comic-slot pa-4" :color="frameBySlot(slotIndex - 1)?.color ?? 'grey-lighten-4'" rounded="xl" variant="flat">
                  <div v-if="frameBySlot(slotIndex - 1)" class="text-center">
                    <v-avatar class="mb-3" color="white" size="5.5rem">
                      <v-icon :icon="frameBySlot(slotIndex - 1)?.icon" color="primary" size="3.5rem" />
                    </v-avatar>
                    <div class="text-h6 text-md-h5 font-weight-bold">{{ frameBySlot(slotIndex - 1)?.caption }}</div>
                    <v-chip class="mt-3" color="white" rounded="pill" variant="elevated">Кадр {{ slotIndex }}</v-chip>
                  </div>
                  <div v-else class="empty-slot text-center text-medium-emphasis">
                    <v-icon icon="mdi-image-outline" size="4rem" />
                    <div class="text-h6 font-weight-bold mt-2">Кадр {{ slotIndex }}</div>
                    <div class="text-body-1">ждёт выбора</div>
                  </div>
                </v-card>
              </v-col>
            </v-row>

            <v-card class="comic-hint-card pa-4 pa-md-5 mb-5" color="blue-lighten-5" rounded="xl" variant="flat">
              <div class="d-flex flex-column flex-md-row align-center justify-space-between ga-3">
                <div>
                  <div class="text-caption text-medium-emphasis">Следующий шаг</div>
                  <div class="text-h6 text-md-h5 font-weight-bold">{{ hintText }}</div>
                </div>
                <v-chip color="primary" prepend-icon="mdi-filmstrip-box-multiple" rounded="pill" size="large" variant="elevated">
                  {{ placedFrameIds.length }} / 3 кадра
                </v-chip>
              </div>
            </v-card>

            <v-row dense justify="center">
              <v-col v-for="frame in choices" :key="frame.id" cols="4" sm="4">
                <GameDwellButton class="comic-choice" :target-id="frameTargetId(frame)" :disabled="session.status !== 'running' || isAdvancingStory || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="8rem" color="surface" @select="chooseFrame(frame)">
                  <template #default>
                    <div :class="['choice-frame', { 'choice-frame--mistake': lastMistakeFrameId === frame.id }]">
                      <v-icon :icon="frame.icon" size="4rem" />
                      <div class="choice-frame__caption text-body-1 text-md-h6 font-weight-bold mt-3">{{ frame.caption }}</div>
                      <div class="choice-frame__note text-body-2 font-weight-medium mt-1">выбрать кадр</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="session.status === 'finished'" title="Комикс" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.comic-slot {
  align-items: center;
  border: 0.125rem solid rgb(var(--v-theme-primary) / 12%);
  display: flex;
  justify-content: center;
  min-block-size: clamp(12rem, 28vh, 18rem);
}

.empty-slot {
  opacity: 0.72;
}

.choice-frame {
  transition: transform 180ms ease;
}

.choice-frame__caption {
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.choice-frame__note {
  color: rgb(var(--v-theme-on-surface));
}

.choice-frame--mistake {
  transform: scale(0.96);
}

@media (max-height: 44rem) {
  .comic-card {
    padding-block: 1.25rem !important;
  }

  .comic-overline {
    display: none;
  }

  .comic-title {
    font-size: clamp(2.1rem, 6vh, 2.9rem) !important;
    line-height: 1 !important;
    margin-block-end: 0.5rem !important;
  }

  .comic-prompt,
  .comic-feedback {
    margin-block-end: 0.35rem !important;
  }

  .comic-hint-card {
    display: none;
  }

  .comic-slot {
    min-block-size: 9.5rem;
  }

  .comic-choice :deep(.dwell-button) {
    padding-block: 1rem !important;
  }

  .choice-frame__note {
    display: none;
  }
}

@media (max-height: 57.5rem) {
  .comic-slot {
    min-block-size: 5.25rem;
    padding-block: 0.75rem !important;
  }

  .comic-slot .v-avatar,
  .comic-slot .text-body-1,
  .comic-slot .text-h6,
  .comic-slot .text-md-h5 {
    display: none;
  }
}
</style>
