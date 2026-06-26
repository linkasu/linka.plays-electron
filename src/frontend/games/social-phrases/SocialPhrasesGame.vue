<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateSocialPhraseRound, getSocialPhraseChoice, isSocialPhraseChoiceCorrect, kindLabels, type SocialPhraseChoice, type SocialPhraseRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("social-phrases", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 125, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "social-phrases",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["social-phrases.prompt.morning-adult", "social-phrases.prompt.thirsty", "social-phrases.prompt.opened-box", "social-phrases.mistake", "social-phrases.complete"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<SocialPhraseRound>({
  session,
  startSession,
  generateRound: generateSocialPhraseRound
});

const feedback = ref("Выбери подходящую социальную фразу взглядом.");
const selectedChoiceId = ref<string>();
const isChangingRound = ref(false);

const expectedKindLabel = computed(() => kindLabels[round.value.expectedKind]);

function choiceTargetId(choiceId: string) {
  return `social-phrases:choice:${round.value.roundId}:${choiceId}`;
}

function promptAssetId() {
  return `social-phrases.prompt.${round.value.id}`;
}

function correctAssetId(choice: SocialPhraseChoice) {
  return `social-phrases.correct.${round.value.id}.${choice.id}`;
}

function mistakeAssetId() {
  return "social-phrases.mistake";
}

async function playRoundPrompt(delayMs = 0) {
  isChangingRound.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isChangingRound.value = false;
}

async function choose(choice: SocialPhraseChoice) {
  if (session.status !== "running" || isChangingRound.value) return;

  const selectedChoice = getSocialPhraseChoice(round.value, choice.id);
  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.correctChoice.id);
  const isExpected = isSocialPhraseChoiceCorrect(round.value, selectedChoice);
  selectedChoiceId.value = choice.id;

  if (isExpected) {
    isChangingRound.value = true;
    feedback.value = round.value.correctFeedback;
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      expected: round.value.expectedKind,
      actual: choice.kind,
      phrase: choice.text,
      isCorrect: true
    });
    void pianoFeedback.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [correctAssetId(selectedChoice), "social-phrases.complete"] : [correctAssetId(selectedChoice)], 80, 170);
    if (finishedAfterSuccess) {
      feedback.value = "Спасибо. Социальные фразы потренированы.";
      finishSession("game-complete");
      isChangingRound.value = false;
      return;
    }
    if (session.status === "running") {
      nextRound();
      feedback.value = "Следующая ситуация.";
      selectedChoiceId.value = undefined;
      await playRoundPrompt(180);
      return;
    }
    feedback.value = "Спасибо. Социальные фразы потренированы.";
    isChangingRound.value = false;
    return;
  }

  isChangingRound.value = true;
  feedback.value = "Посмотри на ситуацию ещё раз и выбери другую фразу.";
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId,
    answerId: choice.id,
    expected: round.value.expectedKind,
    actual: choice.kind,
    phrase: choice.text,
    isCorrect: false,
    noFail: true
  });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait([mistakeAssetId()], 80);
  selectedChoiceId.value = undefined;
  isChangingRound.value = false;
}

function restart() {
  promptAudio.cancelPending();
  feedback.value = "Выбери подходящую социальную фразу взглядом.";
  selectedChoiceId.value = undefined;
  isChangingRound.value = false;
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
  <div class="social-phrases-shell">
    <GameHud title="Социальные фразы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="social-phrases-card pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-3">AAC: приветствие, просьба, благодарность</div>
            <v-card class="scene-card pa-5 pa-md-7 mb-5" color="teal-lighten-5" rounded="xl" variant="flat">
              <v-chip class="mb-4 text-white" color="deep-purple-darken-3" size="large" variant="flat">Нужна фраза: {{ expectedKindLabel }}</v-chip>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">{{ round.scene }}</h1>
              <div class="scene-partner text-h6 text-md-h5 mb-2">{{ round.partner }}</div>
              <div class="text-h6 text-md-h5 font-weight-medium">{{ round.prompt }}</div>
            </v-card>

            <div class="social-feedback text-h6 text-md-h5 text-center mb-5">{{ feedback }}</div>

            <v-row justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="4" md="4">
                <GameDwellButton :class="{ 'selected-choice': selectedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" min-height="12.5rem" color="surface" @select="choose(choice)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph mb-3" aria-hidden="true">{{ choice.emoji }}</div>
                    <div class="choice-kind text-overline mb-2">{{ kindLabels[choice.kind] }}</div>
                    <div class="text-h4 text-md-h3 font-weight-bold">{{ choice.text }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Социальные фразы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.social-phrases-shell {
  background: linear-gradient(135deg, #effaf7 0%, #f7f2ff 52%, #fff8e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.scene-card {
  text-align: center;
}

.scene-partner,
.social-feedback,
.choice-kind {
  color: #263238;
}

.choice-emoji {
  font-size: clamp(3.8rem, 8vw, 6.5rem);
  line-height: 1;
}

.selected-choice {
  outline: 0.25rem solid rgb(var(--v-theme-secondary) / 32%);
  outline-offset: 0.2rem;
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 2.75rem;
  }

  .social-phrases-card {
    padding: 1rem !important;
  }

  .scene-card {
    margin-block-end: 0.75rem !important;
    padding: 1rem !important;
  }

  .scene-card h1 {
    font-size: 2.25rem !important;
    line-height: 1.08;
    margin-block-end: 0.5rem !important;
  }

  .scene-partner {
    font-size: 1rem !important;
  }

  .social-feedback {
    margin-block-end: 0.75rem !important;
  }

  .choice-emoji {
    font-size: clamp(3rem, 7vw, 4.5rem);
  }

  .game-container :deep(.dwell-button) {
    min-block-size: 7.75rem !important;
  }

  .choice-kind {
    margin-block-end: 0.25rem !important;
  }

  .choice-kind + .text-h4 {
    font-size: 1.8rem !important;
    line-height: 1.08;
  }
}
</style>
