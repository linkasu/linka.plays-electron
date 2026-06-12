<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
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
  { id: "top", label: "Верхняя позиция", hint: "поднять ракетку", icon: "mdi-arrow-up-bold-box-outline", color: "blue-lighten-5", y: 25 },
  { id: "middle", label: "Средняя позиция", hint: "держать ракетку ровно", icon: "mdi-arrow-right-bold-box-outline", color: "teal-lighten-5", y: 50 },
  { id: "bottom", label: "Нижняя позиция", hint: "опустить ракетку", icon: "mdi-arrow-down-bold-box-outline", color: "amber-lighten-5", y: 75 }
];

const incomingSequence: PaddleLaneId[] = ["middle", "top", "bottom", "middle", "bottom", "top", "middle", "top", "bottom", "middle"];
const returnSequence: PaddleLaneId[] = ["top", "middle", "middle", "bottom", "top", "bottom", "top", "bottom", "middle", "top"];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSession("step-pong", {
  maxSteps: 10,
  dwellMs: 1200,
  sessionSeconds: 180,
  targetScale: 1.2,
  motionSpeed: 0.55
}, {
  finishOnMistakes: false
});

const selectedLaneId = ref<PaddleLaneId>("middle");
const lastMistakeLaneId = ref<PaddleLaneId>();
const lastSuccessLaneId = ref<PaddleLaneId>();
const hintStrength = ref(0);
const feedbackText = ref("Посмотри, откуда летит мяч, и выбери позицию ракетки для мягкого удара.");

function laneById(id: PaddleLaneId) {
  return lanes.find((lane) => lane.id === id) ?? lanes[1];
}

function generateRound(roundIndex: number): PongRound {
  const index = (roundIndex - 1) % incomingSequence.length;
  return {
    roundId: `step-pong:round:${roundIndex}`,
    incomingLane: laneById(incomingSequence[index]),
    returnLane: laneById(returnSequence[index])
  };
}

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound
});

const selectedLane = computed(() => laneById(selectedLaneId.value));
const ballStyle = computed(() => ({
  "--ball-y": `${round.value.incomingLane.y}%`,
  "--return-y": `${round.value.returnLane.y}%`,
  "--paddle-y": `${selectedLane.value.y}%`,
  "--shot-angle": `${(round.value.returnLane.y - round.value.incomingLane.y) * 0.22}deg`
}));
const helperText = computed(() => hintStrength.value > 0
  ? `Мяч не потерялся. Подсказка: нужна ${round.value.incomingLane.label.toLowerCase()}.`
  : `Мяч летит в ${round.value.incomingLane.label.toLowerCase()}.`);

function laneTargetId(lane: PaddleLane) {
  return `step-pong:lane:${lane.id}`;
}

function chooseLane(lane: PaddleLane) {
  if (session.status !== "running") return;

  selectedLaneId.value = lane.id;
  const targetId = laneTargetId(lane);
  const expectedTargetId = laneTargetId(round.value.incomingLane);

  if (lane.id !== round.value.incomingLane.id) {
    const outcome = stepPongChoiceOutcome(false, session.mistakes + 1);
    lastMistakeLaneId.value = lane.id;
    lastSuccessLaneId.value = undefined;
    hintStrength.value = Math.min(3, hintStrength.value + 1);
    feedbackText.value = outcome === "loss"
      ? "Третья неверная позиция: мяч пропущен, партия проиграна."
      : "Мяч мягко остался в игре. Подсказка показывает, куда поставить ракетку.";
    recordMistake({
      roundId: round.value.roundId,
      targetId,
      expectedTargetId,
      expected: round.value.incomingLane.label,
      actual: lane.label,
      outcome,
      isCorrect: false
    });
    if (outcome === "loss") {
      finishSession("game-lost");
      return;
    }
    recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "step-pong-lane", strength: hintStrength.value });
    return;
  }

  lastMistakeLaneId.value = undefined;
  lastSuccessLaneId.value = lane.id;
  hintStrength.value = 0;
  feedbackText.value = `Верно: ${lane.hint}. Мяч спокойно отбит к партнёру.`;
  recordSuccess({
    roundId: round.value.roundId,
    targetId,
    answerId: lane.id,
    returnLane: round.value.returnLane.id,
    expected: round.value.incomingLane.label,
    actual: lane.label,
    isCorrect: true
  });
  if (session.status === "running") nextRound();
}

function laneColor(lane: PaddleLane) {
  if (hintStrength.value > 0 && lane.id === round.value.incomingLane.id) return "primary";
  if (lastMistakeLaneId.value === lane.id) return "warning";
  if (lastSuccessLaneId.value === lane.id) return "success";
  return lane.color;
}

function restart() {
  selectedLaneId.value = "middle";
  lastMistakeLaneId.value = undefined;
  lastSuccessLaneId.value = undefined;
  hintStrength.value = 0;
  feedbackText.value = "Посмотри, откуда летит мяч, и выбери позицию ракетки для мягкого удара.";
  restartRoundGame();
}
</script>

<template>
  <div class="step-pong-shell">
    <GameHud title="Понг пошаговый" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Strategy/control: спокойный выбор позиции</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Поставь ракетку перед ударом</h1>
                <p class="text-body-1 text-md-h6 text-medium-emphasis mb-0">{{ feedbackText }}</p>
              </div>
              <v-chip color="primary" size="large" variant="tonal">
                {{ helperText }}
              </v-chip>
            </div>

            <v-row align="stretch">
              <v-col cols="12" sm="7" class="pe-sm-4">
                <v-card class="pong-board pa-3 pa-md-5" color="cyan-lighten-5" rounded="xl" variant="flat">
                  <div class="pong-stage" :style="ballStyle" aria-label="Поле пошагового понга">
                    <div class="partner-paddle" aria-hidden="true" />
                    <div class="net" aria-hidden="true" />

                    <div class="lane-markers" aria-label="Линии прилёта мяча">
                      <div v-for="lane in lanes" :key="lane.id" class="lane-marker" :class="{ 'lane-marker--active': lane.id === round.incomingLane.id }" :style="{ '--lane-y': `${lane.y}%` }">
                        <v-icon v-if="lane.id === round.incomingLane.id" icon="mdi-bullseye-arrow" color="primary" size="26" />
                      </div>
                    </div>

                    <div class="incoming-path" aria-hidden="true" />
                    <div class="return-path" aria-hidden="true" />
                    <div class="pong-ball" aria-hidden="true" />
                    <div class="player-paddle" :class="{ 'player-paddle--hint': hintStrength > 0, 'player-paddle--success': lastSuccessLaneId === selectedLaneId }" aria-hidden="true" />
                  </div>
                </v-card>
              </v-col>

              <v-col cols="12" sm="5">
                <v-card class="pa-4 pa-md-5 h-100" color="surface" rounded="xl" variant="outlined">
                  <div class="text-overline text-secondary mb-2">Позиция ракетки</div>
                  <div class="lane-grid">
                    <GameDwellButton
                      v-for="lane in lanes"
                      :key="lane.id"
                      :target-id="laneTargetId(lane)"
                      :disabled="session.status !== 'running'"
                      :dwell-ms="session.settings.dwellMs"
                      :min-height="142"
                      :color="laneColor(lane)"
                      @select="chooseLane(lane)"
                    >
                      <template #default>
                        <div :class="['lane-choice', { 'lane-choice--hinted': hintStrength > 0 && lane.id === round.incomingLane.id }]">
                          <v-icon :icon="lane.icon" size="48" color="primary" />
                          <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ lane.label }}</div>
                          <div class="text-body-2 text-medium-emphasis">{{ lane.hint }}</div>
                        </div>
                      </template>
                    </GameDwellButton>
                  </div>

                  <v-alert class="mt-4 text-body-1" color="info" icon="mdi-hand-heart-outline" rounded="xl" variant="tonal">
                    Если позиция не подошла, это промах. Третий промах пропускает мяч и завершает партию.
                  </v-alert>
                </v-card>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Понг пошаговый" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.step-pong-shell {
  background: linear-gradient(135deg, #eef8ff 0%, #f6fff7 52%, #fff8e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.pong-board {
  min-block-size: clamp(31rem, 67vh, 43rem);
}

.pong-stage {
  background: radial-gradient(circle at 50% 50%, rgb(255 255 255 / 78%) 0%, transparent 36%), linear-gradient(180deg, #e9fbff 0%, #f8fffb 100%);
  block-size: clamp(28rem, 61vh, 38rem);
  border: 0.25rem solid rgb(var(--v-theme-primary) / 14%);
  border-radius: 1.6rem;
  overflow: hidden;
  position: relative;
}

.net {
  background: repeating-linear-gradient(180deg, rgb(var(--v-theme-primary) / 22%) 0 1.2rem, transparent 1.2rem 2rem);
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
  block-size: clamp(6.4rem, 18vh, 9rem);
  inset-block-start: var(--paddle-y);
  inset-inline-end: 8%;
  transition: inset-block-start 260ms ease, box-shadow 220ms ease;
}

.player-paddle--hint {
  box-shadow: 0 0 0 0.35rem rgb(var(--v-theme-primary) / 28%), 0 0.8rem 1.6rem rgb(var(--v-theme-primary) / 18%);
}

.player-paddle--success {
  box-shadow: 0 0 0 0.35rem rgb(var(--v-theme-success) / 28%), 0 0.8rem 1.6rem rgb(var(--v-theme-success) / 18%);
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
  background: linear-gradient(90deg, rgb(var(--v-theme-primary) / 0%), rgb(var(--v-theme-primary) / 42%));
  inline-size: 62%;
  inset-block-start: var(--ball-y);
  inset-inline-start: 22%;
  transform: rotate(var(--shot-angle));
}

.return-path {
  background: linear-gradient(90deg, rgb(var(--v-theme-success) / 42%), rgb(var(--v-theme-success) / 0%));
  inline-size: 42%;
  inset-block-start: var(--return-y);
  inset-inline-start: 14%;
  opacity: 0.62;
}

.pong-ball {
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

.lane-grid {
  display: grid;
  gap: 0.9rem;
}

.lane-choice {
  align-items: center;
  display: flex;
  flex-direction: column;
  text-align: center;
}

.lane-choice--hinted {
  filter: drop-shadow(0 0 0.8rem rgb(var(--v-theme-primary) / 24%));
}

@media (max-width: 960px) {
  .game-container {
    padding-block-start: 9.5rem;
  }
}

@media (min-width: 700px) and (max-height: 920px) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .pong-board {
    min-block-size: clamp(20rem, 50vh, 28rem);
  }

  .pong-stage {
    block-size: clamp(18rem, 44vh, 25rem);
  }
}

@media (max-width: 600px) {
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
