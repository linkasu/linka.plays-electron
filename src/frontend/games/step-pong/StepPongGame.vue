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
import { stepPongChoiceOutcome } from "./model";

type PaddleLaneId = "top" | "middle" | "bottom";

type PaddleLane = {
  id: PaddleLaneId;
  label: string;
  hint: string;
  icon: string;
  color: string;
  y: number;
};

type PongRound = {
  roundId: string;
  incomingLane: PaddleLane;
  returnLane: PaddleLane;
};

const lanes: PaddleLane[] = [
  {
    id: "top",
    label: "Верхняя позиция",
    hint: "поднять ракетку",
    icon: "mdi-arrow-up-bold-box-outline",
    color: "blue-lighten-5",
    y: 17,
  },
  {
    id: "middle",
    label: "Средняя позиция",
    hint: "держать ракетку ровно",
    icon: "mdi-arrow-right-bold-box-outline",
    color: "teal-lighten-5",
    y: 50,
  },
  {
    id: "bottom",
    label: "Нижняя позиция",
    hint: "опустить ракетку",
    icon: "mdi-arrow-down-bold-box-outline",
    color: "amber-lighten-5",
    y: 83,
  },
];

const incomingSequence: PaddleLaneId[] = [
  "middle",
  "top",
  "bottom",
  "middle",
  "bottom",
  "top",
  "middle",
  "top",
  "bottom",
  "middle",
];
const returnSequence: PaddleLaneId[] = [
  "top",
  "middle",
  "middle",
  "bottom",
  "top",
  "bottom",
  "top",
  "bottom",
  "middle",
  "top",
];

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
  recordHint,
  startSession,
  finishSession,
} = useGameSessionFor("step-pong", {
  maxSteps: 10,
  overrides: { targetScale: 1.2, motionSpeed: 0.55, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "step-pong",
  soundEnabled,
  warmAssetIds: [
    "step-pong.prompt",
    "step-pong.correct",
    "step-pong.mistake",
    "step-pong.complete",
  ],
});
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const selectedLaneId = ref<PaddleLaneId>("middle");
const lastMistakeLaneId = ref<PaddleLaneId>();
const lastSuccessLaneId = ref<PaddleLaneId>();
const hintStrength = ref(0);
const feedbackText = ref("Посмотри, откуда летит мяч, и выбери позицию ракетки для удара.");
const isSpeaking = ref(false);
const animationMode = ref<"incoming" | "return" | "miss">("incoming");

function laneById(id: PaddleLaneId) {
  return lanes.find((lane) => lane.id === id) ?? lanes[1];
}

function generateRound(roundIndex: number): PongRound {
  const index = (roundIndex - 1) % incomingSequence.length;
  return {
    roundId: `step-pong:round:${roundIndex}`,
    incomingLane: laneById(incomingSequence[index]),
    returnLane: laneById(returnSequence[index]),
  };
}

const {
  round,
  resultVisible,
  nextRound,
  restart: restartRoundGame,
} = useRoundGame({
  session,
  startSession,
  generateRound,
});

const selectedLane = computed(() => laneById(selectedLaneId.value));
const ballStyle = computed(() => ({
  "--ball-y": `${round.value.incomingLane.y}%`,
  "--return-y": `${round.value.returnLane.y}%`,
  "--paddle-y": `${selectedLane.value.y}%`,
  "--shot-angle": `${(round.value.returnLane.y - round.value.incomingLane.y) * 0.22}deg`,
  // Testers (recheck): «мяч летит так быстро, что ребёнок не успевает посмотреть, куда
  // поставить блок». The ball flew in 1.1 s and started again every 1.8 s; now it flies once,
  // slowly, and waits in front of the paddle until a place is chosen.
  "--incoming-ms": `${Math.round(2000 / Math.max(0.3, session.settings.motionSpeed))}ms`,
}));
const ballDirection: Record<PaddleLaneId, string> = {
  top: "вверх",
  middle: "в середину",
  bottom: "вниз",
};
const helperText = computed(() => `Мяч летит ${ballDirection[round.value.incomingLane.id]}.`);

function laneTargetId(lane: PaddleLane) {
  return `step-pong:lane:${lane.id}`;
}

async function chooseLane(lane: PaddleLane) {
  if (session.status !== "running" || isSpeaking.value) return;

  selectedLaneId.value = lane.id;
  const targetId = laneTargetId(lane);
  const expectedTargetId = laneTargetId(round.value.incomingLane);

  if (lane.id !== round.value.incomingLane.id) {
    const outcome = stepPongChoiceOutcome(false, session.mistakes + 1);
    animationMode.value = "miss";
    lastMistakeLaneId.value = lane.id;
    lastSuccessLaneId.value = undefined;
    hintStrength.value = Math.min(3, hintStrength.value + 1);
    feedbackText.value =
      outcome === "loss"
        ? "Третья сложная позиция: мяч остановился. Раунд завершён, можно начать заново."
        : "Мяч остался в игре. Посмотри, куда летит мяч, и выбери место для ракетки.";
    recordMistake({
      roundId: round.value.roundId,
      targetId,
      expectedTargetId,
      expected: round.value.incomingLane.label,
      actual: lane.label,
      outcome,
      isCorrect: false,
    });
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(
      outcome === "loss" ? ["step-pong.mistake", "step-pong.complete"] : ["step-pong.mistake"],
      80,
      170,
    );
    if (outcome === "loss") {
      finishSession("game-lost");
      isSpeaking.value = false;
      return;
    }
    recordHint({
      roundId: round.value.roundId,
      targetId: expectedTargetId,
      reason: "step-pong-lane",
      strength: hintStrength.value,
    });
    animationMode.value = "incoming";
    isSpeaking.value = false;
    return;
  }

  animationMode.value = "return";
  lastMistakeLaneId.value = undefined;
  lastSuccessLaneId.value = lane.id;
  hintStrength.value = 0;
  feedbackText.value = `Верно. ${lane.hint}. Мяч отбит к партнёру.`;
  recordSuccess({
    roundId: round.value.roundId,
    targetId,
    answerId: lane.id,
    returnLane: round.value.returnLane.id,
    expected: round.value.incomingLane.label,
    actual: lane.label,
    isCorrect: true,
  });
  const willFinish = session.step >= session.maxSteps;
  isSpeaking.value = true;
  void feedbackAudio.playSuccess();
  await promptAudio.playSequenceAndWait(
    willFinish ? ["step-pong.correct", "step-pong.complete"] : ["step-pong.correct"],
    80,
    170,
  );
  if (willFinish) {
    finishSession("game-complete");
    animationMode.value = "incoming";
    isSpeaking.value = false;
    return;
  }
  if (session.status === "running") nextRound();
  animationMode.value = "incoming";
  isSpeaking.value = false;
}

function laneState(lane: PaddleLane) {
  if (lastMistakeLaneId.value === lane.id) return "mistake";
  if (lastSuccessLaneId.value === lane.id) return "success";
  // No highlight of the right zone after a mistake (decision of 2026-11-06 for all games).
  return "idle";
}

function restart() {
  promptAudio.cancelPending();
  selectedLaneId.value = "middle";
  lastMistakeLaneId.value = undefined;
  lastSuccessLaneId.value = undefined;
  hintStrength.value = 0;
  animationMode.value = "incoming";
  isSpeaking.value = false;
  feedbackText.value = "Посмотри, откуда летит мяч, и выбери позицию ракетки для удара.";
  restartRoundGame();
  promptAudio.play("step-pong.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("step-pong.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="step-pong-shell">
    <GameHud
      title="Понг пошаговый"
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
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div
              class="game-header d-flex flex-column flex-lg-row align-lg-center justify-space-between ga-4 mb-5"
            >
              <div>
                <div class="text-overline text-secondary mb-1">Strategy/control: выбор позиции</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">
                  Поставь ракетку перед ударом
                </h1>
                <p class="game-feedback text-body-1 text-md-h6 text-medium-emphasis mb-0">
                  {{ feedbackText }}
                </p>
              </div>
              <v-chip class="game-helper" color="primary" size="large" variant="tonal">
                {{ helperText }}
              </v-chip>
            </div>

            <!-- User: «управление рядом с ракеткой: выбор нужного положения непосредственно
                 рядом с ракеткой». Three zones over the paddle's column: look at one and the
                 paddle moves there. -->
            <v-card
              class="pong-board pa-2 pa-md-3"
              color="cyan-lighten-5"
              rounded="xl"
              variant="flat"
            >
              <div
                class="pong-stage"
                :class="`pong-stage--${animationMode}`"
                :style="ballStyle"
                aria-label="Поле пошагового понга"
              >
                <div class="partner-paddle" aria-hidden="true" />
                <div class="net" aria-hidden="true" />

                <div class="lane-markers" aria-label="Линии прилёта мяча">
                  <div
                    v-for="lane in lanes"
                    :key="lane.id"
                    class="lane-marker"
                    :class="{ 'lane-marker--active': lane.id === round.incomingLane.id }"
                    :style="{ '--lane-y': `${lane.y}%` }"
                  />
                </div>

                <div class="incoming-path" aria-hidden="true" />
                <div class="return-path" aria-hidden="true" />
                <div
                  :key="`${round.roundId}:${animationMode}`"
                  class="pong-ball"
                  aria-hidden="true"
                />
                <div
                  class="player-paddle"
                  :class="{
                    'player-paddle--hint': hintStrength > 0,
                    'player-paddle--success': lastSuccessLaneId === selectedLaneId,
                  }"
                  aria-hidden="true"
                />

                <div class="paddle-zones">
                  <GameDwellButton
                    v-for="lane in lanes"
                    :key="lane.id"
                    class="paddle-zone"
                    :class="`paddle-zone--${laneState(lane)}`"
                    :target-id="laneTargetId(lane)"
                    :disabled="session.status !== 'running' || isSpeaking"
                    :dwell-ms="session.settings.dwellMs"
                    min-height="0"
                    color="transparent"
                    @select="chooseLane(lane)"
                  >
                    <template #default>
                      <span class="d-sr-only">{{ lane.label }}</span>
                      <div
                        v-if="lane.id !== selectedLaneId"
                        class="paddle-ghost"
                        aria-hidden="true"
                      />
                    </template>
                  </GameDwellButton>
                </div>
              </div>
            </v-card>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Понг пошаговый"
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
.step-pong-shell {
  background: var(--linka-scene-paper);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.pong-board {
  min-block-size: 0;
}

.pong-stage {
  background:
    radial-gradient(circle at 50% 50%, rgb(255 255 255 / 78%) 0%, transparent 36%),
    linear-gradient(180deg, #e9fbff 0%, #f8fffb 100%);
  /* The field takes the height under the HUD and the title. */
  block-size: clamp(18rem, calc(100dvh - 21rem), 38rem);
  border: 0.25rem solid rgb(var(--v-theme-primary) / 14%);
  border-radius: 1.6rem;
  overflow: hidden;
  position: relative;
}

.net {
  background: repeating-linear-gradient(
    180deg,
    rgb(var(--v-theme-primary) / 22%) 0 1.2rem,
    transparent 1.2rem 2rem
  );
  block-size: 80%;
  inline-size: 0.25rem;
  inset-block: 10%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.partner-paddle,
.player-paddle {
  border-radius: 999px;
  box-shadow: 0 0.8rem 1.6rem rgb(38 86 120 / 18%);
  inline-size: clamp(1.2rem, 2.2vw, 1.7rem);
  position: absolute;
  transform: translateY(-50%);
  z-index: 3;
}

.partner-paddle {
  background: linear-gradient(180deg, #90caf9 0%, #42a5f5 100%);
  block-size: clamp(6rem, 17vh, 8.4rem);
  inset-block-start: var(--return-y);
  inset-inline-start: 8%;
}

.player-paddle {
  background: linear-gradient(180deg, #26a69a 0%, #00897b 100%);
  block-size: clamp(5rem, 18vh, 9rem);
  inset-block-start: var(--paddle-y);
  inset-inline-end: calc(11% - clamp(0.6rem, 1.1vw, 0.85rem));
  transition:
    inset-block-start 260ms ease,
    box-shadow 220ms ease;
}

.player-paddle--hint {
  box-shadow:
    0 0 0 0.35rem rgb(var(--v-theme-primary) / 28%),
    0 0.8rem 1.6rem rgb(var(--v-theme-primary) / 18%);
}

.player-paddle--success {
  box-shadow:
    0 0 0 0.35rem rgb(var(--v-theme-success) / 28%),
    0 0.8rem 1.6rem rgb(var(--v-theme-success) / 18%);
}

.lane-marker {
  align-items: center;
  background: rgb(255 255 255 / 52%);
  block-size: clamp(3.7rem, 9vh, 5.2rem);
  border: 0.16rem dashed rgb(var(--v-theme-primary) / 14%);
  border-radius: 999px;
  display: flex;
  inline-size: min(72%, 30rem);
  inset-block-start: var(--lane-y);
  inset-inline: 14%;
  justify-content: flex-end;
  padding-inline-end: 12%;
  position: absolute;
  transform: translateY(-50%);
}

.lane-marker--active {
  background: rgb(var(--v-theme-primary) / 9%);
  border-color: rgb(var(--v-theme-primary) / 38%);
}

.incoming-path,
.return-path {
  block-size: 0.5rem;
  border-radius: 999px;
  position: absolute;
  transform-origin: 100% 50%;
  z-index: 1;
}

.incoming-path {
  background: linear-gradient(
    90deg,
    rgb(var(--v-theme-primary) / 0%),
    rgb(var(--v-theme-primary) / 42%)
  );
  animation: path-pulse 1.8s ease-in-out infinite;
  inline-size: 62%;
  inset-block-start: var(--ball-y);
  inset-inline-start: 22%;
  transform: rotate(var(--shot-angle));
}

.return-path {
  background: linear-gradient(
    90deg,
    rgb(var(--v-theme-success) / 42%),
    rgb(var(--v-theme-success) / 0%)
  );
  inline-size: 42%;
  inset-block-start: var(--return-y);
  inset-inline-start: 14%;
  opacity: 0.62;
}

.pong-stage--return .return-path {
  animation: return-path-flash 900ms ease-out;
}

.pong-ball {
  animation: ball-incoming var(--incoming-ms, 3600ms) ease-out 1 both;
  background: radial-gradient(circle at 35% 30%, #ffffff 0 18%, #ffd54f 20% 64%, #fb8c00 100%);
  block-size: clamp(2.8rem, 6vw, 4rem);
  border-radius: 999px;
  box-shadow: 0 0 1.3rem rgb(251 140 0 / 26%);
  inline-size: clamp(2.8rem, 6vw, 4rem);
  inset-block-start: var(--ball-y);
  inset-inline-end: 17%;
  position: absolute;
  transform: translate(50%, -50%);
  transition: inset-block-start 260ms ease;
  z-index: 4;
}

.pong-stage--return .pong-ball {
  animation: ball-return 900ms cubic-bezier(0.2, 0.76, 0.22, 1) both;
}

.pong-stage--miss .pong-ball {
  animation: ball-miss 850ms ease-in both;
}

.pong-stage--return .player-paddle {
  animation: paddle-hit 520ms ease-out;
}

@keyframes ball-incoming {
  0% {
    inset-inline-end: 78%;
    opacity: 0.7;
    transform: translate(50%, -50%) scale(0.86);
  }
  100% {
    inset-inline-end: 17%;
    opacity: 1;
    transform: translate(50%, -50%) scale(1);
  }
}

@keyframes ball-return {
  0% {
    inset-block-start: var(--ball-y);
    inset-inline-end: 17%;
    opacity: 1;
    transform: translate(50%, -50%) scale(1.08);
  }
  100% {
    inset-block-start: var(--return-y);
    inset-inline-end: 78%;
    opacity: 0.9;
    transform: translate(50%, -50%) scale(0.86);
  }
}

@keyframes ball-miss {
  0% {
    inset-inline-end: 17%;
    opacity: 1;
    transform: translate(50%, -50%) scale(1);
  }
  100% {
    inset-inline-end: 5%;
    opacity: 0.28;
    transform: translate(50%, 130%) scale(0.82);
  }
}

@keyframes path-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  48% {
    opacity: 0.95;
  }
}

@keyframes return-path-flash {
  0% {
    opacity: 0.18;
    transform: scaleX(0.35);
  }
  55% {
    opacity: 0.95;
    transform: scaleX(1);
  }
  100% {
    opacity: 0.38;
    transform: scaleX(1);
  }
}

@keyframes paddle-hit {
  0%,
  100% {
    transform: translateY(-50%) scaleX(1);
  }
  45% {
    transform: translateY(-50%) scaleX(1.32);
  }
}

/* The paddle's column: three gaze zones, each a third of the field high. */
.paddle-zones {
  display: grid;
  gap: 0.35rem;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  inline-size: 16%;
  inset-block: 0.35rem;
  inset-inline-end: 3%;
  position: absolute;
  z-index: 5;
}

.paddle-zone,
.paddle-zone :deep(.dwell-button) {
  block-size: 100%;
}

.paddle-zone :deep(.dwell-button) {
  align-items: center;
  border: 0.18rem dashed rgba(var(--v-theme-primary), 0.3);
  justify-content: center;
  padding: 0 !important;
}

.paddle-zone--mistake :deep(.dwell-button) {
  background: rgba(255, 152, 0, 0.18) !important;
}

.paddle-zone--success :deep(.dwell-button) {
  background: rgba(76, 175, 80, 0.18) !important;
}

/* Where the paddle will stand if this zone is chosen. */
.paddle-ghost {
  block-size: clamp(5rem, 18vh, 9rem);
  border: 0.2rem dashed rgba(0, 137, 123, 0.55);
  border-radius: 999px;
  inline-size: clamp(1.2rem, 2.2vw, 1.7rem);
  max-block-size: 85%;
}

@media (max-width: 60rem) {
  .game-container {
    padding-block-start: 9.5rem;
  }
}

@media (min-width: 43.75rem) and (max-height: 57.5rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .game-feedback,
  .game-helper,
  .game-note,
  .text-overline {
    display: none;
  }

  .game-header {
    margin-block-end: 0.75rem !important;
  }
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 11rem;
  }

  .pong-board {
    min-block-size: 27rem;
  }

  .pong-stage {
    block-size: 25rem;
  }
}
</style>
