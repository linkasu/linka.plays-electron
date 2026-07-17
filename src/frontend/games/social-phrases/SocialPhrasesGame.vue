<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { cancelSceneSpeech, speakSceneText } from "../sceneSpeech";
import { createSocialPhraseDeck, evaluateSocialPhraseChoice, getSocialPhraseChoice, socialPhrasesInstruction, type SocialPhraseChoice, type SocialPhraseRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("social-phrases", {
  maxSteps: 4,
  overrides: { dwellMs: 1300, sessionSeconds: 125, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

let deck = createSocialPhraseDeck();
const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<SocialPhraseRound>({
  session,
  startSession,
  generateRound: (roundIndex) => deck[roundIndex - 1]
});

const feedback = ref("Твоя выбранная фраза будет озвучена.");
const selectedChoiceId = ref<string>();
const isChangingRound = ref(false);

function choiceTargetId(choiceId: string) {
  return `social-phrases:choice:${round.value.id}:${choiceId}`;
}

async function playRoundPrompt(delayMs = 0, includeInstruction = false) {
  isChangingRound.value = true;
  const prompt = [includeInstruction ? socialPhrasesInstruction : "", round.value.scene, round.value.partner, round.value.prompt].filter(Boolean).join(" ");
  await speakSceneText(prompt, session.settings.sound, delayMs);
  isChangingRound.value = false;
}

async function choose(choice: SocialPhraseChoice) {
  if (session.status !== "running" || isChangingRound.value) return;

  const selectedChoice = getSocialPhraseChoice(round.value, choice.id);
  const evaluation = evaluateSocialPhraseChoice(round.value, selectedChoice);
  const targetId = choiceTargetId(choice.id);
  selectedChoiceId.value = choice.id;
  isChangingRound.value = true;

  if (evaluation.type === "communication") {
    feedback.value = `Ты сказал: «${evaluation.phrase}»`;
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      expected: round.value.expectedKind,
      actual: choice.kind,
      ...evaluation
    });
    await speakSceneText(evaluation.phrase, session.settings.sound, 80);

    if (evaluation.endsSession) {
      feedback.value = "Я услышал тебя. Останавливаемся.";
      await speakSceneText(feedback.value, session.settings.sound, 140);
      finishSession("game-complete");
      isChangingRound.value = false;
      return;
    }

    if (session.step >= session.maxSteps) {
      feedback.value = "Спасибо. Все ситуации закончились.";
      await speakSceneText(feedback.value, session.settings.sound, 140);
      finishSession("game-complete");
      isChangingRound.value = false;
      return;
    }

    nextRound();
    selectedChoiceId.value = undefined;
    feedback.value = round.value.prompt;
    await playRoundPrompt(180);
    return;
  }

  feedback.value = evaluation.feedback;
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId: choiceTargetId(round.value.expectedChoice.id),
    answerId: choice.id,
    expected: round.value.expectedKind,
    actual: choice.kind,
    phrase: choice.text,
    isCorrect: false,
    noFail: true
  });
  await speakSceneText(evaluation.feedback, session.settings.sound, 80);
  selectedChoiceId.value = undefined;
  isChangingRound.value = false;
}

function restart() {
  cancelSceneSpeech();
  deck = createSocialPhraseDeck();
  feedback.value = "Твоя выбранная фраза будет озвучена.";
  selectedChoiceId.value = undefined;
  isChangingRound.value = false;
  restartRoundGame();
  void playRoundPrompt(220, true);
}

onMounted(() => {
  void playRoundPrompt(420, true);
});

onUnmounted(() => {
  cancelSceneSpeech();
});
</script>

<template>
  <div class="social-phrases-shell">
    <GameHud title="Социальные фразы" :step="session.step" :max-steps="session.maxSteps" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="social-phrases-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <v-alert class="instruction mb-4" color="blue-lighten-5" icon="mdi-information-outline" rounded="xl" variant="flat">
              <div class="text-h6 text-md-h5 font-weight-bold">{{ socialPhrasesInstruction }}</div>
            </v-alert>

            <v-card class="scene-card pa-4 mb-4" :color="round.sceneColor" rounded="xl" variant="flat">
              <div class="scene-layout">
                <v-icon class="scene-icon" color="primary" :icon="round.sceneIcon" size="clamp(4rem, 12dvh, 7rem)" />
                <div>
                  <h1 class="scene-title text-h4 text-md-h3 font-weight-bold mb-2">{{ round.scene }}</h1>
                  <div class="scene-partner text-body-1 text-md-h6 mb-2">{{ round.partner }}</div>
                  <div class="scene-prompt text-h6 text-md-h5 font-weight-bold">{{ round.prompt }}</div>
                </div>
              </div>
            </v-card>

            <div class="social-feedback text-h6 text-md-h5 font-weight-bold text-center mb-4">{{ feedback }}</div>

            <v-row justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="6" sm="3">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" min-height="clamp(7.5rem, 22dvh, 11.5rem)" :color="selectedChoiceId === choice.id ? choice.iconColor : choice.color" @select="choose(choice)">
                  <template #default>
                    <v-icon class="choice-icon mb-2" :color="selectedChoiceId === choice.id ? 'white' : choice.iconColor" :icon="choice.icon" size="clamp(2.8rem, 7dvh, 4.8rem)" />
                    <div :class="['choice-text', 'text-h6', 'text-md-h5', 'font-weight-bold', { 'text-white': selectedChoiceId === choice.id }]">{{ choice.text }}</div>
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
  padding-block-start: 7.5rem;
}

.scene-layout {
  align-items: center;
  display: grid;
  gap: clamp(1rem, 3vw, 2rem);
  grid-template-columns: minmax(6rem, 9rem) minmax(0, 1fr);
}

.scene-icon {
  justify-self: center;
}

.scene-title,
.choice-text {
  line-height: 1.12;
}

.scene-partner,
.scene-prompt,
.social-feedback {
  color: #263238;
}

.social-feedback {
  min-block-size: 1.5em;
}

@media (max-width: 43.75rem) {
  .game-container {
    padding-block-start: 9.5rem;
  }

  .scene-layout {
    grid-template-columns: 1fr;
    text-align: center;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .social-phrases-card {
    padding: 0.5rem !important;
  }

  .instruction {
    margin-block-end: 0.65rem !important;
    padding-block: 0.45rem !important;
  }

  .instruction .text-h6 {
    font-size: 0.95rem !important;
  }

  .scene-card {
    margin-block-end: 0.65rem !important;
    padding: 0.7rem 1rem !important;
  }

  .scene-layout {
    grid-template-columns: 5rem minmax(0, 1fr);
  }

  .scene-icon {
    font-size: clamp(3rem, 10dvh, 4.5rem) !important;
  }

  .scene-title {
    font-size: clamp(1.3rem, 4dvh, 1.8rem) !important;
  }

  .scene-partner,
  .scene-prompt,
  .social-feedback {
    font-size: 1rem !important;
  }

  .social-feedback {
    margin-block-end: 0.65rem !important;
  }

  .game-container :deep(.dwell-button) {
    min-block-size: 7.5rem !important;
    padding: 0.65rem !important;
  }

  .choice-icon {
    font-size: clamp(2rem, 6dvh, 3rem) !important;
    margin-block-end: 0.35rem !important;
  }

  .choice-text {
    font-size: clamp(0.95rem, 2.6dvh, 1.2rem) !important;
  }

}
</style>
