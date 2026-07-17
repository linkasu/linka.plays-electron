<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateOppositesRound, type OppositeConcept, type OppositesRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("opposites", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 125, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "opposites",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["opposites.prompt.hot", "opposites.prompt.big", "opposites.prompt.day", "opposites.mistake", "opposites.complete"]
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
  return "opposites.mistake";
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
    feedbackMessage.value = `Верно. ${round.value.source.label} и ${choice.label} — противоположности.`;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true, pairId: round.value.pairId });
    void pianoFeedback.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [correctAssetId(), "opposites.complete"] : [correctAssetId()], 80, 170);

    if (finishedAfterSuccess) {
      finishSession("game-complete");
      pendingSelection.value = false;
      return;
    }

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
  feedbackMessage.value = "Посмотри на слово ещё раз и выбери другую карточку.";
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false, pairId: round.value.pairId });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait([mistakeAssetId()], 80);
  pendingSelection.value = false;
  wrongChoiceId.value = undefined;
}

function choiceColor(choice: OppositeConcept) {
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
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
              <div :class="['concept-visual', `concept-visual--${round.source.referenceId}`, `concept-visual--${round.source.visualState}`]" aria-hidden="true">
                <GameWordImage class="concept-object" :word-id="round.source.assetId ?? round.source.referenceId" :word="round.source.label" :emoji="round.source.emoji" decorative />
                <span v-if="round.source.stateMarker" class="state-marker emoji-glyph">{{ round.source.stateMarker }}</span>
              </div>
              <div class="text-h5 text-md-h4 font-weight-bold mt-2">{{ round.source.label }}</div>
            </v-sheet>

            <v-row justify="center" dense>
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="6" :sm="round.choices.length === 3 ? 4 : 3" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="choose(index)">
                  <template #default>
                    <div :class="['concept-visual', `concept-visual--${choice.referenceId}`, `concept-visual--${choice.visualState}`]" aria-hidden="true">
                      <GameWordImage class="concept-object" :word-id="choice.assetId ?? choice.referenceId" :word="choice.label" :emoji="choice.emoji" decorative />
                      <span v-if="choice.stateMarker" class="state-marker emoji-glyph">{{ choice.stateMarker }}</span>
                    </div>
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
  padding-block-start: 8.25rem;
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

.concept-visual {
  align-items: center;
  border-radius: 1.5rem;
  display: flex;
  inline-size: min(9rem, 100%);
  justify-content: center;
  min-block-size: 7rem;
  position: relative;
}

.concept-object {
  font-size: clamp(3.6rem, min(8vw, 12vh), 6.5rem);
  line-height: 1;
  transform-origin: center;
  transition: filter 160ms ease, transform 160ms ease;
}

.source-card .concept-object {
  font-size: clamp(4.5rem, min(12vw, 14vh), 8rem);
}

.state-marker {
  background: rgb(255 255 255 / 88%);
  border-radius: 999rem;
  font-size: clamp(1.4rem, 4vh, 2.3rem);
  inset-block-end: 0;
  inset-inline-end: 0;
  line-height: 1;
  padding: 0.2rem;
  position: absolute;
}

.concept-visual--big .concept-object {
  transform: scale(1.18);
}

.concept-visual--small .concept-object {
  transform: scale(0.62);
}

.concept-visual--cold .concept-object,
.concept-visual--night .concept-object,
.concept-visual--sad .concept-object {
  filter: saturate(0.72) hue-rotate(18deg);
}

.concept-visual--night {
  background: rgb(var(--v-theme-primary) / 12%);
}

.concept-visual--open .concept-object {
  transform: perspective(12rem) rotateY(-48deg) scaleX(0.82);
  transform-origin: left center;
}

.concept-visual--down .concept-object {
  transform: rotate(180deg);
}

.concept-visual--slow .concept-object {
  transform: translateX(-0.45rem) scale(0.88);
}

.concept-visual--empty .concept-object {
  filter: saturate(0.45);
}

@media (max-width: 37.5rem) {
 .game-container {
    padding-block-start: 9.75rem;
  }
}

@media (max-height: 42rem) {
 .game-container {
    padding-block-start: 9.25rem;
  }

 .game-container :deep(.v-card) {
    padding: 1rem !important;
  }

 .game-container :deep(.v-card >.text-overline) {
    display: none;
  }

 .game-container h1 {
    font-size: clamp(1.8rem, 5vh, 2.25rem) !important;
    line-height: 1.05;
    margin-block-end: 0.45rem !important;
  }

 .game-container p {
    margin-block-end: 0.75rem !important;
  }

 .source-card {
    flex-direction: row;
    gap: 0.75rem;
    inline-size: min(18rem, 64vw);
    margin-block-end: 0.75rem !important;
    min-block-size: 4.75rem;
    padding: 0.75rem !important;
  }

  .source-card .concept-object {
    font-size: clamp(2.5rem, 8vh, 3.75rem);
  }

  .concept-object {
    font-size: clamp(2.5rem, 8vh, 3.75rem);
  }

  .concept-visual {
    min-block-size: 4rem;
  }

 .game-container :deep(.dwell-button) {
    min-block-size: 8.5rem !important;
  }
}
</style>
