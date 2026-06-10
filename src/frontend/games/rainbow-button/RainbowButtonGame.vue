<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type RainbowRound = {
  roundId: string;
  targetId: string;
  prompt: string;
  glow: string;
  ring: string;
};

const rainbowSteps = [
  { prompt: "Посмотри на радугу", glow: "#ff8fa3", ring: "#ffd166" },
  { prompt: "Зажги мягкий цвет", glow: "#ffd166", ring: "#8bd47f" },
  { prompt: "Держи взгляд спокойно", glow: "#8bd47f", ring: "#70d6ff" },
  { prompt: "Радуга ждёт тебя", glow: "#70d6ff", ring: "#b8a1ff" },
  { prompt: "Ещё один тёплый цвет", glow: "#b8a1ff", ring: "#ff9de2" },
  { prompt: "Смотри в центр", glow: "#ff9de2", ring: "#ffb86b" },
  { prompt: "Пусть цвет станет ярче", glow: "#ffb86b", ring: "#8bd47f" },
  { prompt: "Последняя радуга", glow: "#8bd47f", ring: "#70d6ff" }
] as const;

const router = useRouter();
const confirmVisible = ref(false);
const feedbackText = ref("Радуга откликается, когда взгляд спокойно держится на кнопке.");

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordSuccess, startSession } = useGameSession("rainbow-button", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 80,
  targetScale: 1.65,
  motionSpeed: 0.45,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

function createRound(roundIndex: number): RainbowRound {
  const step = rainbowSteps[(roundIndex - 1) % rainbowSteps.length];
  return {
    ...step,
    roundId: `rainbow-button-${roundIndex}`,
    targetId: `rainbow-button:target:${roundIndex}`
  };
}

const { round, resultVisible, nextRound, restart: restartRound } = useRoundGame<RainbowRound>({
  session,
  startSession,
  generateRound: createRound
});

function selectRainbow() {
  if (session.status !== "running" || confirmVisible.value) return;

  recordSuccess({ roundId: round.value.roundId, targetId: round.value.targetId, label: round.value.prompt });
  if (session.step >= session.maxSteps) return;

  confirmVisible.value = true;
  feedbackText.value = "Получилось. Можно продолжить или спокойно остановиться.";
}

function continueGame() {
  if (session.status !== "running") return;
  confirmVisible.value = false;
  feedbackText.value = "Следующая радуга уже ждёт.";
  nextRound();
}

function stopGame() {
  if (session.status !== "running") return;
  finishSession("manual");
}

function restart() {
  confirmVisible.value = false;
  feedbackText.value = "Радуга откликается, когда взгляд спокойно держится на кнопке.";
  restartRound();
}
</script>

<template>
  <div class="rainbow-button-shell">
    <GameHud title="Радужная кнопка" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="rainbow-button-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" md="10" lg="8" xl="7">
          <v-card class="rainbow-button-panel pa-5 pa-md-8" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-primary text-center mb-2">Мягкий выбор без ошибки</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-6">{{ feedbackText }}</p>

            <GameDwellButton :target-id="round.targetId" :disabled="session.status !== 'running' || confirmVisible" :dwell-ms="session.settings.dwellMs" :min-height="320" color="surface" @select="selectRainbow">
              <template #default="{ active, progress }">
                <div class="rainbow-button-target" :class="{ 'rainbow-button-target--active': active }" :style="{ '--rainbow-glow': round.glow, '--rainbow-ring': round.ring, '--rainbow-progress': progress }">
                  <div class="rainbow-button-orb" aria-hidden="true">
                    <v-icon icon="mdi-rainbow" class="rainbow-button-icon" />
                  </div>
                  <div class="text-h3 text-md-h2 font-weight-black mt-4">{{ active && progress > 0.78 ? "Почти готово" : "Радуга" }}</div>
                  <div class="text-h6 text-md-h5 mt-3 text-medium-emphasis">{{ active ? "Продолжай смотреть мягко" : "Начни смотреть сюда" }}</div>
                </div>
              </template>
            </GameDwellButton>

            <v-expand-transition>
              <v-row v-if="confirmVisible" class="mt-5" justify="center">
                <v-col cols="12" sm="6">
                  <GameDwellButton target-id="rainbow-button:more" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="150" color="success" @select="continueGame">
                    <template #default>
                      <v-icon class="mb-2" icon="mdi-repeat" size="54" />
                      <div class="text-h4 font-weight-bold">Ещё</div>
                    </template>
                  </GameDwellButton>
                </v-col>
                <v-col cols="12" sm="6">
                  <GameDwellButton target-id="rainbow-button:stop" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="150" color="secondary" @select="stopGame">
                    <template #default>
                      <v-icon class="mb-2" icon="mdi-stop-circle-outline" size="54" />
                      <div class="text-h4 font-weight-bold">Стоп</div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Радужная кнопка" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.rainbow-button-shell {
  background: radial-gradient(circle at 18% 18%, rgb(255 214 230 / 62%), transparent 34%), radial-gradient(circle at 84% 28%, rgb(178 225 255 / 58%), transparent 36%), linear-gradient(135deg, #fff7df 0%, #f2f5ff 48%, #f0fff4 100%);
  min-block-size: 100vh;
}

.rainbow-button-container {
  min-block-size: 100vh;
  padding-block-start: 120px;
}

.rainbow-button-panel {
  overflow: hidden;
}

.rainbow-button-target {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 270px;
  position: relative;
}

.rainbow-button-target::before {
  background: conic-gradient(from 90deg, #ff8fa3, #ffd166, #8bd47f, #70d6ff, #b8a1ff, #ff9de2, #ff8fa3);
  block-size: clamp(13rem, 28vw, 18rem);
  border-radius: 999px;
  content: "";
  filter: blur(2px) saturate(1.04);
  inline-size: clamp(13rem, 28vw, 18rem);
  inset-block-start: 50%;
  inset-inline-start: 50%;
  opacity: 0.28;
  position: absolute;
  transform: translate(-50%, -50%) rotate(calc(var(--rainbow-progress) * 80deg));
}

.rainbow-button-orb {
  align-items: center;
  background: radial-gradient(circle at 42% 32%, #fff, color-mix(in srgb, var(--rainbow-glow) 46%, white) 42%, var(--rainbow-ring) 100%);
  block-size: clamp(8rem, 20vw, 12rem);
  border-radius: 999px;
  box-shadow: 0 20px 60px color-mix(in srgb, var(--rainbow-glow) 42%, transparent), inset 0 0 0 10px rgb(255 255 255 / 52%);
  display: flex;
  inline-size: clamp(8rem, 20vw, 12rem);
  justify-content: center;
  position: relative;
  z-index: 1;
}

.rainbow-button-icon {
  color: rgb(var(--v-theme-primary));
  font-size: clamp(4.8rem, 12vw, 7.5rem);
}

.rainbow-button-target > :not(.rainbow-button-orb) {
  position: relative;
  z-index: 1;
}

.rainbow-button-target--active .rainbow-button-orb {
  transform: scale(1.04);
}
</style>
