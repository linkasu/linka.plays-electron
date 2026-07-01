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
import { generateObjectActionRound, isObjectActionCorrect, phraseForAction, type ObjectActionChoice, type ObjectActionRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, finishSession, startSession } = useGameSessionFor("object-action", { maxSteps: 8, finishOnMistakes: false, finishOnMaxSteps: false });
const promptAudio = useGamePromptAudio({
  gameId: "object-action",
  soundEnabled: toRef(session.settings, "sound"),
  volume: 0.34,
  warmAssetIds: ["object-action.intro", "object-action.next", "object-action.mistake", "object-action.complete"]
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<ObjectActionRound>({
  session,
  startSession,
  generateRound: generateObjectActionRound
});

const feedback = ref("Выбери действие, которое подходит к предмету.");
const isChangingRound = ref(false);
const choiceMinHeight = computed(() => Math.round(160 * session.settings.targetScale));

function choiceTargetId(choice: ObjectActionChoice) {
  return `object-action:choice:${round.value.pair.id}:${choice.id}`;
}

function phraseAssetId(pairId: string, actionId: string) {
  return `object-action.phrase.${pairId}-${actionId}`;
}

async function chooseAction(choice: ObjectActionChoice) {
  if (session.status !== "running" || isChangingRound.value) return;

  const targetId = choiceTargetId(choice);
  const expectedChoice = round.value.correctChoices[0];
  const expectedTargetId = expectedChoice ? choiceTargetId(expectedChoice) : targetId;
  const wasCorrect = isObjectActionCorrect(round.value.pair, choice);
  isChangingRound.value = true;

  if (wasCorrect) {
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      objectId: round.value.pair.id,
      expected: round.value.correctChoices.map((item) => item.title).join(" / "),
      actual: choice.title,
      isCorrect: true
    });
    feedback.value = `Подходит: ${phraseForAction(round.value.pair, choice.id)}.`;
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [phraseAssetId(round.value.pair.id, choice.id), "object-action.complete"] : [phraseAssetId(round.value.pair.id, choice.id)], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isChangingRound.value = false;
      return;
    }

    if (session.status === "running") {
      nextRound();
      feedback.value = "Новая пара. Выбери подходящее действие.";
      await promptAudio.playSequenceAndWait(["object-action.next"], 180);
    }
  } else {
    recordMistake({
      roundId: round.value.roundId,
      targetId,
      expectedTargetId,
      answerId: choice.id,
      objectId: round.value.pair.id,
      expected: round.value.correctChoices.map((item) => item.title).join(" / "),
      actual: choice.title,
      isCorrect: false
    });
    feedback.value = "Посмотри на предмет и попробуй выбрать другое действие.";
    await promptAudio.playSequenceAndWait(["object-action.mistake"], 80);
  }

  isChangingRound.value = false;
}

function restart() {
  feedback.value = "Выбери действие, которое подходит к предмету.";
  isChangingRound.value = false;
  restartRoundGame();
  promptAudio.cancelPending();
  promptAudio.play("object-action.intro", 260);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("object-action.intro", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #eef8ff 0%, #fff7e8 50%, #f1ecff 100%)" padding-top="8.25rem">
    <template #hud>
      <GameHud title="Предмет + действие" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="object-action-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC: предмет и действие</div>
            <div class="prompt-panel text-center mb-4">
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ round.prompt }}</h1>
              <div class="text-h6 text-md-h5 text-medium-emphasis">{{ feedback }}</div>
            </div>

            <v-card class="object-card pa-4 mb-4" color="primary" rounded="xl" variant="tonal">
              <div class="d-flex flex-column flex-md-row align-center justify-center ga-4 text-center">
                <div class="object-emoji emoji-glyph" aria-hidden="true">{{ round.pair.objectEmoji }}</div>
                <div>
                  <div class="text-overline text-primary">предмет</div>
                  <div class="text-h3 text-md-h2 font-weight-bold">{{ round.pair.objectTitle }}</div>
                </div>
              </div>
            </v-card>

            <GameChoiceCardGrid :choices="round.choices" :target-id="choiceTargetId" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="choiceMinHeight" :cols="6" :sm="6" :md="3" @select="chooseAction">
              <template #default="{ choice }">
                <div class="choice-emoji emoji-glyph" aria-hidden="true">{{ choice.emoji }}</div>
                <div class="choice-title text-h5 text-md-h4 font-weight-bold">{{ choice.title }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Предмет + действие" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.object-emoji {
  font-size: clamp(4rem, 10vw, 7rem);
  line-height: 1;
}

.choice-emoji {
  font-size: clamp(3.2rem, 7vw, 5.2rem);
  line-height: 1;
}

.choice-title {
  color: #263238;
  line-height: 1.1;
  overflow-wrap: anywhere;
  text-align: center;
}

@media (max-height: 51.25rem) {
  .object-card {
    display: none;
  }
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

  .choice-emoji {
    font-size: clamp(2.4rem, 5vw, 3.3rem);
  }

  .choice-title {
    font-size: 1.18rem !important;
  }

  .object-action-card :deep(.dwell-button) {
    min-block-size: 8.5rem !important;
  }
}
</style>
