<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { gameArtSrc } from "../../core/gameArt";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  createMiniDialogRoundGenerator,
  miniDialogPromptAssetId,
  miniDialogReplyAssetId,
  type MiniDialogReply,
  type MiniDialogRound,
} from "./model";

const router = useRouter();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  recordSuccess,
  recordMistake,
  startSession,
  finishSession,
} = useGameSessionFor("mini-dialog", {
  maxSteps: 8,
  overrides: { dwellMs: 1350, sessionSeconds: 135, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "mini-dialog",
  soundEnabled,
  warmAssetIds: ["mini-dialog.task.hello", "mini-dialog.mistake"],
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);
const generateRound = createMiniDialogRoundGenerator();

const {
  round,
  resultVisible,
  nextRound,
  restart: restartRounds,
} = useRoundGame<MiniDialogRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateRound(roundIndex),
});

const pending = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const choiceMinHeight = computed(() => "clamp(8.5rem, 27dvh, 15rem)");

function choiceTargetId(choice: MiniDialogReply) {
  return `mini-dialog:reply:${choice.id}`;
}

async function playRoundPrompt(delayMs = 0) {
  pending.value = true;
  await promptAudio.playSequenceAndWait([miniDialogPromptAssetId(round.value.situation)], delayMs);
  pending.value = false;
}

async function choose(choice: MiniDialogReply) {
  if (session.status !== "running" || pending.value) return;
  const expected = round.value.choices[round.value.correctIndex];

  if (choice.id === expected.id) {
    pending.value = true;
    successChoiceId.value = choice.id;
    recordSuccess({
      roundId: round.value.roundId,
      targetId: choiceTargetId(choice),
      answerId: choice.id,
      expected: expected.text,
      actual: choice.text,
      isCorrect: true,
      situation: round.value.situation.id,
    });
    void pianoFeedback.playSuccess();
    const finished = session.step >= session.maxSteps;
    // The child's reply is said aloud: «Привет!».
    await promptAudio.playSequenceAndWait([miniDialogReplyAssetId(choice)], 80, 200);
    successChoiceId.value = undefined;
    if (finished) {
      finishSession("game-complete");
      pending.value = false;
      return;
    }
    if (session.status === "running") {
      nextRound();
      await playRoundPrompt(160);
      return;
    }
    pending.value = false;
    return;
  }

  // No green hint after a mistake (testers): only the chosen card is marked.
  pending.value = true;
  wrongChoiceId.value = choice.id;
  recordMistake({
    roundId: round.value.roundId,
    targetId: choiceTargetId(choice),
    expectedTargetId: choiceTargetId(expected),
    answerId: choice.id,
    expected: expected.text,
    actual: choice.text,
    isCorrect: false,
    situation: round.value.situation.id,
  });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait(["mini-dialog.mistake"], 80);
  wrongChoiceId.value = undefined;
  pending.value = false;
}

function choiceColor(choice: MiniDialogReply) {
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  return "surface";
}

function restart() {
  promptAudio.cancelPending();
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
  restartRounds();
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
  <div class="mini-dialog-shell">
    <GameHud
      title="Мини-диалог"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />
    <v-container class="game-container game-hud-clear" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="dialog-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="situation">
              <img
                class="situation__mira"
                :src="gameArtSrc(round.situation.artId)"
                alt="Мира"
                draggable="false"
              />
              <div class="situation__text">
                <!-- What Mira says, in a speech bubble pointing at her. -->
                <div v-if="round.situation.miraLine" class="situation__bubble text-h5 text-md-h4">
                  {{ round.situation.miraLine }}
                </div>
                <h1 class="situation__prompt text-h5 text-md-h4 font-weight-bold">
                  {{ round.situation.prompt }}
                </h1>
              </div>
            </div>

            <GameChoiceCardGrid
              :choices="round.choices"
              :target-id="choiceTargetId"
              :disabled="session.status !== 'running' || pending"
              :dwell-ms="session.settings.dwellMs"
              :min-height="choiceMinHeight"
              :mistake-choice="(choice) => wrongChoiceId === choice.id"
              :color="choiceColor"
              @select="choose"
            >
              <template #default="{ choice }">
                <div class="reply">
                  <img class="reply__art" :src="gameArtSrc(choice.artId)" alt="" draggable="false" />
                  <div class="text-h6 text-md-h4 font-weight-bold">{{ choice.text }}</div>
                </div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog
      :model-value="resultVisible"
      title="Мини-диалог"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.mini-dialog-shell {
  background: var(--linka-scene-paper);
  min-block-size: 100vh;
}

.situation {
  align-items: center;
  display: flex;
  gap: clamp(1rem, 3vw, 2.5rem);
  justify-content: center;
  margin-block-end: clamp(0.75rem, 2.5dvh, 1.75rem);
}

.situation__mira {
  block-size: clamp(7rem, 24dvh, 15rem);
  flex: 0 0 auto;
  inline-size: clamp(7rem, 24dvh, 15rem);
  object-fit: contain;
}

.situation__text {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: clamp(0.4rem, 1.5dvh, 1rem);
  max-inline-size: 36rem;
}

.situation__bubble {
  /* Vuetify theme colours are "r,g,b": rgba(var(), a) works, rgb(var() / a) does not. */
  background: rgba(var(--v-theme-primary), 0.08);
  border: 0.18rem solid rgba(var(--v-theme-primary), 0.45);
  border-radius: 1.25rem;
  font-weight: 800;
  padding: 0.3rem 1rem;
  position: relative;
}

/* The bubble's tail, towards Mira. */
.situation__bubble::before {
  border-block: 0.55rem solid transparent;
  border-inline-end: 0.8rem solid rgba(var(--v-theme-primary), 0.45);
  content: "";
  inset-block-start: 50%;
  inset-inline-start: -0.85rem;
  position: absolute;
  transform: translateY(-50%);
}

.situation__prompt {
  line-height: 1.15;
}

.reply {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.reply__art {
  block-size: clamp(5rem, 19dvh, 11rem);
  inline-size: clamp(5rem, 19dvh, 11rem);
  object-fit: contain;
}
</style>
