<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateShapesRound, type ShapeId, type ShapeOption, type ShapesRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("shapes", {
  maxSteps: 8,
  overrides: { dwellMs: 1200, sessionSeconds: 120, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "shapes", soundEnabled, warmAssetIds: ["shapes.prompt", "shapes.correct", "shapes.mistake", "shapes.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<ShapesRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateShapesRound(session.settings, roundIndex)
});

const hintText = ref("");
const lastMistakeId = ref<ShapeId>();
const isSpeaking = ref(false);

const shapeView: Record<ShapeId, { color: string; label: string }> = {
  circle: { color: "#0f766e", label: "Круг" },
  square: { color: "#1d4ed8", label: "Квадрат" },
  triangle: { color: "#b45309", label: "Треугольник" },
  star: { color: "#a21caf", label: "Звезда" }
};

function choiceTargetId(choiceId: ShapeId) {
  return `shapes:choice:${choiceId}`;
}

async function choose(choice: ShapeOption, index: number) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);

  if (index === round.value.correctIndex) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.id, actual: choice.id, isCorrect: true });
    hintText.value = "Верно.";
    lastMistakeId.value = undefined;
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["shapes.correct", "shapes.complete"] : ["shapes.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.step < session.maxSteps) nextRound();
    hintText.value = "";
    promptAudio.play("shapes.prompt", 180);
    isSpeaking.value = false;
    return;
  }

  hintText.value = "Посмотри на форму ещё раз и выбери другую карточку.";
  lastMistakeId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.id, actual: choice.id, isCorrect: false });
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["shapes.mistake"], 80);
  isSpeaking.value = false;
}

function restart() {
  promptAudio.cancelPending();
  hintText.value = "";
  lastMistakeId.value = undefined;
  isSpeaking.value = false;
  restartRoundGame();
  promptAudio.play("shapes.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("shapes.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="shapes-shell">
    <GameHud title="Формы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="shapes-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Смотрим на форму</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <v-alert class="hint-alert mb-4" :class="{ 'hint-alert--visible': hintText }" color="primary" variant="tonal" rounded="xl" density="comfortable" role="status">
              {{ hintText || "Выбери подходящую большую карточку." }}
            </v-alert>
            <v-row class="choice-row" justify="center">
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="6" md="3" class="choice-col">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="190" @select="choose(choice, index)">
                  <template #default>
                    <div :class="['shape-wrap', { 'shape-wrap--mistake': lastMistakeId === choice.id }]" :aria-label="shapeView[choice.id].label">
                      <svg class="shape-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                        <circle v-if="choice.id === 'circle'" cx="60" cy="60" r="42" :fill="shapeView[choice.id].color" />
                        <rect v-else-if="choice.id === 'square'" x="22" y="22" width="76" height="76" rx="8" :fill="shapeView[choice.id].color" />
                        <polygon v-else-if="choice.id === 'triangle'" points="60,16 104,98 16,98" :fill="shapeView[choice.id].color" />
                        <polygon v-else points="60,12 74,43 108,46 82,68 90,102 60,84 30,102 38,68 12,46 46,43" :fill="shapeView[choice.id].color" />
                      </svg>
                      <div class="text-h5 text-md-h4 font-weight-bold mt-2">{{ shapeView[choice.id].label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Формы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.shapes-shell {
  background: linear-gradient(135deg, #fff7ed 0%, #ecfeff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.shapes-card {
  background: rgb(var(--v-theme-surface));
}

.hint-alert {
  margin-inline: auto;
  max-inline-size: 42rem;
  opacity: 0.72;
  text-align: center;
}

.hint-alert--visible {
  opacity: 1;
}

.choice-row {
  row-gap: 0.5rem;
}

.choice-col {
  min-inline-size: 10rem;
}

.shape-wrap {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.shape-wrap--mistake {
  filter: saturate(0.72) opacity(0.78);
}

.shape-svg {
  block-size: clamp(5.5rem, min(16vw, 22vh), 9.5rem);
  filter: drop-shadow(0 0.35rem 0.4rem rgb(15 23 42 / 18%));
  inline-size: clamp(5.5rem, min(16vw, 22vh), 9.5rem);
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 7.75rem;
  }

  .shape-svg {
    block-size: 5.75rem;
    inline-size: 5.75rem;
  }
}

@media (max-height: 40rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .shapes-card {
    padding: 1rem !important;
  }

  .shapes-card .text-overline,
  .shapes-card .v-alert {
    display: none;
  }

  .shapes-card h1 {
    font-size: 2.55rem !important;
    line-height: 1.05;
    margin-block-end: 0.75rem !important;
  }

  .choice-col {
    flex: 0 0 25% !important;
    max-inline-size: 25% !important;
    min-inline-size: 0;
  }

  .choice-row :deep(.dwell-button) {
    min-block-size: 8.25rem !important;
    padding: 0.45rem !important;
  }

  .shape-svg {
    block-size: 4.75rem;
    inline-size: 4.75rem;
  }

  .shape-wrap .text-h5 {
    font-size: 1.2rem !important;
    line-height: 1.1;
  }
}
</style>
