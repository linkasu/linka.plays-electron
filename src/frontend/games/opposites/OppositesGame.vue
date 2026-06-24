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
import { generateOppositesRound, type OppositeConcept, type OppositesRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("opposites", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 125, sound: true },
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "opposites",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["opposites.prompt.hot", "opposites.prompt.big", "opposites.prompt.day"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRounds } = useRoundGame<OppositesRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateOppositesRound(session.settings, roundIndex)
});

const feedbackMessage = ref("Выбери слово с противоположным значением.");
const pendingSelection = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const hintedChoiceId = ref<string>();
let feedbackTimer = 0;

function choiceTargetId(choice: OppositeConcept) {
  return `opposites:choice:${choice.id}`;
}

function promptAssetId() {
  return `opposites.prompt.${round.value.source.id}`;
}

function correctAssetId() {
  return `opposites.correct.${round.value.source.id}.${round.value.target.id}`;
}

function mistakeAssetId() {
  return `opposites.mistake.${round.value.source.id}.${round.value.target.id}`;
}

async function playRoundPrompt(delayMs = 0) {
  pendingSelection.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  pendingSelection.value = false;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  feedbackMessage.value = "Выбери слово с противоположным значением.";
  pendingSelection.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
  hintedChoiceId.value = undefined;
}

async function choose(index: number) {
  if (session.status !== "running" || pendingSelection.value) return;

  const choice = round.value.choices[index];
  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.target);

  clearFeedbackTimer();

  if (index === round.value.correctIndex) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    hintedChoiceId.value = undefined;
    feedbackMessage.value = `Верно. ${round.value.source.label} и ${choice.label} — противоположности.`;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true, pairId: round.value.pairId });
    void pianoFeedback.playSuccess();
    await promptAudio.playSequenceAndWait([correctAssetId()], 80);

    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      resetFeedback();
      await playRoundPrompt(180);
      return;
    }
    pendingSelection.value = false;
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = choice.id;
  hintedChoiceId.value = round.value.target.id;
  feedbackMessage.value = round.value.mistakeHint;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false, pairId: round.value.pairId });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake", pairId: round.value.pairId });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait([mistakeAssetId()], 80);
  pendingSelection.value = false;
  wrongChoiceId.value = undefined;
}

function choiceColor(choice: OppositeConcept) {
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (hintedChoiceId.value === choice.id) return "primary";
  return "surface";
}

function restart() {
  resetFeedback();
  promptAudio.cancelPending();
  restartRounds();
  void playRoundPrompt(220);
}

onMounted(() => {
  promptAudio.warm();
  void playRoundPrompt(420);
});

onUnmounted(() => {
  clearFeedbackTimer();
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="opposites-shell">
    <GameHud title="Противоположности" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC: подбери пару</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">{{ feedbackMessage }}</p>

            <v-sheet class="source-card mx-auto mb-6 pa-5" rounded="xl" :color="`${round.source.tone}-lighten-5`">
              <div class="source-emoji emoji-glyph">{{ round.source.emoji }}</div>
              <div class="text-h5 text-md-h4 font-weight-bold mt-2">{{ round.source.label }}</div>
            </v-sheet>

            <v-row justify="center" dense>
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="6" :sm="round.choices.length === 3 ? 4 : 3" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="choose(index)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                    <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ choice.label }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Противоположности" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.opposites-shell {
  background: linear-gradient(135deg, #fff7ec 0%, #eef8ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.source-card {
  align-items: center;
  border: 0.2rem solid rgb(var(--v-theme-primary) / 18%);
  display: flex;
  flex-direction: column;
  inline-size: min(22rem, 80vw);
  justify-content: center;
  min-block-size: 10rem;
}

.source-emoji {
  font-size: clamp(4.5rem, min(12vw, 14vh), 8rem);
  line-height: 1;
}

.choice-emoji {
  font-size: clamp(3.6rem, min(8vw, 12vh), 6.5rem);
  line-height: 1;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 156px;
  }
}
</style>
