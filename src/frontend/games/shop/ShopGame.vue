<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useRoundGame } from "../../composables/useRoundGame";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateShopRound, validateShopShoppingCart, type ShopCoin, type ShopCoinValue, type ShopItem } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("shop", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 140, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const shopItemAssetIds = ["shop.item.apple", "shop.item.juice", "shop.item.bread", "shop.item.milk", "shop.item.banana", "shop.item.cookie", "shop.item.cheese", "shop.item.berries", "shop.item.cake"];
const shopNumberAssetIds = Array.from({ length: 10 }, (_, index) => `shop.number.${index + 1}`);
const promptAudio = useGamePromptAudio({ gameId: "shop", soundEnabled, warmAssetIds: ["shop.wallet.10", "shop.buy", "shop.and", "shop.pay", "shop.price", ...shopItemAssetIds, ...shopNumberAssetIds, "shop.correct", "shop.mistake", "shop.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateShopRound(session.settings, roundIndex)
});

const selectedCoins = ref<ShopCoinValue[]>([]);
const selectedItemIds = ref<string[]>([]);
const feedback = ref("Выбери товар по цене или собери оплату монетами.");
const lastMistakeTargetId = ref<string>();
const isSpeaking = ref(false);

const isPaymentRound = computed(() => round.value.taskKind === "pay-coins");
const isShoppingListRound = computed(() => round.value.taskKind === "shopping-list");
const selectedTotal = computed(() => selectedCoins.value.reduce((sum, coin) => sum + coin, 0));
const selectedShoppingItems = computed(() => selectedItemIds.value
  .map((id) => round.value.choices.find((item) => item.id === id))
  .filter((item): item is ShopItem => Boolean(item)));
const targetListText = computed(() => round.value.targetItems.map((item) => item.label).join(" и "));
const shoppingTotal = computed(() => selectedShoppingItems.value.reduce((sum, item) => sum + item.price, 0));
const targetItemIds = computed(() => new Set(round.value.correctItemIds));
const shoppingReady = computed(() => validateShopShoppingCart(round.value, selectedItemIds.value));
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

function shoppingActionTargetId() {
  return "shop:action:buy";
}

function promptAssetIds() {
  if (round.value.taskKind === "shopping-list") {
    return ["shop.wallet.10", "shop.buy", `shop.item.${round.value.targetItems[0].id}`, "shop.and", `shop.item.${round.value.targetItems[1].id}`];
  }
  return ["shop.pay", `shop.item.${round.value.targetItem.id}`, "shop.price", `shop.number.${round.value.targetPrice}`];
}

function playRoundPrompt(delayMs = 0) {
  return promptAudio.playSequenceAndWait(promptAssetIds(), delayMs, 90);
}

function resetSelection(text = round.value.helperText) {
  selectedCoins.value = [];
  selectedItemIds.value = [];
  feedback.value = text;
  lastMistakeTargetId.value = undefined;
}

function setSoftHint(targetId: string, text: string) {
  feedback.value = text;
  lastMistakeTargetId.value = targetId;
}

async function advanceRound() {
  selectedCoins.value = [];
  selectedItemIds.value = [];
  lastMistakeTargetId.value = undefined;
  isSpeaking.value = true;
  void feedbackAudio.playSuccess();
  const finishedAfterSuccess = session.step >= session.maxSteps;
  await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["shop.correct", "shop.complete"] : ["shop.correct"], 80, 170);
  if (finishedAfterSuccess) {
    finishSession("game-complete");
    isSpeaking.value = false;
    return;
  }
  if (session.step < session.maxSteps) nextRound();
  feedback.value = round.value.helperText;
  await playRoundPrompt(180);
  isSpeaking.value = false;
}

async function toggleShoppingItem(item: ShopItem) {
  if (session.status !== "running" || !isShoppingListRound.value || isSpeaking.value) return;

  const targetId = itemTargetId(item.id);
  if (selectedItemIds.value.includes(item.id)) {
    selectedItemIds.value = selectedItemIds.value.filter((id) => id !== item.id);
    feedback.value = round.value.helperText;
    lastMistakeTargetId.value = undefined;
    return;
  }

  if (!targetItemIds.value.has(item.id)) {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId: shoppingActionTargetId(), prompt: round.value.prompt, expected: round.value.correctItemIds, actual: [...selectedItemIds.value, item.id], itemId: item.id, isCorrect: false, reason: "not-in-list" });
    setSoftHint(targetId, "Этот товар не из списка. Выбери товары из задания.");
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(["shop.mistake"], 80);
    isSpeaking.value = false;
    return;
  }

  selectedItemIds.value = [...selectedItemIds.value, item.id];
  feedback.value = shoppingReady.value ? "Корзина готова. Нажми Купить." : round.value.helperText;
  lastMistakeTargetId.value = undefined;
}

async function buyShoppingList() {
  if (session.status !== "running" || !isShoppingListRound.value || isSpeaking.value) return;

  const targetId = shoppingActionTargetId();
  if (shoppingReady.value) {
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.correctItemIds, actual: selectedItemIds.value, total: shoppingTotal.value, walletTotal: round.value.walletTotal, isCorrect: true });
    await advanceRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.correctItemIds, actual: selectedItemIds.value, total: shoppingTotal.value, walletTotal: round.value.walletTotal, isCorrect: false, reason: shoppingTotal.value > round.value.walletTotal ? "too-much" : "list-mismatch" });
  setSoftHint(targetId, shoppingTotal.value > round.value.walletTotal ? "Не хватает монет. Убери один товар." : "Выбери все товары из списка, потом нажми Купить.");
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["shop.mistake"], 80);
  isSpeaking.value = false;
}

async function addCoin(coin: ShopCoin) {
  if (session.status !== "running" || !isPaymentRound.value || isSpeaking.value) return;

  const targetId = coinTargetId(coin.value);
  const nextTotal = selectedTotal.value + coin.value;
  if (nextTotal > round.value.targetPrice) {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId: actionTargetId("check"), expected: round.value.targetPrice, actual: nextTotal, selectedCoins: [...selectedCoins.value, coin.value], isCorrect: false, reason: "too-much" });
    setSoftHint(targetId, "Получилось больше цены. Можно очистить и собрать снова.");
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(["shop.mistake"], 80);
    isSpeaking.value = false;
    return;
  }

  selectedCoins.value = [...selectedCoins.value, coin.value];
  feedback.value = nextTotal === round.value.targetPrice ? "Оплата готова. Нажми галочку." : "Хорошо. Можно добавить ещё монетку.";
  lastMistakeTargetId.value = undefined;
}

function clearCoins() {
  if (session.status !== "running" || isSpeaking.value || selectedCoins.value.length === 0) return;
  resetSelection("Монетки убраны. Собери цену ещё раз.");
}

async function checkPayment() {
  if (session.status !== "running" || !isPaymentRound.value || isSpeaking.value) return;

  const targetId = actionTargetId("check");
  const actual = selectedTotal.value;
  if (actual === round.value.targetPrice) {
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.targetPrice, actual, selectedCoins: [...selectedCoins.value], isCorrect: true });
    await advanceRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expected: round.value.targetPrice, actual, selectedCoins: [...selectedCoins.value], isCorrect: false, reason: actual < round.value.targetPrice ? "not-enough" : "too-much" });
  setSoftHint(targetId, actual < round.value.targetPrice ? "Пока меньше цены. Добавь ещё монетку." : "Получилось больше цены. Очисти и попробуй снова.");
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["shop.mistake"], 80);
  isSpeaking.value = false;
}

function restart() {
  promptAudio.cancelPending();
  isSpeaking.value = false;
  restartRoundGame();
  resetSelection(round.value.helperText);
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

            <template v-if="round.taskKind === 'shopping-list'">
              <v-row class="choice-row" dense>
                <v-col v-for="item in round.choices" :key="item.id" class="shop-choice-col" cols="12" sm="6" lg="3">
                  <GameDwellButton :target-id="itemTargetId(item.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="230" color="surface" @select="toggleShoppingItem(item)">
                    <template #default>
                      <div :class="['item-card', { 'item-card--selected': selectedItemIds.includes(item.id), 'item-card--mistake': lastMistakeTargetId === itemTargetId(item.id) }]">
                        <div class="item-card__emoji emoji-glyph" aria-hidden="true">{{ item.emoji }}</div>
                        <div class="item-card__label text-h5 text-md-h4 font-weight-bold text-center">{{ item.label }}</div>
                        <v-chip class="item-card__price mt-3" color="deep-purple-darken-3" size="x-large" variant="flat">
                          {{ item.price }} мон.
                        </v-chip>
                        <v-chip v-if="selectedItemIds.includes(item.id)" class="mt-2" color="success" size="large" variant="tonal">В корзине</v-chip>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>

              <v-sheet class="basket-panel pa-3 pa-md-4 mt-3" color="surface" rounded="xl" border>
                <div class="basket-panel__summary">
                  <div class="text-h6 text-md-h5 font-weight-bold">Нужно: {{ targetListText }}</div>
                  <div class="text-h6 text-md-h5 font-weight-bold">Корзина: {{ shoppingTotal }} / {{ round.walletTotal }} мон.</div>
                  <div class="text-body-1 text-medium-emphasis">{{ selectedShoppingItems.length ? selectedShoppingItems.map((item) => item.label).join(', ') : 'Выбери товары из списка' }}</div>
                </div>
                <GameDwellButton :target-id="shoppingActionTargetId()" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="6rem" color="deep-purple-darken-3" @select="buyShoppingList">
                  <template #default>
                    <div class="d-flex align-center justify-center ga-3 text-h5 text-md-h4 font-weight-bold">
                      <v-icon icon="mdi-cart-check" size="38" />
                      Купить
                    </div>
                  </template>
                </GameDwellButton>
              </v-sheet>
            </template>

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
                  <GameDwellButton :target-id="coinTargetId(coin.value)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="170" color="surface" @select="addCoin(coin)">
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
                  <GameDwellButton :target-id="actionTargetId('clear')" :disabled="session.status !== 'running' || isSpeaking || selectedCoins.length === 0" :dwell-ms="session.settings.dwellMs" :min-height="112" color="surface" @select="clearCoins">
                    <template #default>
                      <div class="text-h5 text-md-h4 font-weight-bold">Очистить</div>
                    </template>
                  </GameDwellButton>
                </v-col>
                <v-col cols="12" sm="7">
                  <GameDwellButton :target-id="actionTargetId('check')" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="112" color="primary" @select="checkPayment">
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

.item-card__label {
  color: #0b1117 !important;
}

.item-card__price {
  color: #ffffff !important;
}

.item-card--selected {
  outline: 0.35rem solid rgb(var(--v-theme-success));
  transform: scale(0.98);
}

.item-card__emoji {
  font-size: clamp(4rem, min(9vw, 12vh), 6.5rem);
  line-height: 1;
  margin-block-end: 0.75rem;
}

.receipt-panel {
  box-shadow: inset 0 -0.5rem 2rem rgb(255 255 255 / 18%);
}

.basket-panel {
  align-items: center;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1fr) minmax(14rem, 24rem);
}

.basket-panel__summary {
  min-inline-size: 0;
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

  .basket-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 4.75rem;
  }

  .shop-card {
    padding-block: 1rem !important;
  }

  .shop-card .text-overline,
  .shop-card h1,
  .shop-card .v-alert {
    display: none;
  }

  .shop-choice-col {
    flex: 0 0 25% !important;
    max-inline-size: 25% !important;
  }

  .choice-row :deep(.dwell-button) {
    min-block-size: 10rem !important;
    padding: 0.5rem !important;
  }

  .basket-panel {
    gap: 0.5rem;
    grid-template-columns: minmax(0, 1fr) minmax(12rem, 18rem);
    margin-block-start: 0.5rem !important;
    padding-block: 0.5rem !important;
  }

  .item-card,
  .coin-card {
    min-block-size: 7rem;
  }

  .item-card__emoji {
    font-size: 3.25rem;
    margin-block-end: 0.35rem;
  }

  .item-card__label {
    font-size: 1.35rem !important;
  }
}
</style>
