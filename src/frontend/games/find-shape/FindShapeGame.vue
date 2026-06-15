<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateFindShapeRound, type FindShapeId, type FindShapeOption, type FindShapeRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("find-shape", {
  maxSteps: 8,
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<FindShapeRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindShapeRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<FindShapeId>();
const feedbackText = ref("Слушай задание и выбери такую же форму.");
const advancing = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "find-shape", soundEnabled: toRef(session.settings, "sound") });
let advanceTimer = 0;

const shapeView: Record<FindShapeId, { title: string; color: string }> = {
  circle: { title: "Круг", color: "#0f766e" },
  square: { title: "Квадрат", color: "#2563eb" },
  triangle: { title: "Треугольник", color: "#d97706" },
  star: { title: "Звезда", color: "#a855f7" },
  heart: { title: "Сердце", color: "#db2777" },
  diamond: { title: "Ромб", color: "#0891b2" }
};

const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return feedbackText.value;
  return `Почти. Нужна форма: ${round.value.target.label}. Посмотри на мягкую подсветку.`;
});

function clearTtsTimers() {
  window.clearTimeout(advanceTimer);
  promptAudio.cancelPending();
  advanceTimer = 0;
}

function playTargetPrompt(delayMs = 0) {
  promptAudio.play(`find-shape.prompt.${round.value.target.id}`, delayMs);
}

function playResponse(id: string, delayMs = 0) {
  promptAudio.play(id, delayMs);
}

function choiceTargetId(choiceId: FindShapeId) {
  return `find-shape:choice:${choiceId}`;
}

function prepareNextRound() {
  advancing.value = true;
  advanceTimer = window.setTimeout(() => {
    advancing.value = false;
    feedbackText.value = "Слушай задание и выбери такую же форму.";
    if (session.status === "running") {
      nextRound();
      playTargetPrompt(350);
    }
  }, 2400);
}

function choose(choice: FindShapeOption) {
  if (session.status !== "running" || advancing.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.id, actual: choice.id, isCorrect: true });
    feedbackText.value = `Да, это ${choice.label}.`;
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    playResponse("find-shape.correct");
    if (session.step < session.maxSteps) prepareNextRound();
    return;
  }

  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  feedbackText.value = `Это ${choice.label}. Нужна форма: ${round.value.target.label}.`;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.id, actual: choice.id, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-shape-selected" });
  playResponse("find-shape.mistake");
  playTargetPrompt(2400);
}

function restart() {
  clearTtsTimers();
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  advancing.value = false;
  feedbackText.value = "Слушай задание и выбери такую же форму.";
  restartRoundGame();
  playTargetPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  playTargetPrompt(450);
});

onUnmounted(() => {
  clearTtsTimers();
});
</script>

<template>
  <GamePageShell gradient="violet">
    <template #hud>
      <GameHud title="Найди форму" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-shape-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Спокойный выбор формы</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5" role="status">{{ hintText }}</p>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running' || advancing" :dwell-ms="session.settings.dwellMs" :min-height="round.choices.length >= 5 ? 210 : 235" :highlight-choice="(choice) => hintedRoundId === round.roundId && choice.id === round.target.id" @select="choose">
              <template #default="{ choice }">
                <div :class="['shape-choice', { 'shape-choice--mistake': choice.id === lastMistakeId }]">
                  <svg class="shape-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                    <circle v-if="choice.id === 'circle'" cx="60" cy="60" r="42" :fill="shapeView[choice.id].color" />
                    <rect v-else-if="choice.id === 'square'" x="22" y="22" width="76" height="76" rx="10" :fill="shapeView[choice.id].color" />
                    <polygon v-else-if="choice.id === 'triangle'" points="60,16 104,98 16,98" :fill="shapeView[choice.id].color" />
                    <polygon v-else-if="choice.id === 'star'" points="60,12 74,43 108,46 82,68 90,102 60,84 30,102 38,68 12,46 46,43" :fill="shapeView[choice.id].color" />
                    <path v-else-if="choice.id === 'heart'" d="M60 101 C25 72 14 55 18 36 C22 18 45 15 60 33 C75 15 98 18 102 36 C106 55 95 72 60 101 Z" :fill="shapeView[choice.id].color" />
                    <polygon v-else points="60,10 104,60 60,110 16,60" :fill="shapeView[choice.id].color" />
                  </svg>
                </div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди форму" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.find-shape-card {
  overflow: hidden;
}

.shape-choice {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: filter 160ms ease, transform 160ms ease;
}

.shape-choice--mistake {
  filter: saturate(0.7) opacity(0.72);
  transform: scale(0.97);
}

.shape-svg {
  block-size: clamp(5.5rem, min(14vw, 19vh), 8.75rem);
  filter: drop-shadow(0 0.4rem 0.45rem rgb(15 23 42 / 16%));
  inline-size: clamp(5.5rem, min(14vw, 19vh), 8.75rem);
}

</style>
