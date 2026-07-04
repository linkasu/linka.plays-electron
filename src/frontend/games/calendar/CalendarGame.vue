<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useRoundGame } from "../../composables/useRoundGame";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateCalendarRound, type CalendarChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("calendar", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 130, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "calendar",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["calendar.prompt.weekday.monday.today", "calendar.prompt.relative.monday.today", "calendar.mistake", "calendar.complete"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateCalendarRound(session.settings, roundIndex)
});

const mistakeChoiceId = ref<string>();
const feedbackText = ref("Выбери день.");
const isSpeaking = ref(false);

function choiceTargetId(choice: CalendarChoice) {
  return `calendar:choice:${choice.id}`;
}

function promptAssetId() {
  return `calendar.prompt.${round.value.promptId}`;
}

function correctAssetId() {
  return `calendar.correct.${round.value.correctChoiceId}`;
}

function mistakeAssetId() {
  return "calendar.mistake";
}

async function playRoundPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isSpeaking.value = false;
}

function choiceColor(choice: CalendarChoice) {
  if (mistakeChoiceId.value === choice.id) return "orange-lighten-4";
  return choice.color;
}

async function choose(choice: CalendarChoice) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = `calendar:choice:${round.value.correctChoiceId}`;

  if (choice.id === round.value.correctChoiceId) {
    isSpeaking.value = true;
    mistakeChoiceId.value = undefined;
    feedbackText.value = "Верно.";
    recordSuccess({ roundId: round.value.roundId, targetId, expected: round.value.correctChoiceId, actual: choice.id, isCorrect: true });
    void pianoFeedback.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [correctAssetId(), "calendar.complete"] : [correctAssetId()], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      feedbackText.value = "Следующий день.";
      await playRoundPrompt(180);
      return;
    }
    isSpeaking.value = false;
    return;
  }

  isSpeaking.value = true;
  mistakeChoiceId.value = choice.id;
  feedbackText.value = "Посмотри на календарь ещё раз и выбери другой день.";
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: round.value.correctChoiceId, actual: choice.id, isCorrect: false });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait([mistakeAssetId()], 80);
  isSpeaking.value = false;
}

function restart() {
  promptAudio.cancelPending();
  mistakeChoiceId.value = undefined;
  feedbackText.value = "Выбери день.";
  isSpeaking.value = false;
  restartRoundGame();
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
  <div class="calendar-shell">
    <GameHud title="Календарь" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="d-flex justify-center mb-3">
              <v-chip color="primary" prepend-icon="mdi-calendar-today" size="large" variant="tonal">
                {{ round.contextText }}
              </v-chip>
            </div>
            <div class="text-overline text-secondary text-center mb-2">Дни недели и время</div>
            <h1 class="text-h4 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-5 text-body-1 text-md-h6 font-weight-bold" color="primary" icon="mdi-lightbulb-outline" rounded="xl" variant="tonal">
              {{ feedbackText }}
            </v-alert>

            <v-row class="choice-row" justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="choose(choice)">
                  <template #default>
                    <div class="calendar-choice">
                      <v-icon :icon="choice.icon" class="calendar-choice__icon mb-3" size="48" />
                      <div class="calendar-choice__label font-weight-black">{{ choice.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Календарь" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.calendar-shell {
  background: linear-gradient(135deg, #f2fbff 0%, #fff7df 48%, #eef7e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 9.25rem;
}

.choice-row {
  row-gap: 0.75rem;
}

.calendar-choice {
  align-items: center;
  block-size: 100%;
  color: #17212b;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  text-align: center;
}

.calendar-choice__icon,
.calendar-choice__label {
  color: #17212b !important;
}

.calendar-choice__label {
  font-size: clamp(1.75rem, 3.8vw, 3.7rem);
  line-height: 0.98;
  max-inline-size: 100%;
  white-space: nowrap;
}

.calendar-choice__check {
  inset-block-start: 0.25rem;
  inset-inline-end: 0.25rem;
  position: absolute;
}

@media (max-width: 37.5rem) {
 .game-container {
    padding-block-start: 11rem;
  }
}

@media (min-width: 56.25rem) and (max-width: 75rem) {
 .choice-row :deep(.dwell-button) {
    padding-inline: 0.35rem !important;
  }

 .calendar-choice__label {
    font-size: 1.3rem;
  }
}

@media (max-height: 42rem) and (min-width: 60rem) {
 .game-container {
    padding-block-start: 7.4rem;
  }
}

@media (max-height: 42.5rem) {
 .game-container {
    padding-block-start: 4.75rem;
  }

 .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

 .game-container.d-flex,
 .game-container .text-overline,
 .game-container h1,
 .game-container .v-alert {
    display: none !important;
  }

 .choice-row {
    row-gap: 0.35rem;
  }

 .choice-row :deep(.v-col) {
    flex: 0 0 50% !important;
    max-inline-size: 50% !important;
  }

 .choice-row :deep(.dwell-button) {
    min-block-size: 7.25rem !important;
    padding: 0.5rem !important;
  }

 .calendar-choice__label {
    font-size: 2.4rem;
  }
}

@media (max-height: 42.5rem) and (min-width: 56.25rem) {
 .choice-row :deep(.dwell-button) {
    padding-inline: 0.35rem !important;
  }

 .calendar-choice__label {
    font-size: 1.3rem;
  }
}
</style>
