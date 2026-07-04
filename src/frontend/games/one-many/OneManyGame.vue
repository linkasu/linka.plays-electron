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
import { generateOneManyRound, type OneManyAnswer, type OneManyChoice, type OneManyRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("one-many", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "one-many",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["one-many.prompt.one", "one-many.prompt.many", "one-many.mistake", "one-many.complete"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart } = useRoundGame<OneManyRound>({
  session,
  startSession,
  generateRound: generateOneManyRound
});

const feedback = ref("Выбери взглядом: один или много.");
const isSpeaking = ref(false);

function choiceTargetId(answer: OneManyAnswer) {
  return `one-many:choice:${answer}`;
}

function promptAssetId() {
  return `one-many.prompt.${round.value.target}`;
}

function correctAssetId() {
  return `one-many.correct.${round.value.target}`;
}

function mistakeAssetId() {
  return "one-many.mistake";
}

async function playRoundPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isSpeaking.value = false;
}

async function choose(choice: OneManyChoice) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target);

  if (choice.id === round.value.target) {
    isSpeaking.value = true;
    feedback.value = choice.id === "one" ? "Да, здесь один." : "Да, здесь много.";
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      itemName: round.value.itemName,
      expected: round.value.target,
      actual: choice.id,
      isCorrect: true
    });
    void pianoFeedback.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [correctAssetId(), "one-many.complete"] : [correctAssetId()], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      feedback.value = "Следующий выбор: один или много.";
      await playRoundPrompt(180);
      return;
    }
    isSpeaking.value = false;
    return;
  }

  isSpeaking.value = true;
  feedback.value = "Посмотри на предметы ещё раз и выбери другую карточку.";
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId,
    answerId: choice.id,
    itemName: round.value.itemName,
    expected: round.value.target,
    actual: choice.id,
    isCorrect: false
  });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait([mistakeAssetId()], 80);
  isSpeaking.value = false;
}

function restartGame() {
  feedback.value = "Выбери взглядом: один или много.";
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
  <div class="one-many-shell">
    <GameHud title="Один / много" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-5 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Понятия количества</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <div class="one-many-feedback text-h6 text-md-h5 text-center mb-5">{{ feedback }}</div>

            <v-row class="choice-row" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" md="6">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="250" color="surface" @select="choose(choice)">
                  <template #default>
                    <div class="choice-side text-overline mb-3">{{ choice.side === "left" ? "Слева" : "Справа" }}</div>
                    <div class="items" aria-hidden="true">
                      <span v-for="(item, index) in choice.items" :key="index" class="item-emoji emoji-glyph">{{ item }}</span>
                    </div>
                    <div class="text-h3 text-md-h2 font-weight-bold mt-4">{{ choice.title }}</div>
                    <div class="sr-only">{{ choice.title }}: {{ choice.count }} {{ round.itemName }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Один / много" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.one-many-shell {
  background: linear-gradient(135deg, #fff8df 0%, #e9f8ff 52%, #f5f1ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.choice-row {
  row-gap: 1rem;
}

.one-many-feedback,
.choice-side {
  color: #263238;
}

.items {
  align-content: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  justify-content: center;
  margin-inline: auto;
  max-inline-size: 27rem;
  min-block-size: 11rem;
}

.item-emoji {
  font-size: clamp(3.5rem, min(8vw, 10vh), 5.75rem);
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

 .items {
    min-block-size: 8rem;
  }
}
</style>
