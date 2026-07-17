<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { cancelSceneSpeech, speakSceneText } from "../sceneSpeech";
import { createMiniDialogCommunication, generateMiniDialogRound, getMiniDialogChoice, getMiniDialogNextNodeId, miniDialogInstruction, type MiniDialogChoice, type MiniDialogNodeId, type MiniDialogRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, finishSession, startSession } = useGameSessionFor("mini-dialog", {
  maxSteps: 6,
  overrides: { dwellMs: 1350, sessionSeconds: 135, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const roundIndex = ref(1);
const round = ref<MiniDialogRound>(generateMiniDialogRound(roundIndex.value));
const feedback = ref("Твоя реплика будет озвучена.");
const isChangingRound = ref(false);
const selectedChoiceId = ref<string>();
const resultVisible = computed(() => session.status === "finished");

function choiceTargetId(choice: MiniDialogChoice) {
  return `mini-dialog:choice:${round.value.nodeId}:${choice.id}`;
}

function setRound(nodeId: MiniDialogNodeId) {
  round.value = generateMiniDialogRound(roundIndex.value, Math.random, nodeId);
}

async function playPartnerLine(delayMs = 0) {
  isChangingRound.value = true;
  await speakSceneText(round.value.partnerLine, session.settings.sound, delayMs);
  isChangingRound.value = false;
}

async function choose(choiceId: string) {
  if (session.status !== "running" || isChangingRound.value) return;

  const choice = getMiniDialogChoice(round.value, choiceId);
  const targetId = choiceTargetId(choice);
  const communication = createMiniDialogCommunication(choice);
  isChangingRound.value = true;
  selectedChoiceId.value = choice.id;
  feedback.value = `Ты сказал: «${communication.phrase}»`;
  recordSuccess({
    roundId: round.value.roundId,
    nodeId: round.value.nodeId,
    targetId,
    answerId: choice.id,
    scenario: round.value.scenario,
    choiceKind: choice.kind,
    ...communication
  });

  await speakSceneText(communication.phrase, session.settings.sound, 80);

  const requestedNodeId = getMiniDialogNextNodeId(choice);
  const nextNodeId = session.step >= session.maxSteps ? "finish" : requestedNodeId;
  roundIndex.value += 1;
  setRound(nextNodeId);
  selectedChoiceId.value = undefined;
  feedback.value = `Мира отвечает: «${round.value.partnerLine}»`;
  await playPartnerLine(160);

  if (round.value.isTerminal) {
    finishSession("game-complete");
    return;
  }

  feedback.value = round.value.prompt;
}

function restart() {
  cancelSceneSpeech();
  roundIndex.value = 1;
  round.value = generateMiniDialogRound(roundIndex.value);
  feedback.value = "Твоя реплика будет озвучена.";
  selectedChoiceId.value = undefined;
  isChangingRound.value = false;
  startSession();
  void playPartnerLine(220);
}

onMounted(() => {
  void playPartnerLine(420);
});

onUnmounted(() => {
  cancelSceneSpeech();
});
</script>

<template>
  <div class="mini-dialog-shell">
    <GameHud title="Мини-диалог" :step="session.step" :max-steps="session.maxSteps" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="mini-dialog-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <v-alert class="instruction mb-4" color="blue-lighten-5" icon="mdi-message-text-outline" rounded="xl" variant="flat">
              <div class="text-h6 text-md-h5 font-weight-bold">{{ miniDialogInstruction }}</div>
            </v-alert>

            <v-card class="partner-card pa-4 mb-4" color="deep-purple-lighten-5" rounded="xl" variant="flat">
              <div class="partner-layout">
                <div class="partner-person">
                  <v-avatar :color="round.character.color" size="clamp(4.8rem, 10dvh, 6.5rem)">
                    <v-icon color="white" :icon="round.character.icon" size="clamp(2.8rem, 6dvh, 4rem)" />
                  </v-avatar>
                  <div class="text-h6 font-weight-bold mt-2">{{ round.character.name }}</div>
                  <div class="text-body-2 text-medium-emphasis">{{ round.character.role }}</div>
                </div>

                <div class="speech-bubble">
                  <div class="d-flex align-center ga-3 mb-2">
                    <v-icon color="deep-purple-darken-3" :icon="round.sceneIcon" size="clamp(2.5rem, 6dvh, 4rem)" />
                    <h1 class="partner-line text-h4 text-md-h3 font-weight-bold">{{ round.partnerLine }}</h1>
                  </div>
                  <div class="text-h6 text-medium-emphasis">{{ round.prompt }}</div>
                </div>
              </div>
            </v-card>

            <div class="feedback text-h6 text-md-h5 font-weight-bold text-center mb-4">{{ feedback }}</div>

            <v-row v-if="!round.isTerminal" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="6" sm="3">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" min-height="clamp(7.5rem, 22dvh, 11.5rem)" :color="selectedChoiceId === choice.id ? choice.iconColor : choice.color" @select="choose(choice.id)">
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
    <GameResultDialog :model-value="resultVisible" title="Мини-диалог" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.mini-dialog-shell {
  background: linear-gradient(135deg, #eef8f4 0%, #f9f1ff 52%, #fff8e7 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 7.5rem;
}

.partner-layout {
  align-items: center;
  display: grid;
  gap: clamp(1rem, 3vw, 2rem);
  grid-template-columns: minmax(7rem, 11rem) minmax(0, 1fr);
}

.partner-person {
  align-items: center;
  display: flex;
  flex-direction: column;
  text-align: center;
}

.speech-bubble {
  background: rgb(255 255 255 / 86%);
  border: 0.0625rem solid rgb(var(--v-theme-primary) / 12%);
  border-radius: 1.75rem;
  padding: clamp(0.85rem, 2.5dvh, 1.4rem);
}

.partner-line,
.choice-text {
  line-height: 1.12;
}

.feedback {
  color: #263238;
  min-block-size: 1.5em;
}

@media (max-width: 43.75rem) {
  .game-container {
    padding-block-start: 9.5rem;
  }

  .partner-layout {
    grid-template-columns: 1fr;
  }

  .partner-person {
    display: none;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .mini-dialog-card {
    padding: 0.5rem !important;
  }

  .instruction {
    margin-block-end: 0.65rem !important;
    padding-block: 0.45rem !important;
  }

  .instruction .text-h6 {
    font-size: 0.95rem !important;
  }

  .partner-card {
    margin-block-end: 0.65rem !important;
    padding: 0.7rem !important;
  }

  .partner-layout {
    grid-template-columns: 6rem minmax(0, 1fr);
  }

  .partner-line {
    font-size: clamp(1.3rem, 4dvh, 1.8rem) !important;
  }

  .speech-bubble {
    padding: 0.65rem 0.85rem;
  }

  .speech-bubble .text-h6,
  .feedback {
    font-size: 1rem !important;
  }

  .feedback {
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
