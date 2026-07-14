<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { logicPairsFeedback } from "./audio";
import { generateLogicPairsRound, type LogicPairCard, type LogicPairsRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("logic-pairs", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<LogicPairsRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateLogicPairsRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "logic-pairs", soundEnabled: toRef(session.settings, "sound") });
let feedbackTimer = 0;

const relationLabel = computed(() => {
  if (round.value.relation === "meaning") return "Смысловая пара";
  if (round.value.relation === "shape") return "Пара по форме";
  return "Пара по числу";
});

const helperText = computed(() => {
  if (hintedRoundId.value === round.value.roundId) return `Почти. ${round.value.explanation} Правильная карточка подсвечена.`;
  return round.value.instruction;
});

function choiceTargetId(choiceId: string) {
  return `logic-pairs:choice:${choiceId}`;
}

function promptIdForRound() {
  return `logic-pairs.prompt.${round.value.relation}`;
}

function clearTimers() {
  window.clearTimeout(feedbackTimer);
  promptAudio.cancelPending();
  feedbackTimer = 0;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptIdForRound()], delayMs);
  isSpeaking.value = false;
}

function resetRoundFeedback() {
  clearTimers();
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  pendingSelection.value = false;
  isSpeaking.value = false;
}

async function choose(choice: LogicPairCard) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.pair.id);
  clearTimers();
  if (choice.id === round.value.pair.id) {
    pendingSelection.value = true;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.pair.label, actual: choice.label, relation: round.value.relation, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    void logicPairsFeedback.playSuccess(session.settings.sound);
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(["logic-pairs.correct"], 80);
    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetRoundFeedback();
        void playPrompt(180);
      }, 260);
    } else {
      pendingSelection.value = false;
      isSpeaking.value = false;
    }
    return;
  }

  pendingSelection.value = true;
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.pair.label, actual: choice.label, relation: round.value.relation, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, text: round.value.explanation, reason: "wrong-pair-selected" });
  void logicPairsFeedback.playMistake(session.settings.sound);
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["logic-pairs.mistake", promptIdForRound()], 80, 170);
  pendingSelection.value = false;
  lastMistakeId.value = undefined;
  isSpeaking.value = false;
}

function restart() {
  resetRoundFeedback();
  restartRoundGame();
  void playPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  logicPairsFeedback.warm(session.settings.sound);
  void playPrompt(450);
});

watch(() => session.settings.sound, (enabled) => {
  logicPairsFeedback.warm(enabled);
});

onUnmounted(() => {
  clearTimers();
  logicPairsFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #f4f7ff 0%, #fff7e8 54%, #eefbf4 100%)" padding-top="8.75rem">
    <template #hud>
      <GameHud title="Логические пары" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="logic-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">{{ relationLabel }}</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-5 text-body-1 text-md-h6 font-weight-bold" :color="hintedRoundId === round.roundId ? 'secondary' : 'primary'" :icon="hintedRoundId === round.roundId ? 'mdi-heart-outline' : 'mdi-link-variant'" rounded="xl" variant="tonal">
              {{ helperText }}
            </v-alert>

            <v-row class="pair-layout" dense align="stretch">
              <v-col cols="12" sm="4">
                <v-sheet class="target-card pa-4" color="primary" rounded="xl">
                  <div class="text-overline text-white text-center mb-2">Найди пару для</div>
                  <GameWordImage v-if="round.target.wordId" class="target-card__visual" :word-id="round.target.wordId" :word="round.target.label" :emoji="round.target.visual" />
                  <div v-else class="target-card__visual text-white">{{ round.target.visual }}</div>
                  <div class="text-h5 text-md-h4 font-weight-bold text-white text-center mt-3">{{ round.target.label }}</div>
                </v-sheet>
              </v-col>

              <v-col cols="12" sm="8">
                <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="12rem" :highlight-choice="(choice) => hintedRoundId === round.roundId && choice.id === round.pair.id" :color="(choice) => hintedRoundId === round.roundId && choice.id === round.pair.id ? 'primary' : 'surface'" :cols="6" :sm="3" @select="choose">
                  <template #default="{ choice }">
                    <div :class="['choice-card', { 'choice-card--mistake': choice.id === lastMistakeId }]">
                      <GameWordImage v-if="choice.wordId" class="choice-card__visual" :word-id="choice.wordId" :word="choice.label" :emoji="choice.visual" />
                      <div v-else class="choice-card__visual">{{ choice.visual }}</div>
                      <div class="choice-card__label text-body-1 text-md-h6 font-weight-bold mt-3">{{ choice.label }}</div>
                    </div>
                  </template>
                </GameChoiceCardGrid>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Логические пары" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.logic-card {
  overflow: hidden;
}

.pair-layout {
  row-gap: 1rem;
}

.target-card {
  align-items: center;
  block-size: 100%;
  box-shadow: inset 0 -0.5rem 2rem rgb(255 255 255 / 18%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 18rem;
}

.target-card__visual,
.choice-card__visual {
  font-size: clamp(4.5rem, min(12vw, 15vh), 8rem);
  font-weight: 900;
  line-height: 1;
  text-align: center;
}

.choice-card {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-card__label {
  font-size: clamp(0.78rem, 1.6vw, 1.25rem);
  line-height: 1.15;
  overflow-wrap: normal;
  text-align: center;
}

.choice-card--mistake {
  filter: saturate(0.75) opacity(0.72);
  transform: scale(0.97);
}

@media (max-height: 44rem) {
 .target-card {
    min-block-size: 13rem;
  }
}
</style>
