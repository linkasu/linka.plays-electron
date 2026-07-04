<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateFindColorRound, type FindColorOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("find-color", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "find-color",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["find-color.prompt.red", "find-color.correct", "find-color.mistake"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindColorRound(session.settings, roundIndex)
});

const mistakesInRound = ref(0);
const lastMistakeId = ref<string>();
const isSpeaking = ref(false);

const hintText = computed(() => {
  if (mistakesInRound.value <= 0) return "Выбери карточку нужного цвета.";
  return `Ищи ${round.value.target.label} круг. Он подсвечен рамкой.`;
});

function choiceTargetId(choiceId: string) {
  return `find-color:choice:${choiceId}`;
}

function promptAssetId() {
  return `find-color.prompt.${round.value.target.id}`;
}

async function playRoundPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isSpeaking.value = false;
}

function choiceStyle(choice: FindColorOption) {
  return {
    "--find-color-bg": choice.hex,
    "--find-color-text": choice.textColor
  };
}

async function answer(choice: FindColorOption) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    isSpeaking.value = true;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    mistakesInRound.value = 0;
    lastMistakeId.value = undefined;
    void pianoFeedback.playSuccess();
    await promptAudio.playSequenceAndWait(["find-color.correct"], 80);
    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      await playRoundPrompt(180);
      return;
    }
    isSpeaking.value = false;
    return;
  }

  isSpeaking.value = true;
  mistakesInRound.value += 1;
  lastMistakeId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, text: `Нужен ${round.value.target.label} круг.`, reason: "wrong-color-selected" });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait(["find-color.mistake", promptAssetId()], 80, 170);
  isSpeaking.value = false;
}

function restart() {
  mistakesInRound.value = 0;
  lastMistakeId.value = undefined;
  isSpeaking.value = false;
  promptAudio.cancelPending();
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
  <GamePageShell gradient="warm" padding-top="4rem">
    <template #hud>
      <GameHud title="Найди цвет" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-color-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Смотри и выбирай</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="clamp(7.75rem, 23vh, 13.75rem)" @select="answer">
              <template #default="{ choice }">
                <div :class="['color-choice', { 'color-choice--hinted': mistakesInRound > 0 && choice.id === round.target.id, 'color-choice--mistake': choice.id === lastMistakeId }]" :style="choiceStyle(choice)">
                  <div class="color-dot" aria-hidden="true" />
                  <div class="text-h4 text-md-h3 font-weight-bold color-label">{{ choice.label }}</div>
                </div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди цвет" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.find-color-card {
  overflow: hidden;
}

.color-choice {
  align-items: center;
  background: var(--find-color-bg);
  border: 0.25rem solid rgb(255 255 255 / 82%);
  border-radius: 1.5rem;
  block-size: 100%;
  color: var(--find-color-text);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: center;
  min-block-size: clamp(7rem, 20vh, 10.5rem);
  outline: 0 solid transparent;
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.color-dot {
  background: var(--find-color-bg);
  border: 0.5rem solid rgb(255 255 255 / 42%);
  border-radius: 999px;
  block-size: clamp(3.25rem, min(8vh, 12vw), 7.5rem);
  box-shadow: 0 0 0 0.875rem rgb(255 255 255 / 22%), inset 0 0.5rem 1rem rgb(255 255 255 / 18%), inset 0 -0.4rem 0.8rem rgb(0 0 0 / 16%);
  inline-size: clamp(3.25rem, min(8vh, 12vw), 7.5rem);
  opacity: 0.95;
}

.color-label {
  text-shadow: 0 0.125rem 0.375rem rgb(0 0 0 / 28%);
}

.color-choice--hinted {
  outline: 0.45rem solid rgb(var(--v-theme-primary));
  transform: scale(1.03);
}

.color-choice--mistake {
  filter: saturate(0.7) brightness(0.95);
}

@media (max-height: 42rem) {
 .color-choice {
    gap: 0.5rem;
  }
}
</style>
