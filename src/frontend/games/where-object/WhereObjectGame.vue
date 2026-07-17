<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { cancelSceneSpeech, speakSceneText } from "../sceneSpeech";
import { generateWhereObjectRound, isWhereObjectCorrect, type WhereObjectChoice, type WhereObjectRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("where-object", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 120, targetScale: 1.2 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "where-object",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["where-object.complete"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);
const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<WhereObjectRound>({
  session,
  startSession,
  generateRound: generateWhereObjectRound
});

const lastMistakeId = ref<string>();
const isChangingRound = ref(false);
const choiceMinHeight = computed(() => {
  const scale = session.settings.targetScale;
  return `clamp(${7.5 * scale}rem, 26dvh, ${9.5 * scale}rem)`;
});
const hintText = computed(() => lastMistakeId.value
  ? "Посмотри на все картинки ещё раз."
  : "В каждой картинке один предмет. Покажи, где он находится.");

function choiceTargetId(choice: WhereObjectChoice) {
  return `where-object:preposition:${choice.id}`;
}

async function playRoundPrompt(delayMs = 0) {
  isChangingRound.value = true;
  promptAudio.cancelPending();
  await speakSceneText(round.value.prompt, session.settings.sound, delayMs);
  isChangingRound.value = false;
}

async function playCorrectScene(choice: WhereObjectChoice) {
  cancelSceneSpeech();
  if (choice.answerAssetId) {
    await promptAudio.playSequenceAndWait([choice.answerAssetId], 80);
    return;
  }
  await speakSceneText(`${choice.scenePhrase}.`, session.settings.sound, 80);
}

async function chooseScene(choice: WhereObjectChoice) {
  if (session.status !== "running" || isChangingRound.value) return;

  const targetId = choiceTargetId(choice);
  const correct = isWhereObjectCorrect(round.value, choice);
  isChangingRound.value = true;

  if (correct) {
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      objectId: round.value.targetObject.id,
      expected: round.value.scenePhrase,
      actual: choice.scenePhrase,
      isCorrect: true
    });
    lastMistakeId.value = undefined;
    void pianoFeedback.playSuccess();
    await playCorrectScene(choice);
    if (session.step >= session.maxSteps) {
      await promptAudio.playSequenceAndWait(["where-object.complete"], 80);
      finishSession("game-complete");
      isChangingRound.value = false;
      return;
    }

    if (session.status === "running") {
      nextRound();
      await playRoundPrompt(180);
      return;
    }
  } else {
    recordMistake({
      roundId: round.value.roundId,
      targetId,
      expectedTargetId: choiceTargetId(round.value.correctChoice),
      answerId: choice.id,
      objectId: round.value.targetObject.id,
      expected: round.value.scenePhrase,
      actual: choice.scenePhrase,
      isCorrect: false
    });
    lastMistakeId.value = choice.id;
    void pianoFeedback.playMistake();
    promptAudio.cancelPending();
    await speakSceneText(`Это другая картинка. Где ${round.value.targetObject.word}?`, session.settings.sound, 80);
  }

  isChangingRound.value = false;
}

function restart() {
  lastMistakeId.value = undefined;
  isChangingRound.value = false;
  promptAudio.cancelPending();
  cancelSceneSpeech();
  restartRoundGame();
  void playRoundPrompt(220);
}

onMounted(() => {
  promptAudio.warm();
  void playRoundPrompt(420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  cancelSceneSpeech();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #eee7ff 0%, #e3f6ef 48%, #fff0d1 100%)" padding-top="8.25rem">
    <template #hud>
      <GameHud title="Где предмет?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="10">
          <v-card class="where-object-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="prompt-panel text-center mb-4" aria-live="polite">
              <div class="text-overline text-secondary mb-1">Где предмет?</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ round.prompt }}</h1>
              <div class="text-h6 text-md-h5 text-medium-emphasis">{{ hintText }}</div>
            </div>

            <GameChoiceCardGrid
              :choices="round.choices"
              :target-id="choiceTargetId"
              :disabled="session.status !== 'running' || isChangingRound"
              :dwell-ms="session.settings.dwellMs"
              :min-height="choiceMinHeight"
              :mistake-choice="(choice) => lastMistakeId === choice.id"
              :cols="6"
              :sm="6"
              :md="3"
              @select="chooseScene"
            >
              <template #default="{ choice }">
                <div class="mini-scene" role="img" :aria-label="choice.scenePhrase">
                  <div class="mini-scene__box-back" aria-hidden="true" />
                  <GameWordImage
                    :class="['mini-scene__object', `mini-scene__object--${choice.id}`]"
                    :word-id="choice.targetObject.id"
                    :word="choice.targetObject.word"
                    :emoji="choice.targetObject.emoji"
                    decorative
                  />
                  <div class="mini-scene__box-front" aria-hidden="true" />
                </div>
                <div class="relation-label text-h5 text-md-h4 font-weight-bold mt-2">{{ choice.preposition.label }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Где предмет?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.mini-scene {
  background: linear-gradient(180deg, #eaf8ff 0%, #fff8df 72%, #d8edcf 72%, #d8edcf 100%);
  border-radius: 1.25rem;
  min-block-size: 8.2rem;
  overflow: hidden;
  position: relative;
}

.mini-scene__box-back,
.mini-scene__box-front {
  background: #d5a96f;
  border: 0.12rem solid #8d6948;
  inline-size: 38%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.mini-scene__box-back {
  block-size: 34%;
  border-radius: 0.4rem 0.4rem 0 0;
  inset-block-end: 19%;
  transform: translateX(-50%) skewY(-5deg);
  z-index: 1;
}

.mini-scene__box-front {
  block-size: 18%;
  border-radius: 0 0 0.45rem 0.45rem;
  inset-block-end: 17%;
  z-index: 3;
}

.mini-scene__object {
  font-size: clamp(3.1rem, 5.2vw, 4.6rem);
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 4;
}

.mini-scene__object--on {
  inset-block-start: 27%;
  inset-inline-start: 50%;
}

.mini-scene__object--under {
  inset-block-start: 87%;
  inset-inline-start: 50%;
}

.mini-scene__object--in {
  inset-block-start: 59%;
  inset-inline-start: 50%;
  z-index: 2;
}

.mini-scene__object--beside {
  inset-block-start: 64%;
  inset-inline-start: 20%;
}

.relation-label {
  color: #263238;
  line-height: 1.1;
  text-align: center;
}

@media (max-height: 42rem) {
  .where-object-card {
    padding: 1rem !important;
  }

  .prompt-panel {
    margin-block-end: 0.75rem !important;
  }

  .prompt-panel .text-overline {
    display: none;
  }

  .prompt-panel h1 {
    font-size: 2rem !important;
    line-height: 1.08;
  }

  .prompt-panel .text-h6 {
    font-size: 0.98rem !important;
    line-height: 1.2;
  }

  .mini-scene {
    min-block-size: 5.8rem;
  }

  .relation-label {
    font-size: 1.18rem !important;
  }
}
</style>
