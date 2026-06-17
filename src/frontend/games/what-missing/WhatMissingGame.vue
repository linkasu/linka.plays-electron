<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { whatMissingFeedback } from "./audio";
import { generateWhatMissingRound, type WhatMissingItem, type WhatMissingRound } from "./model";

type RoundPhase = "observe" | "choose";

const observeMs = 1900;
const feedbackMs = 900;

const router = useRouter();
const phase = ref<RoundPhase>("observe");
const isResponding = ref(false);
const hintedRoundId = ref<string>();
const feedbackText = ref("Запомни три предмета.");
let observeTimer = 0;
let feedbackTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("what-missing", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false
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

function clearTimers() {
  window.clearTimeout(observeTimer);
  window.clearTimeout(feedbackTimer);
}

function startObservePhase() {
  clearTimers();
  phase.value = "observe";
  isResponding.value = false;
  hintedRoundId.value = undefined;
  feedbackText.value = "Запомни три предмета.";
  observeTimer = window.setTimeout(() => {
    phase.value = "choose";
    feedbackText.value = "Что пропало? Выбери предмет снизу.";
  }, observeMs);
}

function isItemVisible(item: WhatMissingItem) {
  return phase.value === "observe" || item.id !== round.value.missingItem.id;
}

function answer(choice: WhatMissingItem) {
  if (session.status !== "running" || phase.value !== "choose" || isResponding.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.missingItem.id);
  if (choice.id === round.value.missingItem.id) {
    isResponding.value = true;
    hintedRoundId.value = undefined;
    feedbackText.value = `Верно, пропал ${choice.label}.`;
    void whatMissingFeedback.playSuccess(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.missingItem.label, actual: choice.label, isCorrect: true });
    feedbackTimer = window.setTimeout(() => {
      isResponding.value = false;
      if (session.status === "running" && session.step < session.maxSteps) generateNextRound();
    }, feedbackMs);
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.missingItem.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
  void whatMissingFeedback.playMistake(session.settings.sound);
  hintedRoundId.value = round.value.roundId;
  feedbackText.value = "Почти. Ничего страшного, попробуй ещё раз.";
}

function restart() {
  clearTimers();
  restartRoundGame();
}

watch(() => round.value.roundId, startObservePhase, { immediate: true });

onMounted(() => {
  whatMissingFeedback.warm(session.settings.sound);
});

watch(() => session.settings.sound, (enabled) => {
  whatMissingFeedback.warm(enabled);
});

onUnmounted(() => {
  clearTimers();
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

            <v-row class="mb-5" dense justify="center">
              <v-col v-for="item in round.displayItems" :key="item.id" cols="4">
                <v-card class="memory-slot pa-3 pa-md-5" :color="isItemVisible(item) ? item.color : 'grey-lighten-4'" rounded="xl" elevation="0">
                  <div v-if="isItemVisible(item)" class="slot-content">
                    <div class="scene-emoji emoji-glyph">{{ item.emoji }}</div>
                    <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ item.label }}</div>
                  </div>
                  <div v-else class="missing-slot text-h6 text-md-h5 font-weight-bold text-medium-emphasis">пропало</div>
                </v-card>
              </v-col>
            </v-row>

            <v-divider class="mb-5" />

            <v-row dense justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="4">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || phase !== 'choose' || isResponding" :dwell-ms="session.settings.dwellMs" :min-height="180" :color="hintedChoiceId === choice.id ? 'deep-purple-darken-3' : 'surface'" @select="answer(choice)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                    <div class="text-h5 text-md-h4 font-weight-bold mt-2">{{ choice.label }}</div>
                    <div class="choice-status text-body-1 mt-1">{{ phase === "observe" ? "смотри" : "выбрать" }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
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
    padding-block-start: 5rem;
  }

  .memory-slot {
    min-block-size: 9rem;
  }

  .scene-emoji {
    font-size: clamp(4rem, min(10vw, 14vh), 7rem);
  }

  .what-missing-container :deep(.dwell-button) {
    min-block-size: 10rem !important;
  }
}
</style>
