<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { whatMissingFeedback } from "./audio";
import { DEFAULT_WHAT_MISSING_OBSERVE_MS, generateWhatMissingRound, transitionWhatMissingPhase, type WhatMissingItem, type WhatMissingPhase, type WhatMissingPhaseEvent, type WhatMissingRound } from "./model";

const router = useRouter();
const phase = ref<WhatMissingPhase>("instruction");
const isResponding = ref(false);
const isSpeaking = ref(false);
const hintedRoundId = ref<string>();
const feedbackText = ref("Запомни три предмета.");
let observeTimer = 0;
let flowToken = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("what-missing", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({
  gameId: "what-missing",
  soundEnabled: toRef(session.settings, "sound"),
  volume: 0.34,
  warmAssetIds: ["what-missing.observe", "what-missing.choose", "what-missing.correct", "what-missing.mistake"]
});

const { round, resultVisible, nextRound: generateNextRound, restart: restartRoundGame } = useRoundGame<WhatMissingRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateWhatMissingRound(session.settings, roundIndex)
});

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.missingItem.id : undefined);

function choiceTargetId(choiceId: string) {
  return `what-missing:${round.value.roundId}:choice:${choiceId}`;
}

function cancelRoundFlow() {
  flowToken += 1;
  window.clearTimeout(observeTimer);
  promptAudio.cancelPending();
}

function sendPhaseEvent(event: WhatMissingPhaseEvent) {
  const nextPhase = transitionWhatMissingPhase(phase.value, event);
  const changed = nextPhase !== phase.value;
  phase.value = nextPhase;
  return changed;
}

async function playSequence(assetIds: string[], delayMs: number, token: number) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(assetIds, delayMs, 170);
  if (token !== flowToken) return false;
  isSpeaking.value = false;
  return true;
}

async function startTransition(token: number) {
  if (token !== flowToken || !sendPhaseEvent("observe-complete")) return;
  feedbackText.value = "Что пропало?";
  if (!await playSequence(["what-missing.choose"], 80, token)) return;
  sendPhaseEvent("transition-complete");
  feedbackText.value = "Выбери предмет.";
}

async function startInstruction(delayMs = 120) {
  cancelRoundFlow();
  const token = flowToken;
  sendPhaseEvent("reset");
  isResponding.value = false;
  isSpeaking.value = false;
  hintedRoundId.value = undefined;
  feedbackText.value = "Запомни три предмета.";
  if (!await playSequence(["what-missing.observe"], delayMs, token)) return;
  sendPhaseEvent("instruction-complete");
  feedbackText.value = "Запоминай предметы.";
  observeTimer = window.setTimeout(() => {
    void startTransition(token);
  }, DEFAULT_WHAT_MISSING_OBSERVE_MS);
}

function isItemVisible(item: WhatMissingItem) {
  return phase.value === "instruction" || phase.value === "observe" || item.id !== round.value.missingItem.id;
}

async function answer(choice: WhatMissingItem) {
  if (session.status !== "running" || phase.value !== "choose" || isResponding.value || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.missingItem.id);
  if (!sendPhaseEvent("answer")) return;
  const token = flowToken;
  isResponding.value = true;
  if (choice.id === round.value.missingItem.id) {
    hintedRoundId.value = undefined;
    feedbackText.value = `Верно, пропал ${choice.label}.`;
    void whatMissingFeedback.playSuccess(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.missingItem.label, actual: choice.label, isCorrect: true });
    if (!await playSequence(["what-missing.correct"], 80, token)) return;
    isResponding.value = false;
    if (session.status === "running" && session.step < session.maxSteps) {
      sendPhaseEvent("next-round");
      generateNextRound();
      void startInstruction();
    }
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.missingItem.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
  void whatMissingFeedback.playMistake(session.settings.sound);
  hintedRoundId.value = round.value.roundId;
  feedbackText.value = "Почти. Ничего страшного, попробуй ещё раз.";
  if (!await playSequence(["what-missing.mistake", "what-missing.choose"], 80, token)) return;
  isResponding.value = false;
  sendPhaseEvent("retry");
  feedbackText.value = "Выбери предмет.";
}

function restart() {
  cancelRoundFlow();
  sendPhaseEvent("reset");
  isSpeaking.value = false;
  isResponding.value = false;
  restartRoundGame();
  void startInstruction(220);
}

onMounted(() => {
  promptAudio.warm();
  whatMissingFeedback.warm(session.settings.sound);
  void startInstruction(420);
});

watch(() => session.settings.sound, (enabled) => {
  whatMissingFeedback.warm(enabled);
});

onUnmounted(() => {
  cancelRoundFlow();
  whatMissingFeedback.dispose();
});
</script>

<template>
  <div class="what-missing-shell">
    <GameHud title="Что пропало?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="what-missing-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Зрительная память</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">Что пропало?</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ feedbackText }}</p>

            <v-row class="memory-row mb-5" dense justify="center">
              <v-col v-for="item in round.displayItems" :key="item.id" cols="4">
                <v-card class="memory-slot pa-3 pa-md-5" :color="isItemVisible(item) ? item.color : 'grey-lighten-4'" rounded="xl" elevation="0">
                  <div v-if="isItemVisible(item)" class="slot-content">
                    <GameWordImage class="scene-emoji" :word-id="item.id" :word="item.label" :emoji="item.emoji" />
                    <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ item.label }}</div>
                  </div>
                  <div v-else class="missing-slot text-h6 text-md-h5 font-weight-bold text-medium-emphasis">пропало</div>
                </v-card>
              </v-col>
            </v-row>

            <template v-if="phase === 'choose' || phase === 'feedback'">
              <v-divider class="choice-divider mb-5" />

              <v-row dense justify="center">
                <v-col v-for="choice in round.choices" :key="choice.id" cols="6" sm="3">
                  <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || phase !== 'choose' || isResponding || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="11.25rem" :color="hintedChoiceId === choice.id ? 'deep-purple-darken-3' : 'surface'" @select="answer(choice)">
                    <template #default>
                      <GameWordImage class="choice-emoji" :word-id="choice.id" :word="choice.label" :emoji="choice.emoji" />
                      <div class="text-h5 text-md-h4 font-weight-bold mt-2">{{ choice.label }}</div>
                      <div class="choice-status text-body-1 mt-1">выбрать</div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>
            </template>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Что пропало?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.what-missing-shell {
  background: linear-gradient(135deg, #f7f0ff 0%, #eef8ff 48%, #fff8e6 100%);
  min-block-size: 100vh;
}

.what-missing-container {
  padding-block-start: 8.75rem;
}

.memory-slot {
  align-items: center;
  display: flex;
  justify-content: center;
  min-block-size: min(18rem, 31vh);
}

.slot-content,
.missing-slot {
  text-align: center;
}

.scene-emoji {
  font-size: clamp(5rem, min(12vw, 18vh), 9rem);
  line-height: 1;
}

.choice-emoji {
  font-size: clamp(4rem, min(8vw, 12vh), 6.5rem);
  line-height: 1;
}

.choice-status {
  color: #263238;
}

@media (max-height: 44rem) {
 .what-missing-container {
    padding-block-start: 4rem;
  }

 .what-missing-container :deep(.v-card.pa-4) {
    padding-block: 0.875rem !important;
  }

 .what-missing-container .text-overline {
    display: none;
  }

 .what-missing-container h1 {
    font-size: clamp(1.75rem, 4vw, 2.3rem) !important;
    line-height: 1.05;
    margin-block-end: 0.35rem !important;
  }

 .what-missing-container p {
    font-size: 1rem !important;
    margin-block-end: 0.75rem !important;
  }

 .memory-row {
    margin-block-end: 0.5rem !important;
  }

 .choice-divider {
    margin-block-end: 0.5rem !important;
  }

 .memory-slot {
    min-block-size: 6.75rem;
  }

 .scene-emoji {
    font-size: clamp(3.1rem, min(8vw, 10vh), 5rem);
  }

 .choice-emoji {
    font-size: clamp(3.25rem, min(7vw, 9vh), 5rem);
  }

 .what-missing-container :deep(.dwell-button) {
    min-block-size: 8.5rem !important;
  }
}
</style>
