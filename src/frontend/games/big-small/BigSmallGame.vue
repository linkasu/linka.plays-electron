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
import { generateBigSmallRound, type BigSmallChoice, type BigSmallRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("big-small", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 120, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "big-small",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["big-small.mistake", "big-small.complete"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const hint = ref("");
const mistakenChoiceId = ref<string>();
const isSpeaking = ref(false);
const { round, resultVisible, nextRound, restart } = useRoundGame<BigSmallRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateBigSmallRound(session.settings, roundIndex)
});

function choiceTargetId(choice: BigSmallChoice) {
  return `big-small:choice:${choice.choiceId}`;
}

function promptAssetId() {
  return `big-small.prompt.${round.value.object.id}.${round.value.targetSize}`;
}

function correctAssetId() {
  return `big-small.correct.${round.value.object.id}.${round.value.targetSize}`;
}

function mistakeAssetId() {
  return "big-small.mistake";
}

async function playRoundPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isSpeaking.value = false;
}

async function choose(index: number) {
  if (session.status !== "running" || isSpeaking.value) return;

  const choice = round.value.choices[index];
  const targetId = choiceTargetId(choice);
  const expectedChoice = round.value.choices[round.value.correctIndex];
  const expectedTargetId = choiceTargetId(expectedChoice);

  if (index === round.value.correctIndex) {
    isSpeaking.value = true;
    hint.value = "";
    mistakenChoiceId.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, objectId: choice.id, expected: round.value.targetSize, actual: choice.size, isCorrect: true });
    void pianoFeedback.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [correctAssetId(), "big-small.complete"] : [correctAssetId()], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      await playRoundPrompt(180);
      return;
    }
    isSpeaking.value = false;
    return;
  }

  isSpeaking.value = true;
  mistakenChoiceId.value = choice.choiceId;
  hint.value = "Посмотри на размеры ещё раз и выбери другую карточку.";
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, objectId: choice.id, expected: round.value.targetSize, actual: choice.size, isCorrect: false });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait([mistakeAssetId()], 80);
  isSpeaking.value = false;
}

function restartGame() {
  hint.value = "";
  mistakenChoiceId.value = undefined;
  isSpeaking.value = false;
  promptAudio.cancelPending();
  restart();
  void playRoundPrompt(220);
}

onMounted(() => {
  promptAudio.warm();
  void playRoundPrompt(420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="big-small-shell">
    <GameHud title="Большой / маленький" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Размер и слово</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert v-if="hint" class="mb-5 text-body-1 font-weight-bold" color="warning" icon="mdi-lightbulb-outline" rounded="xl" variant="tonal">
              {{ hint }} Посмотри ещё раз.
            </v-alert>
            <v-row class="choice-row" dense>
              <v-col v-for="(choice, index) in round.choices" :key="choice.choiceId" cols="12" sm="6" md="6">
                <GameDwellButton :class="{ 'choice--mistake': mistakenChoiceId === choice.choiceId }" :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="260" color="surface" @select="choose(index)">
                  <template #default>
                    <div class="choice-size-label text-overline mb-3">{{ choice.sizeLabel }}</div>
                    <div :class="['choice-emoji', 'emoji-glyph', `choice-emoji--${choice.size}`]" aria-hidden="true">{{ choice.emoji }}</div>
                    <div class="text-h4 font-weight-bold mt-3">{{ choice.label }}</div>
                    <div class="sr-only">Размер: {{ choice.sizeLabel }}. Объект: {{ choice.label }}.</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Большой / маленький" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.big-small-shell {
  background: linear-gradient(135deg, #fff5e6 0%, #e9f7ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.choice-row {
  row-gap: 1rem;
}

.choice-size-label {
  color: #263238;
}

.choice-emoji {
  line-height: 1;
}

.choice-emoji--big {
  font-size: clamp(6.5rem, min(16vw, 20vh), 11rem);
}

.choice-emoji--small {
  font-size: clamp(3rem, min(8vw, 10vh), 5rem);
}

.choice--mistake :deep(.dwell-button) {
  box-shadow: 0 0 0 0.375rem rgb(var(--v-theme-warning) / 34%);
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

@media (max-width: 37.5rem) {
 .game-container {
    padding-block-start: 9.25rem;
  }
}

@media (max-height: 42rem) {
 .game-container {
    padding-block-start: 5rem;
  }

 .choice-row :deep(.dwell-button) {
    min-block-size: 12.5rem !important;
  }

 .choice-emoji--big {
    font-size: clamp(5.5rem, min(14vw, 17vh), 8rem);
  }
}
</style>
