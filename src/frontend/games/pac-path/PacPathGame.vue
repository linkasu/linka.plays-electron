<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { createPacPathRound, isPacPathSafeChoice, pacPathChoiceOutcome, pacPathMaxSteps, pacPathWaypoints, type PacPathChoice, type PacPathWaypoint } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSession("pac-path", {
  maxSteps: pacPathMaxSteps,
  dwellMs: 1300,
  sessionSeconds: 180,
  targetScale: 1.35,
  sound: false
}, {
  finishOnMistakes: false
});

const feedbackText = ref("Выбери следующий безопасный waypoint на светлой дорожке. Три detour завершают партию.");
const hintedChoiceId = ref<string>();
const wrongChoiceId = ref<string>();
const pendingChoice = ref(false);
let feedbackTimer = 0;

const round = computed(() => createPacPathRound(session.step));
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(Math.min(1, session.step / session.maxSteps) * 100));
const pathLinePoints = computed(() => pacPathWaypoints.map((waypoint) => `${waypoint.x},${waypoint.y}`).join(" "));
const completedLinePoints = computed(() => pacPathWaypoints.slice(0, Math.min(session.step, pacPathMaxSteps) + 1).map((waypoint) => `${waypoint.x},${waypoint.y}`).join(" "));
const completedWaypoints = computed(() => pacPathWaypoints.filter((waypoint) => waypoint.order > 0 && waypoint.order <= session.step));

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function choiceTargetId(choice: PacPathChoice | PacPathWaypoint) {
  return `pac-path:waypoint:${choice.id}`;
}

function waypointStyle(waypoint: PacPathChoice | PacPathWaypoint) {
  return {
    "--pac-x": `${waypoint.x}%`,
    "--pac-y": `${waypoint.y}%`,
    "--pac-mobile-x": `${waypoint.mobileX}%`,
    "--pac-mobile-y": `${waypoint.mobileY}%`
  };
}

function isCompleted(waypoint: PacPathWaypoint) {
  return waypoint.order <= session.step;
}

function choiceColor(choice: PacPathChoice) {
  if (choice.id === hintedChoiceId.value) return "yellow-lighten-4";
  if (choice.id === wrongChoiceId.value) return "blue-grey-lighten-4";
  return choice.safe ? "amber-lighten-4" : "surface";
}

function resetChoiceState() {
  clearFeedbackTimer();
  hintedChoiceId.value = undefined;
  wrongChoiceId.value = undefined;
  pendingChoice.value = false;
}

function chooseWaypoint(choice: PacPathChoice) {
  if (session.status !== "running" || pendingChoice.value) return;

  const currentRound = round.value;
  const selectedTargetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(currentRound.expected);
  clearFeedbackTimer();

  if (isPacPathSafeChoice(choice, currentRound)) {
    pendingChoice.value = true;
    hintedChoiceId.value = undefined;
    feedbackText.value = session.step + 1 >= session.maxSteps
      ? "Pac-path готов: все safe-waypoint выбраны спокойно."
      : `Верно: ${choice.label.toLowerCase()}. Теперь ищем следующий безопасный waypoint.`;
    recordSuccess({
      roundId: currentRound.roundId,
      targetId: selectedTargetId,
      expectedTargetId,
      waypointId: choice.id,
      waypointOrder: choice.order,
      isCorrect: true
    });

    if (session.status === "running") {
      feedbackTimer = window.setTimeout(() => {
        resetChoiceState();
        feedbackText.value = `Следующий безопасный waypoint: ${round.value.expected.label.toLowerCase()}.`;
      }, 700);
    }
    return;
  }

  const outcome = pacPathChoiceOutcome(choice, currentRound, session.mistakes + 1);
  pendingChoice.value = true;
  wrongChoiceId.value = choice.id;
  hintedChoiceId.value = currentRound.expected.id;
  feedbackText.value = outcome === "loss"
    ? `${choice.label} оказался третьим detour. Партия завершена.`
    : `${choice.label} — detour. Сейчас безопаснее ${currentRound.expected.label.toLowerCase()}. Попробуй ещё раз.`;
  recordMistake({
    roundId: currentRound.roundId,
    targetId: selectedTargetId,
    expectedTargetId,
    selectedWaypointId: choice.id,
    expectedWaypointId: currentRound.expected.id,
    hintOnly: true,
    isCorrect: false
  });
  recordHint({
    roundId: currentRound.roundId,
    targetId: expectedTargetId,
    reason: "next-safe-waypoint",
    selectedWaypointId: choice.id,
    expectedWaypointId: currentRound.expected.id
  });

  if (outcome === "loss") {
    finishSession("game-lost");
    return;
  }

  feedbackTimer = window.setTimeout(() => {
    pendingChoice.value = false;
    wrongChoiceId.value = undefined;
  }, 1100);
}

function restart() {
  resetChoiceState();
  feedbackText.value = "Выбери следующий безопасный waypoint на светлой дорожке. Три detour завершают партию.";
  startSession();
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="pac-path-shell">
    <GameHud title="Pac-path" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="pac-path-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pac-path-panel pa-4 pa-md-6" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-primary text-center mb-2">Strategy · choice sequence · visual-search</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">Pac-path</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">
              Выбирай следующий безопасный waypoint на лабиринтной дорожке. Detour тратит попытку, третий detour завершает партию.
            </p>

            <v-alert class="mb-5 text-h6" :color="hintedChoiceId ? 'warning' : 'secondary'" :icon="hintedChoiceId ? 'mdi-lightbulb-on-outline' : 'mdi-pac-man'" rounded="xl" variant="tonal">
              {{ feedbackText }}
            </v-alert>

            <div class="pac-path-stage mx-auto" role="group" aria-label="Pac-path: лабиринтная дорожка с безопасными waypoint">
              <svg class="pac-path-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline class="pac-path-lines__shadow" :points="pathLinePoints" />
                <polyline class="pac-path-lines__lane" :points="pathLinePoints" />
                <polyline v-if="session.step > 0" class="pac-path-lines__done" :points="completedLinePoints" />
              </svg>

              <div class="pac-path-start" :style="waypointStyle(pacPathWaypoints[0])">
                <v-icon icon="mdi-pac-man" />
                <span>Старт</span>
              </div>

              <div
                v-for="waypoint in pacPathWaypoints.slice(1)"
                :key="`dot-${waypoint.id}`"
                class="pac-path-dot"
                :class="{ 'pac-path-dot--done': isCompleted(waypoint), 'pac-path-dot--next': waypoint.id === round.expected.id }"
                :style="waypointStyle(waypoint)"
                aria-hidden="true"
              >
                <v-icon :icon="isCompleted(waypoint) ? 'mdi-check-circle' : 'mdi-circle-small'" />
              </div>

              <GameDwellButton
                v-for="choice in round.choices"
                :key="choice.id"
                class="pac-path-choice"
                :class="{
                  'pac-path-choice--safe': choice.safe,
                  'pac-path-choice--hint': choice.id === hintedChoiceId,
                  'pac-path-choice--wrong': choice.id === wrongChoiceId
                }"
                :style="waypointStyle(choice)"
                :target-id="choiceTargetId(choice)"
                :disabled="session.status !== 'running' || pendingChoice"
                :dwell-ms="session.settings.dwellMs"
                :min-height="118"
                :color="choiceColor(choice)"
                @select="chooseWaypoint(choice)"
              >
                <template #default="{ active, progress }">
                  <div class="pac-path-choice__content">
                    <v-icon :icon="choice.id === hintedChoiceId ? 'mdi-lightbulb-on-outline' : choice.icon" size="40" />
                    <div class="pac-path-choice__label">{{ choice.label }}</div>
                    <div class="pac-path-choice__cue">{{ choice.cue }}</div>
                    <v-chip v-if="choice.id === hintedChoiceId" class="mt-2" color="warning" size="small" variant="flat">сюда</v-chip>
                    <v-chip v-else-if="active" class="mt-2" color="primary" size="small" variant="flat">{{ Math.round(progress * 100) }}%</v-chip>
                  </div>
                </template>
              </GameDwellButton>
            </div>

            <v-row class="mt-5" align="center">
              <v-col cols="12" md="8">
                <div class="text-caption text-medium-emphasis mb-2">Уже собранная дорожка</div>
                <div class="d-flex flex-wrap ga-2">
                  <v-chip v-for="waypoint in completedWaypoints" :key="`done-${waypoint.id}`" color="primary" size="large" variant="flat">
                    {{ waypoint.order }} · {{ waypoint.label }}
                  </v-chip>
                  <span v-if="completedWaypoints.length === 0" class="text-body-1 text-medium-emphasis">Пак ждёт первый безопасный waypoint.</span>
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <div class="text-caption text-medium-emphasis mb-2">Прогресс Pac-path</div>
                <v-progress-linear :model-value="progressPercent" color="primary" height="14" rounded />
                <div class="text-body-2 text-medium-emphasis mt-2">{{ progressPercent }}% · сейчас: {{ round.expected.label }}</div>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Pac-path" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.pac-path-shell {
  background: radial-gradient(circle at 15% 12%, rgb(255 224 130 / 46%), transparent 30%), linear-gradient(135deg, #eef8ff 0%, #f7f2ff 50%, #fff8df 100%);
  min-block-size: 100vh;
}

.pac-path-container {
  min-block-size: 100vh;
  padding-block-start: 7.75rem;
}

.pac-path-panel {
  overflow: hidden;
}

.pac-path-stage {
  aspect-ratio: 16 / 9;
  background: linear-gradient(145deg, #1f2b4a 0%, #263a63 54%, #193653 100%);
  border: 0.75rem solid rgb(255 255 255 / 78%);
  border-radius: 2rem;
  box-shadow: inset 0 0 0 0.125rem rgb(255 255 255 / 14%), 0 1.5rem 4rem rgb(31 43 74 / 22%);
  inline-size: min(100%, 70rem);
  min-block-size: 30rem;
  overflow: hidden;
  position: relative;
}

.pac-path-lines {
  block-size: 100%;
  inline-size: 100%;
  inset: 0;
  position: absolute;
}

.pac-path-lines polyline {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pac-path-lines__shadow {
  stroke: rgb(7 15 34 / 45%);
  stroke-width: 17;
}

.pac-path-lines__lane {
  stroke: rgb(255 244 184 / 72%);
  stroke-dasharray: 3 7;
  stroke-width: 10;
}

.pac-path-lines__done {
  stroke: rgb(255 214 79 / 95%);
  stroke-dasharray: none;
  stroke-width: 7;
}

.pac-path-start,
.pac-path-dot,
.pac-path-choice {
  inset-block-start: var(--pac-y);
  inset-inline-start: var(--pac-x);
  position: absolute;
  transform: translate(-50%, -50%);
}

.pac-path-start {
  align-items: center;
  background: rgb(255 245 157 / 94%);
  border: 0.25rem solid rgb(255 255 255 / 82%);
  border-radius: 999px;
  color: #263238;
  display: flex;
  font-weight: 900;
  gap: 0.35rem;
  padding: 0.55rem 0.85rem;
  z-index: 4;
}

.pac-path-dot {
  align-items: center;
  block-size: 2.2rem;
  color: rgb(255 245 157 / 76%);
  display: flex;
  inline-size: 2.2rem;
  justify-content: center;
  z-index: 2;
}

.pac-path-dot--done {
  color: rgb(129 212 250 / 94%);
}

.pac-path-dot--next {
  color: rgb(255 224 130);
  filter: drop-shadow(0 0 0.9rem rgb(255 224 130 / 76%));
}

.pac-path-choice {
  inline-size: clamp(9rem, 15vw, 12.5rem);
  z-index: 5;
}

.pac-path-choice :deep(.dwell-button) {
  border: 0.25rem solid rgb(255 255 255 / 82%);
  border-radius: 1.5rem !important;
  box-shadow: 0 1rem 2.4rem rgb(4 12 28 / 28%);
}

.pac-path-choice--safe :deep(.dwell-button) {
  border-color: rgb(255 224 130 / 92%);
}

.pac-path-choice--hint {
  filter: drop-shadow(0 0 1.45rem rgb(255 224 130 / 82%));
}

.pac-path-choice--wrong {
  opacity: 0.86;
}

.pac-path-choice__content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 7rem;
  padding: 0.4rem;
  text-align: center;
}

.pac-path-choice__label {
  font-size: 1rem;
  font-weight: 900;
  line-height: 1.1;
  margin-block-start: 0.35rem;
}

.pac-path-choice__cue {
  color: rgb(var(--v-theme-on-surface) / 68%);
  font-size: 0.76rem;
  line-height: 1.15;
  margin-block-start: 0.25rem;
}

@media (max-width: 720px) {
  .pac-path-container {
    padding-block-start: 7rem;
  }

  .pac-path-stage {
    aspect-ratio: 5 / 8;
    min-block-size: 40rem;
  }

  .pac-path-start,
  .pac-path-dot,
  .pac-path-choice {
    inset-block-start: var(--pac-mobile-y);
    inset-inline-start: var(--pac-mobile-x);
  }

  .pac-path-choice {
    inline-size: clamp(7.8rem, 31vw, 9.2rem);
  }

  .pac-path-choice__cue {
    display: none;
  }
}

@media (min-width: 721px) and (max-width: 900px), (max-height: 700px) {
  .pac-path-container {
    padding-block-start: 7rem;
  }

  .pac-path-stage {
    min-block-size: auto;
  }

  .pac-path-choice {
    inline-size: clamp(8rem, 18vw, 10rem);
  }
}
</style>
