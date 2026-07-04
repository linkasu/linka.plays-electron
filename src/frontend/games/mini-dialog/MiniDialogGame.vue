<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateMiniDialogRound, getMiniDialogChoice, getMiniDialogNextNodeId, isMiniDialogChoiceCorrect, miniDialogVoiceRoles, type MiniDialogChoice, type MiniDialogNodeId, type MiniDialogRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, finishSession, startSession } = useGameSessionFor("mini-dialog", {
  maxSteps: 7,
  overrides: { dwellMs: 1350, sessionSeconds: 135, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "mini-dialog",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["mini-dialog.partner.hello", "mini-dialog.partner.feeling", "mini-dialog.partner.ready", "mini-dialog.mistake", "mini-dialog.complete"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const roundIndex = ref(1);
const currentNodeId = ref<MiniDialogNodeId>("hello");
const round = ref<MiniDialogRound>(generateMiniDialogRound(roundIndex.value, Math.random, currentNodeId.value));
const feedback = ref("Послушай Миру и ответь.");
const isChangingRound = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const resultVisible = computed(() => session.status === "finished");

function choiceTargetId(choice: MiniDialogChoice) {
  return `mini-dialog:choice:${round.value.nodeId}:${choice.id}`;
}

function partnerAssetId() {
  return `mini-dialog.partner.${round.value.nodeId}`;
}

function correctAssetId(choice: MiniDialogChoice) {
  return `mini-dialog.correct.${round.value.nodeId}.${choice.id}`;
}

function mistakeAssetId() {
  return "mini-dialog.mistake";
}

function resetHighlights() {
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

function setRound(nodeId: MiniDialogNodeId) {
  currentNodeId.value = nodeId;
  round.value = generateMiniDialogRound(roundIndex.value, Math.random, nodeId);
}

async function playPartnerLine(delayMs = 0) {
  isChangingRound.value = true;
  await promptAudio.playSequenceAndWait([partnerAssetId()], delayMs);
  isChangingRound.value = false;
}

async function choose(choiceId: string) {
  if (session.status !== "running" || isChangingRound.value) return;

  const choice = getMiniDialogChoice(round.value, choiceId);
  const targetId = choiceTargetId(choice);
  const expectedTargetIds = round.value.choices.filter(isMiniDialogChoiceCorrect).map(choiceTargetId);
  isChangingRound.value = true;
  resetHighlights();

  if (isMiniDialogChoiceCorrect(choice)) {
    successChoiceId.value = choice.id;
    feedback.value = choice.confirmation;
    recordSuccess({
      roundId: round.value.roundId,
      nodeId: round.value.nodeId,
      targetId,
      answerId: choice.id,
      scenario: round.value.scenario,
      expected: expectedTargetIds,
      actual: choice.text,
      isCorrect: true
    });
    void pianoFeedback.playSuccess();
    const nextNodeId = getMiniDialogNextNodeId(choice);
    const finishedAfterSuccess = !nextNodeId || nextNodeId === "finish" || session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [correctAssetId(choice), "mini-dialog.complete"] : [correctAssetId(choice)], 80, 170);

    if (finishedAfterSuccess) {
      feedback.value = "Спасибо за диалог.";
      finishSession(nextNodeId === "finish" ? "game-complete" : "max-steps");
      isChangingRound.value = false;
      return;
    }

    roundIndex.value += 1;
    setRound(nextNodeId);
    resetHighlights();
    feedback.value = "Слушаем следующую реплику Миры.";
    await playPartnerLine(180);
    return;
  }

  wrongChoiceId.value = choice.id;
  feedback.value = "Послушай реплику ещё раз и выбери другой ответ.";
  recordMistake({
    roundId: round.value.roundId,
    nodeId: round.value.nodeId,
    targetId,
    expectedTargetIds,
    answerId: choice.id,
    scenario: round.value.scenario,
    expected: "dialog-appropriate-reply",
    actual: choice.text,
    isCorrect: false
  });
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait([mistakeAssetId()], 80);
  wrongChoiceId.value = undefined;
  isChangingRound.value = false;
}

function choiceColor(choice: MiniDialogChoice) {
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (isMiniDialogChoiceCorrect(choice)) return "surface";
  return "surface";
}

function restart() {
  promptAudio.cancelPending();
  roundIndex.value = 1;
  currentNodeId.value = "hello";
  round.value = generateMiniDialogRound(roundIndex.value, Math.random, currentNodeId.value);
  feedback.value = "Послушай Миру и ответь.";
  resetHighlights();
  isChangingRound.value = false;
  startSession();
  void playPartnerLine(220);
}

onMounted(() => {
  promptAudio.warm();
  void playPartnerLine(420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="mini-dialog-shell">
    <GameHud title="Мини-диалог" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="mini-dialog-card pa-4 pa-md-6" rounded="xl" elevation="8">
              <div class="text-overline text-secondary text-center mb-2">Живой AAC-диалог</div>

            <v-card class="partner-card pa-4 pa-md-5 mb-4" color="surface-variant" rounded="xl" variant="tonal">
              <div class="partner-layout">
                <div class="partner-person" :style="{ '--partner-color': round.character.color }">
                  <v-avatar class="partner-avatar" :color="round.character.color" size="112">
                    <v-icon color="white" :icon="round.character.icon" size="68" />
                  </v-avatar>
                  <div class="partner-expression emoji-glyph" aria-hidden="true">{{ round.expression }}</div>
                  <div class="text-h6 font-weight-bold mt-2">{{ round.character.name }}</div>
                  <div class="text-caption text-medium-emphasis">{{ round.character.role }}</div>
                  <v-chip class="mt-2" color="deep-purple" size="small" variant="tonal">{{ round.character.voiceLabel }}</v-chip>
                </div>

                <div class="speech-bubble">
                  <div class="text-caption text-medium-emphasis mb-1">{{ round.setting }}</div>
                  <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">{{ round.partnerLine }}</h1>
                  <div class="text-h6 text-medium-emphasis">{{ round.prompt }}</div>
                </div>
              </div>
              <div class="voice-legend d-flex flex-wrap justify-center ga-2 mt-3">
                <v-chip color="deep-purple" size="small" variant="tonal">{{ miniDialogVoiceRoles.partner }}</v-chip>
                <v-chip color="green" size="small" variant="tonal">{{ miniDialogVoiceRoles.correct }}</v-chip>
                <v-chip color="orange" size="small" variant="tonal">{{ miniDialogVoiceRoles.mistake }}</v-chip>
              </div>
            </v-card>

            <v-alert class="mb-4" :color="wrongChoiceId ? 'orange-lighten-5' : successChoiceId ? 'green-lighten-5' : 'blue-lighten-5'" rounded="xl" variant="flat">
              <div class="text-h6 text-md-h5 font-weight-bold text-center">{{ feedback }}</div>
            </v-alert>

            <v-row justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" :sm="round.choices.length === 2 ? 6 : 4" :md="round.choices.length === 2 ? 6 : 4">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="choose(choice.id)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph mb-2">{{ choice.emoji }}</div>
                    <div class="text-h5 text-md-h4 font-weight-bold">{{ choice.text }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Мини-диалог" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.mini-dialog-shell {
  background: linear-gradient(135deg, #eef8f4 0%, #f9f1ff 52%, #fff8e7 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.partner-layout {
  align-items: center;
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(9rem, 14rem) minmax(0, 1fr);
}

.partner-person {
  align-items: center;
  display: flex;
  flex-direction: column;
  text-align: center;
}

.partner-avatar {
  box-shadow: 0 1rem 2.2rem color-mix(in srgb, var(--partner-color) 22%, transparent);
}

.partner-expression {
  font-size: 3rem;
  line-height: 1;
  margin-block-start: -1.75rem;
  transform: translateX(2.75rem);
}

.speech-bubble {
  background: rgb(255 255 255 / 82%);
  border: 0.0625rem solid rgb(var(--v-theme-primary) / 12%);
  border-radius: 1.75rem;
  padding: 1.25rem 1.5rem;
  position: relative;
}

.speech-bubble::before {
  background: rgb(255 255 255 / 82%);
  block-size: 1.6rem;
  content: "";
  inline-size: 1.6rem;
  inset-block-start: 42%;
  inset-inline-start: -0.7rem;
  position: absolute;
  transform: rotate(45deg);
}

.choice-emoji {
  font-size: clamp(3.4rem, 7vw, 5.75rem);
  line-height: 1;
}

@media (max-width: 43.75rem) {
 .game-container {
    padding-block-start: 9.75rem;
  }

 .partner-layout {
    grid-template-columns: 1fr;
  }

 .speech-bubble::before {
    display: none;
  }
}

@media (max-height: 44rem) {
 .game-container {
    padding-block-start: 2.5rem;
  }

 .mini-dialog-card {
    padding: 1rem !important;
  }

 .partner-card {
    margin-block-end: 0.75rem !important;
    padding: 0.75rem !important;
  }

 .voice-legend {
    display: none !important;
  }

 .partner-layout {
    grid-template-columns: 8rem minmax(0, 1fr);
  }

 .partner-avatar {
    block-size: 4.5rem !important;
    inline-size: 4.5rem !important;
  }

 .partner-avatar.v-icon {
    font-size: 2.75rem !important;
  }

 .partner-expression {
    font-size: 2rem;
    margin-block-start: -1.25rem;
    transform: translateX(1.8rem);
  }

 .speech-bubble {
    padding: 0.75rem 1rem;
  }

 .speech-bubble h1 {
    font-size: 1.85rem !important;
    line-height: 1.08;
  }

 .game-container :deep(.dwell-button) {
    min-block-size: 8.75rem !important;
  }
}
</style>
