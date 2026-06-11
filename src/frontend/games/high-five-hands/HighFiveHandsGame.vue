<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssets from "../../data/ttsAssets.json";

type HandDefinition = {
  id: string;
  label: string;
  side: "left" | "right";
  color: string;
  accent: string;
  response: string;
  ttsId: string;
};

type HighFiveRound = {
  roundId: string;
  prompt: string;
  hands: HandDefinition[];
};

const handDefinitions: HandDefinition[] = [
  { id: "warm", label: "Тёплая ладошка", side: "right", color: "primary", accent: "#ffb38a", response: "Дай пять! Получилось.", ttsId: "high-five-hands.warm-response" },
  { id: "friend", label: "Дружеская ладошка", side: "left", color: "secondary", accent: "#88c7ff", response: "Спасибо за привет!", ttsId: "high-five-hands.friend-response" }
];

const prompts = [
  "Выбери ладошку для приветствия",
  "Поздоровайся взглядом",
  "Дай пять спокойно",
  "Можно выбрать любую ладошку"
] as const;

const router = useRouter();
const selectedHandId = ref("");
const feedbackText = ref("Посмотри на большую ладошку. Любой выбор хороший.");
const highFiveTtsAssets = (ttsAssets as TtsAsset[]).filter((asset) => asset.game === "high-five-hands");
const nextRoundDelayMs = 2600;
let feedbackTimer = 0;
let nextRoundTimer = 0;
let introTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("high-five-hands", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 85,
  targetScale: 1.45,
  motionSpeed: 0.45,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

function createRound(roundIndex: number): HighFiveRound {
  const showBothHands = roundIndex % 3 !== 1;
  const firstHand = handDefinitions[(roundIndex - 1) % handDefinitions.length];
  const hands = showBothHands ? [...handDefinitions] : [firstHand];
  if (roundIndex % 2 === 0) hands.reverse();

  return {
    roundId: `high-five-hands-${roundIndex}`,
    prompt: prompts[(roundIndex - 1) % prompts.length],
    hands
  };
}

const { round, resultVisible, nextRound, restart: restartRound } = useRoundGame({
  session,
  startSession,
  generateRound: createRound
});

const handMinHeight = computed(() => Math.round(280 * session.settings.targetScale));

function ttsAsset(id: string) {
  return highFiveTtsAssets.find((asset) => asset.id === id);
}

function selectHand(hand: HandDefinition) {
  if (session.status !== "running" || selectedHandId.value) return;

  selectedHandId.value = hand.id;
  feedbackText.value = hand.response;
  playTtsAsset(session.settings.sound, ttsAsset(hand.ttsId));
  recordSuccess({
    roundId: round.value.roundId,
    targetId: `high-five-hands:${round.value.roundId}:${hand.id}`,
    answerId: hand.id,
    label: hand.label,
    isCorrect: true
  });

  if (session.step < session.maxSteps) {
    window.clearTimeout(nextRoundTimer);
    nextRoundTimer = window.setTimeout(() => {
      selectedHandId.value = "";
      feedbackText.value = "Следующая ладошка ждёт спокойного приветствия.";
      playTtsAsset(session.settings.sound, ttsAsset("high-five-hands.next"), 0.36);
      nextRound();
    }, nextRoundDelayMs);
  }

  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    if (session.status === "running" && !selectedHandId.value) feedbackText.value = "Можно выбрать любую ладошку. Ошибок здесь нет.";
  }, 2200);
}

function restart() {
  selectedHandId.value = "";
  feedbackText.value = "Посмотри на большую ладошку. Любой выбор хороший.";
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(nextRoundTimer);
  window.clearTimeout(introTimer);
  restartRound();
  playTtsAsset(session.settings.sound, ttsAsset("high-five-hands.intro"), 0.36);
}

onMounted(() => {
  warmTtsAssets(session.settings.sound, highFiveTtsAssets);
  introTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset("high-five-hands.intro"), 0.36);
  }, 450);
});

onUnmounted(() => {
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(nextRoundTimer);
  window.clearTimeout(introTimer);
  disposeTtsAssets(highFiveTtsAssets);
});
</script>

<template>
  <div class="high-five-shell">
    <GameHud title="Ладошки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="high-five-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="high-five-panel pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-primary text-center mb-2">Социальное приветствие взглядом</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-6">Удержи взгляд на ладошке, и она спокойно ответит «дай пять». Ошибок здесь нет.</p>

            <v-row class="high-five-grid" justify="center">
              <v-col v-for="hand in round.hands" :key="`${round.roundId}-${hand.id}`" cols="12" :md="round.hands.length === 1 ? 8 : 6" :lg="round.hands.length === 1 ? 6 : 5">
                <GameDwellButton :target-id="`high-five-hands:${round.roundId}:${hand.id}`" :disabled="session.status !== 'running' || Boolean(selectedHandId)" :dwell-ms="session.settings.dwellMs" :min-height="handMinHeight" :color="hand.color" @select="selectHand(hand)">
                  <template #default="{ active, progress }">
                    <div class="hand-card-content" :class="{ 'hand-card-content--active': active, 'hand-card-content--selected': selectedHandId === hand.id, 'hand-card-content--left': hand.side === 'left' }" :style="{ '--hand-accent': hand.accent, '--hand-progress': progress }">
                      <div class="hand-glow" aria-hidden="true" />
                      <v-icon class="hand-icon mb-4" icon="mdi-hand-front-right-outline" />
                      <div class="text-h4 text-md-h3 font-weight-bold">{{ selectedHandId === hand.id ? 'Дай пять!' : hand.label }}</div>
                      <div class="text-h6 text-md-h5 mt-3 text-medium-emphasis">{{ active ? 'Держи взгляд спокойно' : 'Посмотри на ладошку' }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="feedbackText" class="mt-5 text-h6" color="primary" icon="mdi-hand-front-right-outline" rounded="xl" variant="tonal">
                {{ feedbackText }}
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Ладошки" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.high-five-shell {
  background: radial-gradient(circle at 18% 18%, rgb(255 209 180 / 48%), transparent 34%), radial-gradient(circle at 82% 24%, rgb(170 218 255 / 44%), transparent 32%), linear-gradient(135deg, #fff6ed 0%, #f0f8ff 52%, #f7f1ff 100%);
  min-block-size: 100vh;
}

.high-five-container {
  min-block-size: 100vh;
  padding-block-start: 120px;
}

.high-five-panel {
  overflow: hidden;
}

.high-five-grid {
  position: relative;
  z-index: 1;
}

.hand-card-content {
  align-items: center;
  block-size: 100%;
  color: rgb(var(--v-theme-on-surface));
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 260px;
  overflow: hidden;
  position: relative;
}

.hand-glow {
  background: radial-gradient(circle, color-mix(in srgb, var(--hand-accent) 42%, transparent), transparent 68%);
  block-size: calc(180px + var(--hand-progress) * 120px);
  border-radius: 999px;
  inline-size: calc(180px + var(--hand-progress) * 120px);
  inset-block-start: 46%;
  inset-inline-start: 50%;
  opacity: 0.58;
  position: absolute;
  transform: translate(-50%, -50%);
}

.hand-icon {
  color: var(--hand-accent);
  filter: drop-shadow(0 16px 24px color-mix(in srgb, var(--hand-accent) 34%, transparent));
  font-size: clamp(7rem, 18vw, 12rem);
  position: relative;
  transition: transform 260ms ease;
  z-index: 1;
}

.hand-card-content--left .hand-icon {
  transform: scaleX(-1);
}

.hand-card-content--active .hand-icon,
.hand-card-content--selected .hand-icon {
  animation: soft-high-five 1200ms ease-in-out infinite;
}

.hand-card-content > :not(.hand-glow) {
  position: relative;
  z-index: 1;
}

@keyframes soft-high-five {
  0%, 100% {
    transform: translateY(0) scale(1);
  }

  50% {
    transform: translateY(-10px) scale(1.05);
  }
}

.hand-card-content--left.hand-card-content--active .hand-icon,
.hand-card-content--left.hand-card-content--selected .hand-icon {
  animation-name: soft-high-five-left;
}

@keyframes soft-high-five-left {
  0%, 100% {
    transform: translateY(0) scaleX(-1) scale(1);
  }

  50% {
    transform: translateY(-10px) scaleX(-1) scale(1.05);
  }
}
</style>
