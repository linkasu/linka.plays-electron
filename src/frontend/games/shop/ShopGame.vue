<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateShopRound, type ShopCoin, type ShopCoinValue, type ShopItem } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("shop", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 140,
  sound: false
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateShopRound(session.settings, roundIndex)
});

const selectedCoins = ref<ShopCoinValue[]>([]);
const feedback = ref("Выбери товар по цене или собери оплату монетами.");
const lastMistakeTargetId = ref<string>();

const isPaymentRound = computed(() => round.value.taskKind === "pay-coins");
const selectedTotal = computed(() => selectedCoins.value.reduce((sum, coin) => sum + coin, 0));
const selectedCoinCounts = computed(() => round.value.coins.map((coin) => ({
  ...coin,
  count: selectedCoins.value.filter((selected) => selected === coin.value).length
})));

function itemTargetId(itemId: string) {
  return `shop:item:${itemId}`;
}

function coinTargetId(value: ShopCoinValue) {
  return `shop:coin:${value}`;
}

function actionTargetId(action: "clear" | "check") {
  return `shop:action:${action}`;
}

function resetSelection(text = round.value.helperText) {
  selectedCoins.value = [];
  feedback.value = text;
  lastMistakeTargetId.value = undefined;
}

function recordSoftHint(targetId: string, text: string) {
  feedback.value = text;
  lastMistakeTargetId.value = targetId;
  recordHint({ roundId: round.value.roundId, targetId, text });
}

function advanceRound() {
  selectedCoins.value = [];
  lastMistakeTargetId.value = undefined;
  if (session.step < session.maxSteps) nextRound();
  feedback.value = round.value.helperText;
}

function chooseItem(item: ShopItem) {
  if (session.status !== "running" || round.value.taskKind !== "choose-item") return;

  const targetId = itemTargetId(item.id);
  const expectedTargetId = itemTargetId(round.value.targetItem.id);
  if (item.id === round.value.targetItem.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.targetPrice, actual: item.price, itemId: item.id, isCorrect: true });
    advanceRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, expected: round.value.targetPrice, actual: item.price, itemId: item.id, isCorrect: false });
  recordSoftHint(targetId, `Почти. Нужен ценник ${round.value.targetPrice}. Попробуй ещё раз.`);
}

function addCoin(coin: ShopCoin) {
  if (session.status !== "running" || !isPaymentRound.value) return;

  const targetId = coinTargetId(coin.value);
  const nextTotal = selectedTotal.value + coin.value;
  if (nextTotal > round.value.targetPrice) {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId: actionTargetId("check"), expected: round.value.targetPrice, actual: nextTotal, selectedCoins: [...selectedCoins.value, coin.value], isCorrect: false, reason: "too-much" });
    recordSoftHint(targetId, "Получилось больше цены. Можно очистить и собрать снова.");
    return;
  }

  selectedCoins.value = [...selectedCoins.value, coin.value];
  feedback.value = nextTotal === round.value.targetPrice ? "Оплата готова. Нажми галочку." : "Хорошо. Можно добавить ещё монетку.";
  lastMistakeTargetId.value = undefined;
}

function clearCoins() {
  if (session.status !== "running" || selectedCoins.value.length === 0) return;
  resetSelection("Монетки убраны. Собери цену ещё раз.");
}

function checkPayment() {
  if (session.status !== "running" || !isPaymentRound.value) return;

  const targetId = actionTargetId("check");
  const actual = selectedTotal.value;
  if (actual === round.value.targetPrice) {
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.targetPrice, actual, selectedCoins: [...selectedCoins.value], isCorrect: true });
    advanceRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expected: round.value.targetPrice, actual, selectedCoins: [...selectedCoins.value], isCorrect: false, reason: actual < round.value.targetPrice ? "not-enough" : "too-much" });
  recordSoftHint(targetId, actual < round.value.targetPrice ? "Пока меньше цены. Добавь ещё монетку." : "Получилось больше цены. Очисти и попробуй снова.");
}

function restart() {
  restartRoundGame();
  resetSelection(round.value.helperText);
}
</script>

<template>
  <div class="shop-shell">
    <GameHud title="Магазин" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="11">
          <v-card class="shop-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Магазин с крупными ценниками</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-4 text-body-1 font-weight-bold" :color="lastMistakeTargetId ? 'secondary' : 'primary'" :icon="lastMistakeTargetId ? 'mdi-heart-outline' : 'mdi-lightbulb-outline'" rounded="xl" variant="tonal">
              {{ feedback || round.helperText }}
            </v-alert>

            <v-row v-if="round.taskKind === 'choose-item'" class="choice-row" dense>
              <v-col v-for="item in round.choices" :key="item.id" cols="12" sm="6" lg="3">
                <GameDwellButton :target-id="itemTargetId(item.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="230" color="surface" @select="chooseItem(item)">
                  <template #default>
                    <div :class="['item-card', { 'item-card--mistake': lastMistakeTargetId === itemTargetId(item.id) }]">
                      <div class="item-card__emoji emoji-glyph" aria-hidden="true">{{ item.emoji }}</div>
                      <div class="text-h5 text-md-h4 font-weight-bold text-center">{{ item.label }}</div>
                      <v-chip class="mt-3" color="primary" size="x-large" variant="flat">
                        {{ item.price }} мон.
                      </v-chip>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <template v-else>
              <v-sheet class="receipt-panel pa-4 mb-4" color="primary" rounded="xl">
                <div class="receipt-panel__item">
                  <span class="receipt-panel__emoji emoji-glyph" aria-hidden="true">{{ round.targetItem.emoji }}</span>
                  <div>
                    <div class="text-overline text-white">Покупка</div>
                    <div class="text-h4 text-md-h3 font-weight-bold text-white">{{ round.targetItem.label }}</div>
                  </div>
                </div>
                <div class="receipt-panel__price text-white">{{ selectedTotal }} / {{ round.targetPrice }}</div>
                <div class="selected-coins" aria-label="Выбранные монетки">
                  <span v-if="selectedCoins.length === 0" class="text-white text-h6">Монетки ещё ждут</span>
                  <span v-for="(coin, index) in selectedCoins" :key="`${coin}-${index}`" class="selected-coin">{{ coin }}</span>
                </div>
              </v-sheet>

              <v-row class="coin-row" dense>
                <v-col v-for="coin in selectedCoinCounts" :key="coin.value" cols="12" sm="4">
                  <GameDwellButton :target-id="coinTargetId(coin.value)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="170" color="surface" @select="addCoin(coin)">
                    <template #default>
                      <div :class="['coin-card', { 'coin-card--mistake': lastMistakeTargetId === coinTargetId(coin.value) }]">
                        <div class="coin-card__value">{{ coin.label }}</div>
                        <div class="text-body-1 text-medium-emphasis">монетка</div>
                        <v-chip v-if="coin.count > 0" class="mt-2" color="primary" size="large" variant="tonal">Выбрано: {{ coin.count }}</v-chip>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>

              <v-row class="action-row mt-2" dense>
                <v-col cols="12" sm="5">
                  <GameDwellButton :target-id="actionTargetId('clear')" :disabled="session.status !== 'running' || selectedCoins.length === 0" :dwell-ms="session.settings.dwellMs" :min-height="112" color="surface" @select="clearCoins">
                    <template #default>
                      <div class="text-h5 text-md-h4 font-weight-bold">Очистить</div>
                    </template>
                  </GameDwellButton>
                </v-col>
                <v-col cols="12" sm="7">
                  <GameDwellButton :target-id="actionTargetId('check')" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="112" color="primary" @select="checkPayment">
                    <template #default>
                      <div class="d-flex align-center justify-center ga-3 text-h5 text-md-h4 font-weight-bold">
                        <v-icon icon="mdi-check" size="42" />
                        Проверить оплату
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>
            </template>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Магазин" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.shop-shell {
  background: linear-gradient(135deg, #fff5df 0%, #e8f7f2 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.shop-card {
  overflow: hidden;
}

.choice-row,
.coin-row,
.action-row {
  row-gap: 0.75rem;
}

.item-card,
.coin-card {
  align-items: center;
  block-size: 100%;
  border: 0.25rem solid rgb(255 255 255 / 88%);
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 9rem;
  outline: 0 solid transparent;
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.item-card {
  background: linear-gradient(145deg, #fffdf6, #eaf7ff);
  color: #223048;
}

.item-card__emoji {
  font-size: clamp(4rem, min(9vw, 12vh), 6.5rem);
  line-height: 1;
  margin-block-end: 0.75rem;
}

.receipt-panel {
  box-shadow: inset 0 -0.5rem 2rem rgb(255 255 255 / 18%);
}

.receipt-panel__item {
  align-items: center;
  display: flex;
  gap: 1rem;
  justify-content: center;
  text-align: start;
}

.receipt-panel__emoji {
  font-size: clamp(3.25rem, min(8vw, 10vh), 5.75rem);
  line-height: 1;
}

.receipt-panel__price {
  font-size: clamp(3.75rem, min(12vw, 15vh), 7.5rem);
  font-weight: 900;
  line-height: 0.95;
  margin-block: 0.5rem;
  text-align: center;
}

.selected-coins {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  min-block-size: 3.25rem;
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

.coin-card {
  background: linear-gradient(145deg, #fff8d7, #dff2ff);
  color: #332606;
}

.coin-card__value {
  align-items: center;
  background: radial-gradient(circle at 35% 30%, #fff9cb 0 18%, #ffd45f 19% 67%, #d39a22 68% 100%);
  border-radius: 999px;
  box-shadow: inset -0.35rem -0.45rem 0 rgb(120 78 0 / 16%);
  display: inline-flex;
  font-size: clamp(3.25rem, min(9vw, 11vh), 5.5rem);
  font-weight: 900;
  inline-size: clamp(5.25rem, min(14vw, 16vh), 7.75rem);
  justify-content: center;
  line-height: 1;
  min-block-size: clamp(5.25rem, min(14vw, 16vh), 7.75rem);
}

.item-card--mistake,
.coin-card--mistake {
  filter: saturate(0.72) brightness(0.96);
  outline: 0.35rem solid rgb(var(--v-theme-secondary));
}

@media (min-width: 68.75rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 11rem;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 8.5rem;
  }

  .item-card,
  .coin-card {
    min-block-size: 8rem;
  }
}
</style>
