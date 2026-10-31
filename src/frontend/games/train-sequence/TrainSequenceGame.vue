<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { gameArtSrc } from "../../core/gameArt";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  disposeTrainSequenceAudio,
  playTrainSequenceCompleteMelody,
  playTrainSequenceMistakeMelody,
  playTrainSequenceSuccessMelody,
  warmTrainSequenceAudio,
} from "./audio";
import {
  createTrainWagons,
  getOrderedTrainWagons,
  getPlacedTrainWagons,
  selectTrainWagon,
  trainLocomotiveArtId,
  type TrainWagon,
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
} = useGameSessionFor("train-sequence", {
  maxSteps: 5,
  overrides: { sound: true },
  finishOnMaxSteps: false,
});

const wagons = reactive<TrainWagon[]>([]);
const resultVisible = ref(false);
const trainDeparting = ref(false);
const feedbackMessage = ref("Прицепляй вагоны по порядку: от первого к пятому.");
const orderedWagons = computed(() => getOrderedTrainWagons(wagons));
const placedWagons = computed(() => getPlacedTrainWagons(wagons));
const currentRoundId = computed(() => `train-sequence:round:${session.step + 1}`);
const isSpeaking = ref(false);
const pendingSelection = ref(false);
const promptAudio = useGamePromptAudio({
  gameId: "train-sequence",
  soundEnabled: toRef(session.settings, "sound"),
});
let resultTimer = 0;

function wagonTargetId(wagon: TrainWagon) {
  return `train-sequence:wagon:${wagon.id}`;
}

function resetWagons() {
  wagons.splice(0, wagons.length, ...createTrainWagons());
}

function clearResultTimer() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["train-sequence.prompt"], delayMs);
  isSpeaking.value = false;
}

function scheduleResultDialog() {
  clearResultTimer();
  resultTimer = window.setTimeout(() => {
    resultVisible.value = true;
  }, 1800);
}

async function chooseWagon(wagon: TrainWagon) {
  if (session.status !== "running" || wagon.placed || pendingSelection.value || isSpeaking.value)
    return;

  const roundId = currentRoundId.value;
  const outcome = selectTrainWagon(wagons, wagon.id);
  if (outcome.kind === "ignored") return;

  pendingSelection.value = true;
  wagons.splice(0, wagons.length, ...outcome.wagons);

  if (outcome.isCorrect) {
    feedbackMessage.value = `Верно. Вагон ${outcome.selectedWagon.number} прицепился к поезду.`;
    recordSuccess({
      roundId,
      targetId: wagonTargetId(outcome.selectedWagon),
      expected: outcome.selectedWagon.id,
      actual: outcome.selectedWagon.id,
      isCorrect: true,
    });
    void playTrainSequenceSuccessMelody(session.settings.sound);
  } else {
    feedbackMessage.value = `Сейчас нужен вагон ${outcome.expectedWagon?.number ?? "по порядку"}. Попробуй ещё раз.`;
    recordMistake({
      roundId,
      targetId: wagonTargetId(outcome.selectedWagon),
      expectedTargetId: outcome.expectedWagon ? wagonTargetId(outcome.expectedWagon) : undefined,
      expected: outcome.expectedWagon?.id,
      actual: outcome.selectedWagon.id,
      isCorrect: false,
    });
    void playTrainSequenceMistakeMelody(session.settings.sound);
  }

  isSpeaking.value = true;

  if (outcome.isComplete && session.status === "running") {
    feedbackMessage.value = "Поезд собран. Он отправляется в путь.";
    trainDeparting.value = true;
    finishSession("game-complete");
    void playTrainSequenceCompleteMelody(session.settings.sound);
    await promptAudio.playSequenceAndWait(
      [
        outcome.isCorrect ? "train-sequence.correct" : "train-sequence.mistake",
        "train-sequence.complete",
      ],
      80,
      170,
    );
    isSpeaking.value = false;
    pendingSelection.value = false;
    scheduleResultDialog();
    return;
  }

  await promptAudio.playSequenceAndWait(
    [outcome.isCorrect ? "train-sequence.correct" : "train-sequence.mistake"],
    80,
  );
  isSpeaking.value = false;
  pendingSelection.value = false;
}

function restart() {
  clearResultTimer();
  promptAudio.cancelPending();
  resultVisible.value = false;
  trainDeparting.value = false;
  isSpeaking.value = false;
  pendingSelection.value = false;
  feedbackMessage.value = "Прицепляй вагоны по порядку: от первого к пятому.";
  resetWagons();
  startSession();
  void playPrompt(450);
}

resetWagons();

onMounted(() => {
  promptAudio.warm();
  warmTrainSequenceAudio(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearResultTimer();
  promptAudio.cancelPending();
  disposeTrainSequenceAudio();
});

watch(
  () => session.status,
  (status) => {
    if (status === "finished" && session.finishReason !== "game-complete") {
      clearResultTimer();
      resultVisible.value = true;
      return;
    }
    if (status !== "finished") {
      clearResultTimer();
      resultVisible.value = false;
    }
  },
);
</script>

<template>
  <div class="train-shell">
    <GameHud
      title="Поезд"
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
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Собери поезд</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">
              Прицепи пять вагонов по номерам. Поезд примет каждый выбор, а порядок видно на
              вагонах.
            </p>

            <v-card
              class="hint-card pa-4 pa-md-5 mb-6"
              color="blue-lighten-5"
              rounded="xl"
              variant="flat"
            >
              <div class="text-caption text-medium-emphasis mb-1">Правило</div>
              <div class="d-flex flex-wrap align-center ga-3">
                <v-avatar
                  v-for="wagon in orderedWagons"
                  :key="`rule-${wagon.id}`"
                  :color="wagon.color"
                  size="3.5rem"
                  ><span class="text-h5 font-weight-bold">{{ wagon.number }}</span></v-avatar
                >
                <div class="text-h6 font-weight-bold">Собирай поезд от 1 к 5.</div>
              </div>
            </v-card>

            <div class="play-area">
              <v-card class="track-card pa-5" color="cyan-lighten-5" rounded="xl" variant="flat">
                <div
                  :class="['train-track', { 'train-track--departing': trainDeparting }]"
                  aria-label="Собранный поезд"
                >
                  <img class="locomotive" :src="gameArtSrc(trainLocomotiveArtId)" alt="" />
                  <div
                    v-for="wagon in placedWagons"
                    :key="`placed-${wagon.id}`"
                    class="track-wagon"
                  >
                    <img class="wagon-art" :src="gameArtSrc(wagon.artId)" alt="" />
                    <span class="wagon-number">{{ wagon.number }}</span>
                  </div>
                </div>
                <div class="rail" />
                <div class="text-body-1 text-center text-medium-emphasis mt-5">
                  {{ feedbackMessage }}
                </div>
              </v-card>

              <div class="wagon-grid">
                <GameDwellButton
                  v-for="wagon in wagons"
                  :key="wagon.id"
                  :target-id="wagonTargetId(wagon)"
                  :disabled="
                    session.status !== 'running' || wagon.placed || pendingSelection || isSpeaking
                  "
                  :dwell-ms="session.settings.dwellMs"
                  :hit-padding="3"
                  min-height="9.375rem"
                  color="surface"
                  @select="chooseWagon(wagon)"
                >
                  <template #default>
                    <div class="wagon-card-content" :style="{ opacity: wagon.placed ? 0.28 : 1 }">
                      <div class="loose-wagon">
                        <img class="wagon-art" :src="gameArtSrc(wagon.artId)" alt="" />
                        <span class="wagon-number">{{ wagon.number }}</span>
                      </div>
                      <div class="text-subtitle-1 font-weight-bold mt-3">{{ wagon.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog
      :model-value="resultVisible"
      title="Поезд"
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
.train-shell {
  background: var(--linka-scene-paper);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.hint-card {
  border: 0.125rem solid rgb(var(--v-theme-primary) / 18%);
}

.play-area {
  align-items: stretch;
  display: grid;
  gap: 1.75rem;
  grid-template-columns: 1.25fr 1fr;
}

.track-card {
  min-inline-size: 0;
  overflow: hidden;
}

.train-track {
  align-items: flex-end;
  display: flex;
  gap: 0.75rem;
  min-block-size: 16.25rem;
  min-inline-size: max-content;
  padding-block-start: 4.5rem;
  transition: transform 1800ms ease-in;
}

.train-track--departing {
  transform: translateX(-42%);
}

.locomotive,
.track-wagon,
.loose-wagon {
  filter: drop-shadow(0 0.5rem 0.6rem rgb(69 90 100 / 18%));
  position: relative;
}

.locomotive {
  block-size: 7rem;
  inline-size: auto;
  object-fit: contain;
}

.track-wagon,
.loose-wagon {
  align-items: center;
  color: #263238;
  display: flex;
  font-size: 2.4rem;
  font-weight: 800;
  justify-content: center;
}

.wagon-art {
  block-size: 100%;
  inline-size: 100%;
  object-fit: contain;
}

/* The order number sits on the wagon's side, as on the hint row above. */
.wagon-number {
  align-items: center;
  background: rgb(255 255 255 / 92%);
  border-radius: 999rem;
  display: flex;
  font-size: 0.6em;
  inline-size: 1.7em;
  block-size: 1.7em;
  inset-block-start: 22%;
  justify-content: center;
  position: absolute;
}

.track-wagon {
  block-size: 6.5rem;
  inline-size: 8.25rem;
}

.loose-wagon {
  block-size: 4.625rem;
  inline-size: min(11.875rem, 100%);
  margin-inline: auto;
}

.rail {
  background: linear-gradient(
    90deg,
    #8d6e63 0 8%,
    transparent 8% 14%,
    #8d6e63 14% 22%,
    transparent 22% 28%,
    #8d6e63 28% 36%,
    transparent 36% 42%,
    #8d6e63 42% 50%,
    transparent 50% 56%,
    #8d6e63 56% 64%,
    transparent 64% 70%,
    #8d6e63 70% 78%,
    transparent 78% 84%,
    #8d6e63 84% 92%,
    transparent 92% 100%
  );
  block-size: 0.875rem;
  border-block: 0.25rem solid #6d4c41;
  border-radius: 999rem;
}

.wagon-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.wagon-card-content {
  inline-size: 100%;
}

@media (max-width: 68.75rem) {
  .play-area {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 6.5rem;
  }

  .train-track {
    gap: 0.5rem;
    transform-origin: left bottom;
  }

  .locomotive {
    block-size: 5.75rem;
  }

  .track-wagon {
    inline-size: 6.625rem;
  }

  .wagon-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 50rem) {
  .game-container {
    padding-block-start: 6.5rem;
  }

  .game-container :deep(.v-card.pa-5) {
    padding: 1rem !important;
  }

  .game-container p,
  .track-card .text-body-1 {
    display: none;
  }

  .hint-card {
    margin-block-end: 0.25rem !important;
    padding: 0.5rem 0.75rem !important;
  }

  .hint-card :deep(.v-avatar) {
    block-size: 2.25rem !important;
    inline-size: 2.25rem !important;
  }

  .hint-card .text-h6 {
    font-size: 1rem !important;
  }

  .play-area {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* One row of wagons, so the train being built stays on screen on a
     laptop window (about 690 px high) too. */
  .wagon-grid {
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    order: -1;
  }

  .wagon-grid :deep(.dwell-button) {
    min-block-size: 7.5rem !important;
  }

  .track-card {
    padding: 0.75rem !important;
  }

  .train-track {
    min-block-size: 9.375rem;
    padding-block-start: 2rem;
  }

  .loose-wagon {
    block-size: 3.375rem;
  }
}
</style>
