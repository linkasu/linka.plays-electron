<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

const stepDefinitions = [
  { prompt: "Смотри сюда", activeText: "Держи взгляд", color: "secondary", icon: "mdi-radiobox-marked" },
  { prompt: "Посмотри на кнопку", activeText: "Очень хорошо", color: "info", icon: "mdi-circle-slice-8" },
  { prompt: "Смотри в центр", activeText: "Спокойно", color: "success", icon: "mdi-record-circle-outline" },
  { prompt: "Найди большую цель", activeText: "Ещё чуть-чуть", color: "warning", icon: "mdi-bullseye" },
  { prompt: "Держи здесь", activeText: "Получается", color: "secondary", icon: "mdi-circle-double" },
  { prompt: "Повтори спокойно", activeText: "Почти готово", color: "info", icon: "mdi-circle-outline" },
  { prompt: "Ещё раз", activeText: "Получилось", color: "success", icon: "mdi-checkbox-blank-circle-outline" }
] as const;

const router = useRouter();
const successText = ref("");
let successTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("big-button", {
  preset: "gentle",
  maxSteps: 7,
  dwellMs: 1500,
  sessionSeconds: 70,
  targetScale: 1.6,
  motionSpeed: 0.5,
  distractors: "none",
  hints: "high"
});

const { round, resultVisible, nextRound, restart: restartRound } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => {
    const definition = stepDefinitions[(roundIndex - 1) % stepDefinitions.length];
    return {
      ...definition,
      roundId: `big-button-${roundIndex}`,
      targetId: `big-button:target:${roundIndex}`
    };
  }
});

function showSuccess() {
  successText.value = "Получилось";
  window.clearTimeout(successTimer);
  successTimer = window.setTimeout(() => {
    successText.value = "";
  }, 900);
}

function selectTarget() {
  if (session.status !== "running") return;
  const selectedRound = round.value;
  recordSuccess({ roundId: selectedRound.roundId, targetId: selectedRound.targetId, label: selectedRound.prompt });
  showSuccess();
  if (session.step < session.maxSteps) nextRound();
}

function restart() {
  successText.value = "";
  window.clearTimeout(successTimer);
  restartRound();
}

onUnmounted(() => {
  window.clearTimeout(successTimer);
});
</script>

<template>
  <div class="big-button-shell">
    <GameHud title="Большая кнопка" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="big-button-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" md="10" lg="8" xl="7">
          <v-card class="pa-5 pa-md-8" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Первая фиксация взглядом</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-6">Большая цель ждёт спокойно. Ошибок здесь нет.</p>
            <GameDwellButton :target-id="round.targetId" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="320" :color="round.color" @select="selectTarget">
              <template #default="{ active, progress }">
                <v-icon class="big-button-icon mb-4" :icon="round.icon" />
                <div class="text-h3 text-md-h2 font-weight-black">{{ active && progress > 0.86 ? "Получилось" : active ? round.activeText : round.prompt }}</div>
                <div class="text-h6 text-md-h5 mt-4 opacity-80">{{ active ? "Продолжай смотреть" : "Начни смотреть на кнопку" }}</div>
              </template>
            </GameDwellButton>
            <v-expand-transition>
              <v-alert v-if="successText" class="mt-5 text-h6" color="success" icon="mdi-check-circle" rounded="xl" variant="tonal">
                {{ successText }}
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Большая кнопка" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.big-button-shell {
  background: linear-gradient(135deg, #f7f2ff 0%, #eef9ff 52%, #f4fff4 100%);
  min-block-size: 100vh;
}

.big-button-container {
  min-block-size: 100vh;
  padding-block-start: 120px;
}

.big-button-icon {
  font-size: clamp(5rem, 12vw, 8rem);
}
</style>
