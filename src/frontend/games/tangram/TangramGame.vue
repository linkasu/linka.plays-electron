<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateTangramRound, type TangramFigure, type TangramPiece, type TangramRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("tangram", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "tangram", soundEnabled, warmAssetIds: ["tangram.prompt", "tangram.correct", "tangram.mistake", "tangram.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const lastMistakeId = ref<string>();
const isSpeaking = ref(false);
let mistakeTimer = 0;

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<TangramRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateTangramRound(session.settings, roundIndex)
});

const feedbackText = computed(() => {
  if (lastMistakeId.value) return "Не совпало. Посмотри на силуэт ещё раз и выбери другую фигуру.";
  return "Посмотри на серый силуэт и выбери такой же рисунок из крупных фигур.";
});

function choiceTargetId(choiceId: string) {
  return `tangram:choice:${choiceId}`;
}

function pieceFill(piece: TangramPiece, silhouette = false) {
  return silhouette ? "currentColor" : piece.color;
}

function clearMistakeMark() {
  lastMistakeId.value = undefined;
}

function scheduleMistakeClear() {
  window.clearTimeout(mistakeTimer);
  mistakeTimer = window.setTimeout(clearMistakeMark, 1600);
}

async function answer(choice: TangramFigure) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      expected: round.value.target.label,
      actual: choice.label,
      category: round.value.target.category,
      isCorrect: true
    });
    clearMistakeMark();
    const finishedAfterSuccess = session.step + 1 >= session.maxSteps;
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["tangram.correct", "tangram.complete"] : ["tangram.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.status === "running" && session.step < session.maxSteps) nextRound();
    isSpeaking.value = false;
    return;
  }

  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId,
    answerId: choice.id,
    expected: round.value.target.label,
    actual: choice.label,
    category: round.value.target.category,
    isCorrect: false
  });
  lastMistakeId.value = choice.id;
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["tangram.mistake"], 80);
  isSpeaking.value = false;
  scheduleMistakeClear();
}

function restart() {
  window.clearTimeout(mistakeTimer);
  mistakeTimer = 0;
  promptAudio.cancelPending();
  lastMistakeId.value = undefined;
  isSpeaking.value = false;
  restartRoundGame();
  promptAudio.play("tangram.prompt", 220);
}

watch(() => round.value.roundId, () => {
  lastMistakeId.value = undefined;
});

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("tangram.prompt", 420);
});

onUnmounted(() => {
  window.clearTimeout(mistakeTimer);
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="tangram-shell">
    <GameHud title="Танграм" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="tangram-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="tangram-card pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Стратегия и зрительный поиск</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ feedbackText }}</p>

            <v-card class="silhouette-card mx-auto mb-5 mb-md-6 pa-4" color="blue-grey-lighten-5" rounded="xl" variant="flat">
              <svg class="tangram-silhouette" viewBox="0 0 100 100" role="img" :aria-label="`Силуэт: ${round.target.category}`">
                <polygon v-for="(piece, index) in round.target.pieces" :key="`silhouette-${round.roundId}-${index}`" :points="piece.points" :fill="pieceFill(piece, true)" />
              </svg>
            </v-card>

            <v-row class="choice-grid" dense justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="6" sm="3" :lg="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :class="[{ 'choice-mistake': lastMistakeId === choice.id }]" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="clamp(7rem, 18vh, 10.625rem)" color="surface" @select="answer(choice)">
                  <template #default>
                    <svg class="choice-figure" viewBox="0 0 100 100" role="img" :aria-label="choice.label">
                      <polygon v-for="(piece, index) in choice.pieces" :key="`${choice.id}-${index}`" :points="piece.points" :fill="pieceFill(piece)" />
                    </svg>
                    <div class="choice-label text-h5 text-md-h4 font-weight-bold mt-3">{{ choice.label }}</div>
                    <div class="choice-category text-body-1 mt-1">{{ choice.category }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="lastMistakeId" class="mt-5 text-h6" color="warning" icon="mdi-emoticon-neutral-outline" rounded="xl" variant="tonal">
                Не страшно: посмотри ещё раз на силуэт и выбери другую фигуру.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Танграм" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.tangram-shell {
  background: linear-gradient(135deg, #eef6ff 0%, #f7f1ff 48%, #fff8e8 100%);
  min-block-size: 100vh;
}

.tangram-container {
  padding-block-start: 8.75rem;
}

.tangram-card {
  overflow: hidden;
}

.silhouette-card {
  align-items: center;
  border: 0.125rem solid rgb(var(--v-theme-primary) / 10%);
  display: flex;
  inline-size: min(22rem, 68vw);
  justify-content: center;
  min-block-size: min(18rem, 32vh);
}

.tangram-silhouette {
  color: rgb(var(--v-theme-on-surface));
  filter: blur(0.015rem);
  inline-size: min(17rem, 54vw);
  opacity: 0.34;
}

.choice-grid {
  row-gap: 0.75rem;
}

.choice-figure {
  block-size: clamp(8rem, min(17vw, 22vh), 12rem);
  filter: drop-shadow(0 0.45rem 0.65rem rgb(22 42 80 / 14%));
  inline-size: min(13rem, 56vw);
  transition: filter 180ms ease, transform 180ms ease;
}

.choice-label,
.choice-category {
  color: #1f2a27 !important;
}

.choice-mistake .choice-figure {
  filter: grayscale(0.36) opacity(0.72);
  transform: scale(0.96);
}

@media (max-height: 44rem) {
  .tangram-container {
    padding-block-start: 7.5rem;
  }

  .silhouette-card {
    min-block-size: 10rem;
  }

  .choice-figure {
    block-size: 5.5rem;
  }

  .choice-label {
    font-size: 1.15rem !important;
  }

  .choice-category {
    display: none;
  }
}

@media (max-height: 57.5rem) {
  .tangram-container {
    padding-block-start: 7.25rem;
  }

  .silhouette-card {
    display: none;
  }
}
</style>
