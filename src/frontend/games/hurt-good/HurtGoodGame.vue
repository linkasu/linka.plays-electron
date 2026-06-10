<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type HurtGoodMode = "state" | "body";

type HurtGoodChoice = {
  id: string;
  title: string;
  phrase: string;
  emoji: string;
  color: string;
};

const stateChoices: HurtGoodChoice[] = [
  { id: "good", title: "Хорошо", phrase: "Мне хорошо", emoji: "☀️", color: "primary" },
  { id: "hurt", title: "Болит", phrase: "У меня болит", emoji: "💬", color: "secondary" }
];

const bodyChoices: HurtGoodChoice[] = [
  { id: "head", title: "Голова", phrase: "Болит голова", emoji: "🙂", color: "surface" },
  { id: "throat", title: "Горло", phrase: "Болит горло", emoji: "🧣", color: "surface" },
  { id: "belly", title: "Живот", phrase: "Болит живот", emoji: "🤍", color: "surface" },
  { id: "hand", title: "Рука", phrase: "Болит рука", emoji: "✋", color: "surface" },
  { id: "leg", title: "Нога", phrase: "Болит нога", emoji: "🦶", color: "surface" },
  { id: "back", title: "Спина", phrase: "Болит спина", emoji: "🧍", color: "surface" }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, finishSession, startSession } = useGameSession("hurt-good", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, { finishOnMistakes: false });

const mode = ref<HurtGoodMode>("state");
const feedback = ref("Выбери карточку. Любой ответ важен.");
const isChangingRound = ref(false);
let transitionTimer = 0;

const resultVisible = computed(() => session.status === "finished");
const roundTitle = computed(() => mode.value === "state" ? "Как сейчас?" : "Где болит?");
const roundPrompt = computed(() => mode.value === "state"
  ? "Можно сказать: хорошо или болит."
  : "Выбери часть тела, чтобы взрослый понял.");
const choices = computed(() => mode.value === "state" ? stateChoices : bodyChoices);
const choiceColumns = computed(() => mode.value === "state" ? 6 : 4);

function choiceTargetId(choice: HurtGoodChoice) {
  return `hurt-good:${mode.value}:${choice.id}`;
}

function clearTransitionTimer() {
  window.clearTimeout(transitionTimer);
  transitionTimer = 0;
}

function continueAfterChoice(choice: HurtGoodChoice) {
  if (session.status !== "running") {
    feedback.value = "Спасибо. Твой ответ услышан.";
  } else if (mode.value === "state" && choice.id === "hurt") {
    mode.value = "body";
    feedback.value = "Покажи, где болит. Можно выбрать большую карточку.";
  } else if (session.step >= session.maxSteps) {
    finishSession("max-steps");
    feedback.value = "Спасибо. Твой ответ услышан.";
  } else {
    mode.value = "state";
    feedback.value = "Можно выбрать ещё раз, если нужно сказать по-другому.";
  }

  isChangingRound.value = false;
}

function choose(choice: HurtGoodChoice) {
  if (session.status !== "running" || isChangingRound.value) return;

  isChangingRound.value = true;
  const currentMode = mode.value;
  recordSuccess({
    roundId: `hurt-good:round:${session.step + 1}`,
    targetId: choiceTargetId(choice),
    answerId: choice.id,
    mode: currentMode,
    expected: "valid-aac-message",
    actual: choice.phrase,
    isCorrect: true,
    noFail: true
  });
  feedback.value = `Ты сказал: «${choice.phrase}». Спасибо, я понял.`;

  clearTransitionTimer();
  transitionTimer = window.setTimeout(() => continueAfterChoice(choice), 1100);
}

function restart() {
  clearTransitionTimer();
  mode.value = "state";
  feedback.value = "Выбери карточку. Любой ответ важен.";
  isChangingRound.value = false;
  startSession();
}

onUnmounted(() => {
  clearTransitionTimer();
});
</script>

<template>
  <div class="hurt-good-shell">
    <GameHud title="Болит / хорошо" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC: самочувствие</div>
            <div class="text-center mb-5 mb-md-7">
              <v-chip class="mb-4" color="primary" size="large" variant="tonal">Без неправильных ответов</v-chip>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ roundTitle }}</h1>
              <div class="text-h6 text-md-h5 text-medium-emphasis mb-3">{{ roundPrompt }}</div>
              <div class="text-h6 text-md-h5">{{ feedback }}</div>
            </div>

            <v-row justify="center">
              <v-col v-for="choice in choices" :key="choice.id" cols="12" sm="6" :md="choiceColumns">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="mode === 'state' ? 250 : 210" :color="choice.color" @select="choose(choice)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph mb-3" aria-hidden="true">{{ choice.emoji }}</div>
                    <div class="text-h3 text-md-h2 font-weight-bold mb-2">{{ choice.title }}</div>
                    <div class="text-h6 text-medium-emphasis">{{ choice.phrase }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Болит / хорошо" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.hurt-good-shell {
  background: linear-gradient(135deg, #eef8f4 0%, #fff7eb 52%, #f3f0ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.choice-emoji {
  font-size: clamp(4rem, 9vw, 6.75rem);
  line-height: 1;
}
</style>
