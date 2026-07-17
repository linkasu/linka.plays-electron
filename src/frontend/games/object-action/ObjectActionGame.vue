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
import { resolveMenuRoute } from "../../core/menuMode";
import { cancelSceneSpeech, speakSceneText } from "../sceneSpeech";
import { generateObjectActionRound, isObjectActionCorrect, objectActionChoiceTargetId, type ObjectActionChoice, type ObjectActionRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, finishSession, startSession } = useGameSessionFor("object-action", {
  maxSteps: 8,
  finishOnMistakes: false,
  finishOnMaxSteps: false
});
const promptAudio = useGamePromptAudio({
  gameId: "object-action",
  soundEnabled: toRef(session.settings, "sound"),
  volume: 0.34
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<ObjectActionRound>({
  session,
  startSession,
  generateRound: generateObjectActionRound
});

const feedback = ref("Посмотри на картинки и покажи названное действие.");
const isChangingRound = ref(false);
const choiceMinHeight = computed(() => `${9.5 * session.settings.targetScale}rem`);

function choiceTargetId(choice: ObjectActionChoice) {
  return objectActionChoiceTargetId(choice.id);
}

async function playRoundPrompt(delayMs = 0) {
  isChangingRound.value = true;
  promptAudio.cancelPending();
  await speakSceneText(round.value.prompt, session.settings.sound, delayMs);
  isChangingRound.value = false;
}

async function playCorrectScene(choice: ObjectActionChoice) {
  cancelSceneSpeech();
  if (choice.successAssetId) {
    await promptAudio.playSequenceAndWait([choice.successAssetId], 80);
    return;
  }
  await speakSceneText(choice.successText, session.settings.sound, 80);
}

async function chooseAction(choice: ObjectActionChoice) {
  if (session.status !== "running" || isChangingRound.value) return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.correctChoice);
  const wasCorrect = isObjectActionCorrect(round.value, choice);
  isChangingRound.value = true;

  if (wasCorrect) {
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      actionId: round.value.targetAction.id,
      expected: round.value.targetAction.title,
      actual: choice.title,
      isCorrect: true
    });
    feedback.value = round.value.explanation;
    await playCorrectScene(choice);
    if (session.step >= session.maxSteps) {
      await promptAudio.playSequenceAndWait(["object-action.complete"], 80);
      finishSession("game-complete");
      isChangingRound.value = false;
      return;
    }

    if (session.status === "running") {
      nextRound();
      feedback.value = "Новое действие. Посмотри на все картинки.";
      await playRoundPrompt(180);
      return;
    }
  } else {
    recordMistake({
      roundId: round.value.roundId,
      targetId,
      expectedTargetId,
      answerId: choice.id,
      actionId: round.value.targetAction.id,
      expected: round.value.targetAction.title,
      actual: choice.title,
      isCorrect: false
    });
    feedback.value = `Это другое действие. Покажи: ${round.value.targetAction.title}.`;
    promptAudio.cancelPending();
    await speakSceneText(feedback.value, session.settings.sound, 80);
  }

  isChangingRound.value = false;
}

function restart() {
  feedback.value = "Посмотри на картинки и покажи названное действие.";
  isChangingRound.value = false;
  promptAudio.cancelPending();
  cancelSceneSpeech();
  restartRoundGame();
  void playRoundPrompt(260);
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
  <GamePageShell gradient="linear-gradient(135deg, #eef8ff 0%, #fff7e8 50%, #f1ecff 100%)" padding-top="8.25rem">
    <template #hud>
      <GameHud title="Покажи действие" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="10">
          <v-card class="object-action-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Покажи действие</div>
            <div class="prompt-panel text-center mb-4">
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ round.prompt }}</h1>
              <div class="text-h6 text-md-h5 text-medium-emphasis">{{ feedback }}</div>
            </div>

            <GameChoiceCardGrid
              :choices="round.choices"
              :target-id="choiceTargetId"
              :disabled="session.status !== 'running' || isChangingRound"
              :dwell-ms="session.settings.dwellMs"
              :min-height="choiceMinHeight"
              :cols="6"
              :sm="6"
              :md="3"
              @select="chooseAction"
            >
              <template #default="{ choice }">
                <div class="action-scene" role="img" :aria-label="choice.sceneLabel">
                  <span class="action-scene__setting emoji-glyph" aria-hidden="true">{{ choice.settingEmoji }}</span>
                  <span class="action-scene__actor emoji-glyph" aria-hidden="true">{{ choice.actorEmoji }}</span>
                  <span class="action-scene__cue emoji-glyph" aria-hidden="true">{{ choice.cueEmoji }}</span>
                  <span class="action-scene__prop emoji-glyph" aria-hidden="true">{{ choice.propEmoji }}</span>
                </div>
                <div class="choice-title text-h5 text-md-h4 font-weight-bold mt-2">{{ choice.title }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Покажи действие" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.action-scene {
  align-items: center;
  background: linear-gradient(180deg, #e9f6ff 0%, #fff8e8 100%);
  border-radius: 1.25rem;
  display: grid;
  grid-template-areas:
    "setting setting setting"
    "actor cue prop";
  grid-template-columns: 1fr auto 1fr;
  min-block-size: 7.4rem;
  overflow: hidden;
  padding: 0.45rem 0.65rem 0.75rem;
}

.action-scene__setting {
  font-size: clamp(1.8rem, 3.5vw, 2.7rem);
  grid-area: setting;
  justify-self: end;
  line-height: 1;
  opacity: 0.72;
}

.action-scene__actor,
.action-scene__prop {
  font-size: clamp(3rem, 6vw, 4.8rem);
  line-height: 1;
}

.action-scene__actor {
  grid-area: actor;
  justify-self: end;
}

.action-scene__cue {
  font-size: clamp(1.7rem, 3vw, 2.5rem);
  grid-area: cue;
  line-height: 1;
  padding-inline: 0.2rem;
}

.action-scene__prop {
  grid-area: prop;
  justify-self: start;
}

.choice-title {
  color: #263238;
  line-height: 1.1;
  overflow-wrap: anywhere;
  text-align: center;
}

@media (max-height: 42rem) {
  .object-action-card {
    padding: 1rem !important;
  }

  .object-action-card > .text-overline {
    display: none;
  }

  .prompt-panel {
    margin-block-end: 0.75rem !important;
  }

  .prompt-panel h1 {
    font-size: 2rem !important;
    line-height: 1.08;
  }

  .prompt-panel .text-h6 {
    font-size: 0.98rem !important;
    line-height: 1.2;
  }

  .action-scene {
    min-block-size: 5.2rem;
  }

  .choice-title {
    font-size: 1.18rem !important;
  }
}
</style>
