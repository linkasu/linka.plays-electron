<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import GameSessionChrome from "../../components/game/GameSessionChrome.vue";
import GameSquareChoiceGrid, { type GameSquareChoice } from "../../components/game/GameSquareChoiceGrid.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { formatClockHour, generateClockRound } from "./model";

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("clock", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 130, sound: true },
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "clock",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["clock.prompt.1", "clock.prompt.2", "clock.prompt.3"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const feedback = ref("Посмотри на короткую стрелку и выбери часы.");
const isSpeaking = ref(false);
const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateClockRound(session.settings, roundIndex)
});

function choiceTargetId(hour: number) {
  return `clock:choice:${hour}`;
}

function promptAssetId() {
  return `clock.prompt.${round.value.targetHour}`;
}

function correctAssetId() {
  return `clock.correct.${round.value.targetHour}`;
}

function mistakeAssetId() {
  return `clock.mistake.${round.value.targetHour}`;
}

async function playRoundPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isSpeaking.value = false;
}

function hourAngle(hour: number) {
  return `${(hour % 12) * 30}deg`;
}

function handStyle(hour: number) {
  return { transform: `translateX(-50%) rotate(${hourAngle(hour)})` };
}

function markStyle(mark: number) {
  const angle = (mark * 30 - 90) * Math.PI / 180;
  const radius = 39;
  return {
    insetBlockStart: `${50 + Math.sin(angle) * radius}%`,
    insetInlineStart: `${50 + Math.cos(angle) * radius}%`
  };
}

async function choose(hour: number) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = choiceTargetId(hour);
  const expectedTargetId = choiceTargetId(round.value.targetHour);

  if (hour === round.value.targetHour) {
    isSpeaking.value = true;
    feedback.value = "Верно.";
    recordSuccess({ roundId: round.value.roundId, targetId, expected: round.value.targetHour, actual: hour, isCorrect: true });
    void pianoFeedback.playSuccess();
    await promptAudio.playSequenceAndWait([correctAssetId()], 80);
    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      feedback.value = "Следующие часы.";
      await playRoundPrompt(180);
      return;
    }
    isSpeaking.value = false;
    return;
  }

  isSpeaking.value = true;
  feedback.value = `Почти. Нужны часы ${formatClockHour(round.value.targetHour)}.`;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: round.value.targetHour, actual: hour, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, text: feedback.value });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait([mistakeAssetId()], 80);
  isSpeaking.value = false;
}

function answerChoice(choice: GameSquareChoice) {
  choose(Number(choice));
}

function restartGame() {
  promptAudio.cancelPending();
  feedback.value = "Посмотри на короткую стрелку и выбери часы.";
  isSpeaking.value = false;
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
  <GameSessionChrome title="Часы" :session="session" :result-visible="resultVisible" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" gradient="linear-gradient(135deg, #fff7e7 0%, #e7f5ff 100%)" padding-top="6rem" @pause="pauseSession" @resume="resumeSession" @restart="restartGame">
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Полные часы</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <div class="clock-feedback text-h6 text-md-h5 text-center font-weight-bold mb-4">{{ feedback }}</div>
            <GameSquareChoiceGrid :items="round.choices" grid-offset="18.5rem" compact-size="7.75rem" :target-id="(choice) => choiceTargetId(Number(choice))" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" @select="answerChoice">
              <template #default="{ choice }">
                <div class="clock-choice" :aria-label="formatClockHour(Number(choice))">
                  <div class="clock-face" aria-hidden="true">
                    <div v-for="mark in 12" :key="mark" class="clock-mark" :style="markStyle(mark)">
                      {{ mark }}
                    </div>
                    <div class="clock-hand clock-hand--hour" :style="handStyle(Number(choice))" />
                    <div class="clock-hand clock-hand--minute" />
                    <div class="clock-dot" />
                  </div>
                </div>
              </template>
            </GameSquareChoiceGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </GameSessionChrome>
</template>

<style scoped>
.game-container {
  padding-block-end: 0;
}

.clock-choice {
  align-items: center;
  color: #263238;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.clock-feedback {
  color: #263238;
}

.clock-face {
  aspect-ratio: 1;
  background: radial-gradient(circle at 50% 50%, #ffffff 0 56%, #f0f7ff 57% 100%);
  border: 0.35rem solid rgb(var(--v-theme-primary));
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.35rem rgba(var(--v-theme-primary), 0.12);
  inline-size: min(82%, 8.5rem);
  position: relative;
}

.clock-mark {
  color: #263238;
  font-size: clamp(0.8rem, 2.2vw, 1.25rem);
  font-weight: 800;
  position: absolute;
  transform: translate(-50%, -50%);
}

.clock-hand {
  background: rgb(var(--v-theme-on-surface));
  border-radius: 999px;
  inset-block-end: 50%;
  inset-inline-start: 50%;
  position: absolute;
  transform-origin: 50% 100%;
}

.clock-hand--hour {
  block-size: 28%;
  inline-size: 0.5rem;
}

.clock-hand--minute {
  block-size: 38%;
  inline-size: 0.3rem;
  transform: translateX(-50%);
}

.clock-dot {
  background: #263238;
  border-radius: 50%;
  block-size: 0.9rem;
  inline-size: 0.9rem;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translate(-50%, -50%);
}

@media (min-width: 68.75rem) {
  .game-container {
    padding-block-start: 2rem;
  }
}

@media (max-height: 40rem) {
  .game-container {
    padding-block-start: 0;
  }

  .game-container :deep(.v-card) {
    padding: 1rem !important;
  }

  .clock-face {
    inline-size: min(74%, 6.75rem);
  }

  .clock-feedback {
    margin-block-end: 0.75rem !important;
  }
}
</style>
