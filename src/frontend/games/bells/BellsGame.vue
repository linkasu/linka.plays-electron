<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type BellDefinition = {
  id: string;
  label: string;
  tone: string;
  accent: string;
};

type BellsRound = {
  roundId: string;
  target: BellDefinition;
  cards: BellDefinition[];
};

const bellDefinitions: BellDefinition[] = [
  { id: "sun", label: "Солнечный", tone: "золотой", accent: "#f6bf42" },
  { id: "sky", label: "Небесный", tone: "голубой", accent: "#5ba6f7" },
  { id: "berry", label: "Ягодный", tone: "розовый", accent: "#ec77ad" },
  { id: "meadow", label: "Луговой", tone: "зелёный", accent: "#74bf7a" }
];

const router = useRouter();
const selectedBellId = ref("");
const feedbackText = ref("");
let feedbackTimer = 0;
let nextRoundTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("bells", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 90,
  targetScale: 1.55,
  motionSpeed: 0.5,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

function shuffledBells(roundIndex: number) {
  const count = Math.min(4, 2 + Math.floor((roundIndex - 1) / 3));
  const offset = (roundIndex - 1) % bellDefinitions.length;
  const cards = [...bellDefinitions.slice(offset), ...bellDefinitions.slice(0, offset)].slice(0, count);
  if (roundIndex % 2 === 0) cards.reverse();
  return cards;
}

function createRound(roundIndex: number): BellsRound {
  const cards = shuffledBells(roundIndex);
  const target = cards[(roundIndex + cards.length - 1) % cards.length];
  return {
    roundId: `bells-${roundIndex}`,
    target,
    cards
  };
}

const { round, resultVisible, nextRound, restart: restartRound } = useRoundGame({
  session,
  startSession,
  generateRound: createRound
});

function showFeedback(text: string, delay = 900) {
  feedbackText.value = text;
  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    feedbackText.value = "";
  }, delay);
}

function selectBell(bell: BellDefinition) {
  if (session.status !== "running" || selectedBellId.value) return;

  if (bell.id !== round.value.target.id) {
    recordMistake({ roundId: round.value.roundId, selectedId: bell.id, targetId: round.value.target.id });
    showFeedback(`Это ${bell.tone}. Найди ${round.value.target.tone} колокольчик.`, 1300);
    return;
  }

  selectedBellId.value = bell.id;
  recordSuccess({ roundId: round.value.roundId, targetId: bell.id, label: bell.label });
  showFeedback("Колокольчик мягко звенит", 1000);

  if (session.step < session.maxSteps) {
    window.clearTimeout(nextRoundTimer);
    nextRoundTimer = window.setTimeout(() => {
      selectedBellId.value = "";
      nextRound();
    }, 950);
  }
}

function restart() {
  selectedBellId.value = "";
  feedbackText.value = "";
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(nextRoundTimer);
  restartRound();
}

onUnmounted(() => {
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(nextRoundTimer);
});
</script>

<template>
  <div class="bells-shell">
    <GameHud title="Колокольчики" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="bells-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="bells-panel pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-primary text-center mb-2">Спокойный выбор взглядом</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">Найди {{ round.target.tone }} колокольчик</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-6">Удержи взгляд на нужной карточке. Колокольчик качнётся и пустит мягкую волну.</p>

            <v-row class="bells-grid" justify="center">
              <v-col v-for="bell in round.cards" :key="`${round.roundId}-${bell.id}`" cols="12" sm="6" lg="3">
                <GameDwellButton :target-id="`bells:${round.roundId}:${bell.id}`" :disabled="session.status !== 'running' || Boolean(selectedBellId)" :dwell-ms="session.settings.dwellMs" :min-height="260" color="surface" @select="selectBell(bell)">
                  <template #default="{ active, progress }">
                    <div class="bell-card-content" :class="{ 'bell-card-content--active': active, 'bell-card-content--selected': selectedBellId === bell.id }" :style="{ '--bell-accent': bell.accent, '--bell-progress': progress }">
                      <div v-if="active || selectedBellId === bell.id" class="bell-wave" aria-hidden="true" />
                      <v-icon class="bell-icon mb-3" icon="mdi-bell-outline" />
                      <div class="text-h5 text-md-h4 font-weight-bold">{{ bell.label }}</div>
                      <div class="text-body-1 text-medium-emphasis mt-2">{{ bell.tone }} колокольчик</div>
                      <div class="text-body-2 mt-4 bell-hint">{{ selectedBellId === bell.id ? "Мягкий звон" : active ? "Держи взгляд" : "Посмотри сюда" }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="feedbackText" class="mt-5 text-h6" color="primary" icon="mdi-bell-ring-outline" rounded="xl" variant="tonal">
                {{ feedbackText }}
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Колокольчики" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.bells-shell {
  background: radial-gradient(circle at 20% 18%, rgb(255 241 184 / 52%), transparent 34%), linear-gradient(135deg, #fff7dc 0%, #eef8ff 48%, #f7f0ff 100%);
  min-block-size: 100vh;
}

.bells-container {
  min-block-size: 100vh;
  padding-block-start: 120px;
}

.bells-panel {
  overflow: hidden;
}

.bells-grid {
  position: relative;
  z-index: 1;
}

.bell-card-content {
  align-items: center;
  block-size: 100%;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 218px;
  overflow: hidden;
  position: relative;
}

.bell-card-content::before {
  background: radial-gradient(circle, color-mix(in srgb, var(--bell-accent) 28%, transparent), transparent 64%);
  block-size: 190px;
  border-radius: 999px;
  content: "";
  inline-size: 190px;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  opacity: 0.42;
  position: absolute;
  transform: translate(-50%, -50%);
}

.bell-icon {
  color: var(--bell-accent);
  filter: drop-shadow(0 12px 22px color-mix(in srgb, var(--bell-accent) 28%, transparent));
  font-size: clamp(5.2rem, 12vw, 8.5rem);
  position: relative;
  transform-origin: 50% 8%;
  z-index: 1;
}

.bell-card-content--active .bell-icon,
.bell-card-content--selected .bell-icon {
  animation: bell-swing 1150ms ease-in-out infinite;
}

.bell-card-content > :not(.bell-wave) {
  position: relative;
  z-index: 1;
}

.bell-wave {
  animation: bell-wave 1300ms ease-out infinite;
  border: 4px solid color-mix(in srgb, var(--bell-accent) 52%, transparent);
  border-radius: 999px;
  block-size: 132px;
  inline-size: 132px;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, -50%) scale(calc(0.82 + var(--bell-progress) * 0.22));
}

.bell-hint {
  color: color-mix(in srgb, var(--bell-accent) 70%, rgb(var(--v-theme-on-surface)));
}

@keyframes bell-swing {
  0%, 100% {
    transform: rotate(-4deg);
  }
  50% {
    transform: rotate(4deg);
  }
}

@keyframes bell-wave {
  0% {
    opacity: 0.34;
    transform: translate(-50%, -50%) scale(0.72);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.95);
  }
}
</style>
