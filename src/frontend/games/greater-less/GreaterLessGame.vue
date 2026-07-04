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
import { generateGreaterLessRound, type GreaterLessSide } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("greater-less", {
  maxSteps: 8,
  overrides: { dwellMs: 1200, sessionSeconds: 120, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "greater-less", soundEnabled, warmAssetIds: ["greater-less.prompt", "greater-less.correct", "greater-less.mistake", "greater-less.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const hint = ref("Выбери подходящую группу.");
const isSpeaking = ref(false);
const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateGreaterLessRound(session.settings, roundIndex)
});

function sideTargetId(side: GreaterLessSide) {
  return `greater-less:choice:${side}`;
}

async function choose(side: GreaterLessSide) {
  if (session.status !== "running" || isSpeaking.value) return;
  const targetId = sideTargetId(side);
  const expectedTargetId = sideTargetId(round.value.correctSide);
  const selectedCount = side === "left" ? round.value.left.count : round.value.right.count;
  const expectedCount = round.value.correctSide === "left" ? round.value.left.count : round.value.right.count;

  if (side === round.value.correctSide) {
    hint.value = "Верно.";
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expectedSide: round.value.correctSide, selectedSide: side, expected: expectedCount, actual: selectedCount, isCorrect: true });
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["greater-less.correct", "greater-less.complete"] : ["greater-less.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.step < session.maxSteps) nextRound();
    hint.value = "Выбери подходящую группу.";
    promptAudio.play("greater-less.prompt", 180);
    isSpeaking.value = false;
    return;
  }

  hint.value = "Посмотри на группы ещё раз и выбери другую сторону.";
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, expectedSide: round.value.correctSide, selectedSide: side, expected: expectedCount, actual: selectedCount, isCorrect: false });
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["greater-less.mistake"], 80);
  isSpeaking.value = false;
}

function restartGame() {
  promptAudio.cancelPending();
  hint.value = "Выбери подходящую группу.";
  isSpeaking.value = false;
  restart();
  promptAudio.play("greater-less.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("greater-less.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="greater-less-shell">
    <GameHud title="Больше / меньше" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Сравни группы</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-4 text-body-1 font-weight-bold" color="primary" icon="mdi-lightbulb-outline" rounded="xl" variant="tonal">
              {{ hint }}
            </v-alert>
            <v-row class="choice-row" dense>
              <v-col v-for="group in [round.left, round.right]" :key="group.side" cols="12" sm="6" md="6">
                <GameDwellButton :target-id="sideTargetId(group.side)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="250" color="surface" @select="choose(group.side)">
                  <template #default>
                    <div class="group-label text-overline mb-3">{{ group.side === "left" ? "Слева" : "Справа" }}</div>
                    <div class="group-items" aria-hidden="true">
                      <span v-for="(item, index) in group.items" :key="index" class="group-emoji emoji-glyph">{{ item }}</span>
                    </div>
                    <div class="sr-only">{{ group.side === "left" ? "Левая" : "Правая" }} группа</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Больше / меньше" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.greater-less-shell {
  background: linear-gradient(135deg, #fff6df 0%, #e8f6ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.choice-row {
  row-gap: 1rem;
}

.group-items {
  align-content: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  justify-content: center;
  margin-inline: auto;
  max-inline-size: 30rem;
  min-block-size: 13rem;
}

.group-label {
  color: #263238;
}

.group-emoji {
  font-size: clamp(3.25rem, min(7vw, 9vh), 5.25rem);
  line-height: 1;
}

.sr-only {
  block-size: 1px;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (min-width: 68.75rem) {
 .game-container {
    padding-block-start: 7.25rem;
  }
}

@media (max-height: 40rem) {
 .game-container {
    padding-block-start: 5rem;
  }

 .choice-row :deep(.dwell-button) {
    min-block-size: 13rem !important;
  }

 .group-items {
    min-block-size: 8rem;
  }
}
</style>
