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
import { generateCoinCountingRound, type CoinCountingCoin, type CoinCountingCoinValue } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSessionFor("coin-counting", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 140, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "coin-counting",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["coin-counting.prompt.1", "coin-counting.mistake.not-enough", "coin-counting.correct.1", "coin-counting.complete"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateCoinCountingRound(session.settings, roundIndex)
});

const selectedCoins = ref<CoinCountingCoinValue[]>([]);
const feedback = ref("Выбирай монетки по одной, потом нажми галочку.");
const lastMistakeTargetId = ref<string>();
const isSpeaking = ref(false);

const selectedTotal = computed(() => selectedCoins.value.reduce((sum, coin) => sum + coin, 0));
const selectedCoinCounts = computed(() => round.value.coins.map((coin) => ({
  ...coin,
  count: selectedCoins.value.filter((selected) => selected === coin.value).length
})));
const coinButtonMinHeight = "clamp(5.75rem, 14vh, 9.25rem)";
const actionButtonMinHeight = "clamp(4.75rem, 9vh, 6.75rem)";

function coinTargetId(value: CoinCountingCoinValue) {
  return `coin-counting:coin:${value}`;
}

function actionTargetId(action: "clear" | "check") {
  return `coin-counting:action:${action}`;
}

function promptAssetId() {
  return `coin-counting.prompt.${round.value.targetTotal}`;
}

function correctAssetId() {
  return `coin-counting.correct.${round.value.targetTotal}`;
}

async function playAudioSequence(assetIds: string[], delayMs = 0) {
  isSpeaking.value = true;
  try {
    await promptAudio.playSequenceAndWait(assetIds, delayMs);
  } finally {
    isSpeaking.value = false;
  }
}

function playRoundPrompt(delayMs = 0) {
  return playAudioSequence([promptAssetId()], delayMs);
}

function coinTone(coin: CoinCountingCoin) {
  return `coin-button--${coin.value}`;
}

function resetSelection() {
  selectedCoins.value = [];
  feedback.value = "Выбирай монетки по одной, потом нажми галочку.";
  lastMistakeTargetId.value = undefined;
}

function recordSoftHint(targetId: string, text: string) {
  feedback.value = text;
  lastMistakeTargetId.value = targetId;
  recordHint({ roundId: round.value.roundId, targetId, text });
}

async function addCoin(coin: CoinCountingCoin) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = coinTargetId(coin.value);
  const nextTotal = selectedTotal.value + coin.value;
  if (nextTotal > round.value.targetTotal) {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId: actionTargetId("check"), expected: round.value.targetTotal, actual: nextTotal, selectedCoins: [...selectedCoins.value, coin.value], isCorrect: false, reason: "too-much" });
    recordSoftHint(targetId, "Получилось больше. Убери монетки или выбери поменьше.");
    void pianoFeedback.playMistake();
    await playAudioSequence(["coin-counting.mistake.too-much-coin"], 80);
    return;
  }

  selectedCoins.value = [...selectedCoins.value, coin.value];
  feedback.value = nextTotal === round.value.targetTotal ? "Сумма готова. Нажми галочку." : "Хорошо. Можно добавить ещё монетку.";
  lastMistakeTargetId.value = undefined;
}

function clearCoins() {
  if (session.status !== "running" || isSpeaking.value || selectedCoins.value.length === 0) return;
  resetSelection();
}

async function checkTotal() {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = actionTargetId("check");
  const actual = selectedTotal.value;
  if (actual === round.value.targetTotal) {
    recordSuccess({ roundId: round.value.roundId, targetId, expected: round.value.targetTotal, actual, selectedCoins: [...selectedCoins.value], isCorrect: true });
    feedback.value = "Верно.";
    lastMistakeTargetId.value = undefined;
    void pianoFeedback.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await playAudioSequence(finishedAfterSuccess ? [correctAssetId(), "coin-counting.complete"] : [correctAssetId()], 80);
    resetSelection();
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      return;
    }
    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      feedback.value = "Новая сумма.";
      await playRoundPrompt(180);
    }
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expected: round.value.targetTotal, actual, selectedCoins: [...selectedCoins.value], isCorrect: false, reason: actual < round.value.targetTotal ? "not-enough" : "too-much" });
  const mistakeKind = actual < round.value.targetTotal ? "not-enough" : "too-much";
  recordSoftHint(targetId, mistakeKind === "not-enough" ? "Пока меньше. Добавь ещё монетку." : "Получилось больше. Очисти и попробуй снова.");
  void pianoFeedback.playMistake();
  await playAudioSequence([`coin-counting.mistake.${mistakeKind}`], 80);
}

function restart() {
  promptAudio.cancelPending();
  resetSelection();
  isSpeaking.value = false;
  restartRoundGame();
  void playRoundPrompt(220);
}

onMounted(() => {
  promptAudio.warm();
  void playRoundPrompt(420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="coin-counting-shell">
    <GameHud title="Сложи монетки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="coin-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Спокойно собери сумму</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>

            <v-sheet class="sum-panel pa-4 mb-4" color="primary" rounded="xl">
              <div class="text-overline text-white text-center">Сейчас</div>
              <div class="sum-panel__number text-white">{{ selectedTotal }}</div>
              <div class="selected-coins" aria-label="Выбранные монетки">
                <span v-for="(coin, index) in selectedCoins" :key="`${coin}-${index}`" class="selected-coin">{{ coin }}</span>
              </div>
            </v-sheet>

            <v-alert class="mb-4 text-body-1 font-weight-bold" :color="lastMistakeTargetId ? 'secondary' : 'primary'" :icon="lastMistakeTargetId ? 'mdi-heart-outline' : 'mdi-lightbulb-outline'" rounded="xl" variant="tonal">
              {{ feedback }}
            </v-alert>

            <v-row class="coin-row" dense>
              <v-col v-for="coin in selectedCoinCounts" :key="coin.value" cols="12" sm="4">
                <GameDwellButton :target-id="coinTargetId(coin.value)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="coinButtonMinHeight" color="surface" @select="addCoin(coin)">
                  <template #default>
                    <div :class="['coin-button', coinTone(coin), { 'coin-button--mistake': lastMistakeTargetId === coinTargetId(coin.value) }]">
                      <div class="coin-button__value">{{ coin.label }}</div>
                      <v-chip v-if="coin.count > 0" class="mt-2 text-white" color="deep-purple-darken-3" size="large" variant="flat">Выбрано: {{ coin.count }}</v-chip>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-row class="action-row mt-2" dense>
              <v-col cols="12" sm="5">
                <GameDwellButton :target-id="actionTargetId('clear')" :disabled="session.status !== 'running' || isSpeaking || selectedCoins.length === 0" :dwell-ms="session.settings.dwellMs" :min-height="actionButtonMinHeight" color="surface" @select="clearCoins">
                  <template #default>
                    <div class="text-h5 text-md-h4 font-weight-bold">Очистить</div>
                  </template>
                </GameDwellButton>
              </v-col>
              <v-col cols="12" sm="7">
                <GameDwellButton :target-id="actionTargetId('check')" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="actionButtonMinHeight" color="deep-purple-darken-3" @select="checkTotal">
                  <template #default>
                    <div class="d-flex align-center justify-center ga-3 text-h5 text-md-h4 font-weight-bold">
                      <v-icon icon="mdi-check" size="42" />
                      Проверить сумму
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Сложи монетки" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.coin-counting-shell {
  background: linear-gradient(135deg, #fff7dc 0%, #e7f8f3 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: clamp(2.75rem, 8vh, 9.75rem);
}

.coin-card {
  overflow: hidden;
  padding: clamp(0.75rem, 2vh, 1.5rem) !important;
}

.coin-card > .text-overline {
  margin-block-end: clamp(0rem, 0.5vh, 0.5rem) !important;
}

.coin-card h1 {
  font-size: clamp(2rem, 5.2vh, 4rem) !important;
  line-height: 1.05;
  margin-block-end: clamp(0.375rem, 1.2vh, 1rem) !important;
}

.sum-panel {
  margin-block-end: clamp(0.5rem, 1.2vh, 1rem) !important;
  padding: clamp(0.5rem, 1.4vh, 1rem) !important;
  box-shadow: inset 0 -0.5rem 2rem rgb(255 255 255 / 18%);
}

.sum-panel .text-overline {
  line-height: 1.1;
}

.sum-panel__number {
  font-size: clamp(2.45rem, 7vh, 5.5rem);
  font-weight: 900;
  line-height: 0.95;
  text-align: center;
}

.selected-coins {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  min-block-size: clamp(0.5rem, 3vh, 3.25rem);
}

.selected-coin {
  align-items: center;
  background: #ffe08a;
  border: 0.2rem solid #fff6c9;
  border-radius: 999px;
  color: #533800;
  display: inline-flex;
  font-size: 1.75rem;
  font-weight: 900;
  inline-size: 3.25rem;
  justify-content: center;
  min-block-size: 3.25rem;
}

.coin-row,
.action-row {
  row-gap: clamp(0.5rem, 1.4vh, 0.75rem);
}

.action-row {
  margin-block-start: clamp(0.5rem, 1.4vh, 0.75rem) !important;
}

.coin-card .v-alert {
  margin-block-end: clamp(0.375rem, 1.2vh, 1rem) !important;
  padding-block: clamp(0.5rem, 1.2vh, 1rem) !important;
}

.coin-button {
  align-items: center;
  block-size: 100%;
  border: 0.25rem solid rgb(255 255 255 / 85%);
  border-radius: 1.5rem;
  color: #332606;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: clamp(5.5rem, 13vh, 9.5rem);
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.coin-button__value {
  align-items: center;
  background: radial-gradient(circle at 35% 30%, #fff9cb 0 18%, #ffd45f 19% 67%, #d39a22 68% 100%);
  border-radius: 999px;
  box-shadow: inset -0.35rem -0.45rem 0 rgb(120 78 0 / 16%);
  display: inline-flex;
  font-size: clamp(2.6rem, 8vh, 5.75rem);
  font-weight: 900;
  inline-size: clamp(3.6rem, 10vh, 8.25rem);
  justify-content: center;
  line-height: 1;
  min-block-size: clamp(3.6rem, 10vh, 8.25rem);
}

.coin-button--1 {
  background: linear-gradient(145deg, #fff8d7, #ffe8a1);
}

.coin-button--2 {
  background: linear-gradient(145deg, #eef9ff, #c9e6f5);
}

.coin-button--5 {
  background: linear-gradient(145deg, #eef8df, #c9e7a8);
}

.coin-button--mistake {
  filter: saturate(0.72) brightness(0.96);
  outline: 0.35rem solid rgb(var(--v-theme-secondary));
}

</style>
