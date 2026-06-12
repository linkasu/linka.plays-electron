<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateComicStripRound, getComicFrameChoices, type ComicFrame } from "./model";

const storyAdvanceMs = 1300;

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("comic-strip", {
  maxSteps: 6,
  dwellMs: 1300,
  sessionSeconds: 140
}, {
  finishOnMistakes: false
});

const storyRoundIndex = ref(1);
const placedFrameIds = ref<string[]>([]);
const hintedFrameId = ref<string>();
const lastMistakeFrameId = ref<string>();
const feedbackText = ref("Выбери первый кадр. Ошибки не страшны: подсказка поможет.");
const isAdvancingStory = ref(false);
let advanceTimer = 0;

const round = computed(() => generateComicStripRound(storyRoundIndex.value));
const nextFrameIndex = computed(() => placedFrameIds.value.length);
const nextFrame = computed(() => round.value.story.frames[nextFrameIndex.value]);
const placedFrames = computed(() => placedFrameIds.value.map((frameId) => round.value.story.frames.find((frame) => frame.id === frameId)).filter((frame): frame is ComicFrame => Boolean(frame)));
const choices = computed(() => nextFrame.value ? getComicFrameChoices(round.value.story, nextFrameIndex.value, storyRoundIndex.value) : []);
const hintText = computed(() => {
  if (!nextFrame.value) return round.value.story.finalMessage;
  if (hintedFrameId.value === nextFrame.value.id) return `Подсказка: ${nextFrame.value.hint}. Посмотри на подсвеченный кадр.`;
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
  hintedFrameId.value = undefined;
  lastMistakeFrameId.value = undefined;
  isAdvancingStory.value = false;
  feedbackText.value = "Начинается новая история. Выбери первый кадр.";
}

function chooseFrame(frame: ComicFrame) {
  if (session.status !== "running" || isAdvancingStory.value || !nextFrame.value) return;

  const targetId = frameTargetId(frame);
  const expectedTargetId = frameTargetId(nextFrame.value);
  if (frame.id === nextFrame.value.id) {
    placedFrameIds.value = [...placedFrameIds.value, frame.id];
    hintedFrameId.value = undefined;
    lastMistakeFrameId.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: frame.id, expected: nextFrame.value.caption, actual: frame.caption, isCorrect: true });

    if (placedFrameIds.value.length >= round.value.story.frames.length) {
      feedbackText.value = round.value.story.finalMessage;
      if (session.status === "running" && session.step < session.maxSteps) {
        isAdvancingStory.value = true;
        clearAdvanceTimer();
        advanceTimer = window.setTimeout(startNextStory, storyAdvanceMs);
      }
      return;
    }

    feedbackText.value = "Верно. Теперь выбери следующий кадр.";
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: frame.id, expected: nextFrame.value.caption, actual: frame.caption, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-comic-frame" });
  hintedFrameId.value = nextFrame.value.id;
  lastMistakeFrameId.value = frame.id;
  feedbackText.value = "Почти. Попробуй ещё раз: нужный кадр мягко подсвечен.";
}

function restart() {
  clearAdvanceTimer();
  storyRoundIndex.value = 1;
  placedFrameIds.value = [];
  hintedFrameId.value = undefined;
  lastMistakeFrameId.value = undefined;
  isAdvancingStory.value = false;
  feedbackText.value = "Выбери первый кадр. Ошибки не страшны: подсказка поможет.";
  startSession();
}

onUnmounted(clearAdvanceTimer);
</script>

<template>
  <div class="comic-strip-shell">
    <GameHud title="Комикс" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="comic-strip-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Последовательность</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">Комикс</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-2">{{ round.story.prompt }}</p>
            <p class="text-body-1 text-md-h6 text-center mb-5">{{ feedbackText }}</p>

            <v-row class="mb-5" dense justify="center">
              <v-col v-for="slotIndex in 3" :key="slotIndex" cols="12" md="4">
                <v-card class="comic-slot pa-4" :color="frameBySlot(slotIndex - 1)?.color ?? 'grey-lighten-4'" rounded="xl" variant="flat">
                  <div v-if="frameBySlot(slotIndex - 1)" class="text-center">
                    <v-avatar class="mb-3" color="white" size="88">
                      <v-icon :icon="frameBySlot(slotIndex - 1)?.icon" color="primary" size="56" />
                    </v-avatar>
                    <div class="text-h6 text-md-h5 font-weight-bold">{{ frameBySlot(slotIndex - 1)?.caption }}</div>
                    <v-chip class="mt-3" color="white" rounded="pill" variant="elevated">Кадр {{ slotIndex }}</v-chip>
                  </div>
                  <div v-else class="empty-slot text-center text-medium-emphasis">
                    <v-icon icon="mdi-image-outline" size="64" />
                    <div class="text-h6 font-weight-bold mt-2">Кадр {{ slotIndex }}</div>
                    <div class="text-body-1">ждёт выбора</div>
                  </div>
                </v-card>
              </v-col>
            </v-row>

            <v-card class="pa-4 pa-md-5 mb-5" color="blue-lighten-5" rounded="xl" variant="flat">
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
              <v-col v-for="frame in choices" :key="frame.id" cols="12" md="4">
                <GameDwellButton :target-id="frameTargetId(frame)" :disabled="session.status !== 'running' || isAdvancingStory" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="hintedFrameId === frame.id ? 'primary' : frame.color" @select="chooseFrame(frame)">
                  <template #default>
                    <div :class="['choice-frame', { 'choice-frame--mistake': lastMistakeFrameId === frame.id }]">
                      <v-icon :icon="frame.icon" size="64" />
                      <div class="text-h5 font-weight-bold mt-3">{{ frame.caption }}</div>
                      <div class="text-body-1 text-medium-emphasis mt-1">выбрать кадр</div>
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
  </div>
</template>

<style scoped>
.comic-strip-shell {
  background: linear-gradient(135deg, #fff7e8 0%, #eef8ff 48%, #f6f0ff 100%);
  min-block-size: 100vh;
}

.comic-strip-container {
  padding-block-start: 8.75rem;
}

.comic-slot {
  align-items: center;
  border: 2px solid rgb(var(--v-theme-primary) / 12%);
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

.choice-frame--mistake {
  transform: scale(0.96);
}

@media (max-height: 44rem) {
  .comic-strip-container {
    padding-block-start: 7.5rem;
  }

  .comic-slot {
    min-block-size: 9.5rem;
  }
}

@media (max-height: 920px) {
  .comic-strip-container {
    padding-block-start: 7.25rem;
  }

  .comic-slot {
    display: none;
  }
}
</style>
