<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { buildRobotPartOrder, generateBuildRobotRound, type RobotPart, type RobotPartId } from "./model";

const feedbackMs = 650;

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("build-robot", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 135,
  sound: false
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRounds } = useRoundGame({
  session,
  startSession,
  generateRound: generateBuildRobotRound
});

const hintedRoundId = ref<string>();
const lastMistakePartId = ref<RobotPartId>();
const successPartId = ref<RobotPartId>();
const pendingSelection = ref(false);
let feedbackTimer = 0;

const hintedPartId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);
const feedbackText = computed(() => {
  if (successPartId.value) return `Верно. ${round.value.target.label} на месте.`;
  if (hintedRoundId.value === round.value.roundId) return `Почти. Сейчас нужна деталь: ${round.value.target.label}. Она мягко подсвечена.`;
  return round.value.prompt;
});
const partById = computed(() => Object.fromEntries(round.value.choices.map((part) => [part.id, part])) as Record<RobotPartId, RobotPart>);
const displayedPartIds = computed(() => new Set<RobotPartId>([
  ...round.value.completedPartIds,
  ...(successPartId.value ? [successPartId.value] : [])
]));

function choiceTargetId(part: RobotPart) {
  return `build-robot:${round.value.roundId}:part:${part.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  hintedRoundId.value = undefined;
  lastMistakePartId.value = undefined;
  successPartId.value = undefined;
  pendingSelection.value = false;
}

function choosePart(part: RobotPart) {
  if (session.status !== "running" || pendingSelection.value) return;

  const targetId = choiceTargetId(part);
  const expectedTargetId = choiceTargetId(round.value.target);

  if (part.id === round.value.target.id) {
    pendingSelection.value = true;
    hintedRoundId.value = undefined;
    lastMistakePartId.value = undefined;
    successPartId.value = part.id;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: part.id, expected: round.value.target.label, actual: part.label, isCorrect: true });

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
      }, feedbackMs);
    }
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: part.id, expected: round.value.target.label, actual: part.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-robot-part" });
  hintedRoundId.value = round.value.roundId;
  lastMistakePartId.value = part.id;
}

function choiceColor(part: RobotPart) {
  if (successPartId.value === part.id) return "green-lighten-4";
  if (hintedPartId.value === part.id) return "primary";
  if (lastMistakePartId.value === part.id) return "orange-lighten-4";
  return "surface";
}

function slotColor(partId: RobotPartId) {
  if (displayedPartIds.value.has(partId)) return partById.value[partId].color;
  if (hintedPartId.value === partId) return "primary";
  return "blue-grey-lighten-5";
}

function restart() {
  resetFeedback();
  restartRounds();
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="build-robot-shell">
    <GameHud title="Собери роботика" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Последовательность сборки</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">Собери роботика</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ feedbackText }}</p>

            <v-row class="align-stretch" dense>
              <v-col cols="12" sm="6">
                <v-card class="robot-stage pa-4 pa-md-5" color="cyan-lighten-5" rounded="xl" variant="flat">
                  <div class="text-body-1 text-medium-emphasis text-center mb-3">Робот {{ round.robotIndex }}, шаг {{ round.stepIndex + 1 }} из 4</div>
                  <div class="robot-layout" aria-label="Собираемый робот">
                    <v-card
                      v-for="partId in buildRobotPartOrder"
                      :key="partId"
                      :class="['robot-slot', `robot-slot--${partId}`, { 'robot-slot--placed': displayedPartIds.has(partId), 'robot-slot--hint': hintedPartId === partId }]"
                      :color="slotColor(partId)"
                      rounded="xl"
                      variant="flat"
                    >
                      <v-icon class="slot-icon" :icon="displayedPartIds.has(partId) || hintedPartId === partId ? partById[partId].icon : 'mdi-plus'" :color="displayedPartIds.has(partId) ? undefined : 'blue-grey-darken-1'" />
                      <div class="text-subtitle-1 font-weight-bold mt-2">{{ partById[partId].label }}</div>
                    </v-card>
                  </div>
                </v-card>
              </v-col>

              <v-col cols="12" sm="6">
                <v-row class="choice-grid" dense>
                  <v-col v-for="part in round.choices" :key="part.id" cols="12" sm="6">
                    <GameDwellButton :target-id="choiceTargetId(part)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="170" :color="choiceColor(part)" @select="choosePart(part)">
                      <template #default>
                        <v-icon class="choice-icon" :icon="part.icon" :color="choiceColor(part) === 'surface' ? part.color : undefined" />
                        <div class="text-h5 text-md-h4 font-weight-bold mt-2">{{ part.label }}</div>
                        <div class="text-body-1 text-medium-emphasis mt-1">деталь</div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-lightbulb-on-outline" rounded="xl" variant="tonal">
                Ошибка не завершает игру. Нужная деталь подсвечена, можно спокойно попробовать ещё раз.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Собери роботика" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.build-robot-shell {
  background: linear-gradient(135deg, #eef9ff 0%, #fff7e8 52%, #f2efff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.robot-stage {
  block-size: 100%;
}

.robot-layout {
  display: grid;
  gap: clamp(0.75rem, 1.4vw, 1rem);
  grid-template-areas:
    ". head ."
    "arms body body"
    ". legs .";
  grid-template-columns: minmax(5.5rem, 0.75fr) minmax(7rem, 1fr) minmax(5.5rem, 0.75fr);
  margin-inline: auto;
  max-inline-size: 34rem;
}

.robot-slot {
  align-items: center;
  border: 0.2rem dashed rgb(var(--v-theme-primary) / 22%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: clamp(8.5rem, 17vh, 12rem);
  text-align: center;
  transition: filter 160ms ease, transform 160ms ease;
}

.robot-slot--head {
  grid-area: head;
}

.robot-slot--body {
  grid-area: body;
}

.robot-slot--arms {
  grid-area: arms;
}

.robot-slot--legs {
  grid-area: legs;
}

.robot-slot--placed {
  border-style: solid;
  box-shadow: inset 0 -0.45rem 0 rgb(0 0 0 / 8%);
}

.robot-slot--hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

.slot-icon,
.choice-icon {
  font-size: clamp(3.6rem, min(8vw, 11vh), 6rem);
  line-height: 1;
}

.choice-grid {
  block-size: 100%;
  row-gap: 0.75rem;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 9.75rem;
  }

  .robot-layout {
    grid-template-columns: minmax(4.5rem, 0.8fr) minmax(6rem, 1fr) minmax(4.5rem, 0.8fr);
  }

  .robot-slot {
    min-block-size: 7.25rem;
  }
}

@media (max-height: 820px) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .robot-slot {
    min-block-size: clamp(5.5rem, 11vh, 7rem);
  }

  .slot-icon,
  .choice-icon {
    font-size: clamp(2.8rem, min(6vw, 8vh), 4.2rem);
  }
}
</style>
