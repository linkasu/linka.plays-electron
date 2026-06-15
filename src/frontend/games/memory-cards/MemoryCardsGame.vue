<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeMemoryCardsAudio, playMemoryCardsMatchMelody, playMemoryCardsMismatchMelody, warmMemoryCardsAudio } from "./audio";
import { createMemoryCardsRound, type MemoryCard } from "./model";

type MemoryCardState = MemoryCard & {
  matched: boolean;
  revealed: boolean;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("memory-cards", {
  maxSteps: 3,
  overrides: { preset: "gentle", targetScale: 1.2, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const roundIndex = ref(1);
const round = ref(createMemoryCardsRound(session.settings, roundIndex.value));
const cards = ref(createCardStates(round.value.cards));
const selectedCardIds = ref<string[]>([]);
const lastMismatchCardIds = ref<string[]>([]);
const inputBlocked = ref(false);
const feedbackMessage = ref("Открой две карточки и найди пару.");
let closeTimeout = 0;

const resultVisible = computed(() => session.status === "finished");
const matchedCount = computed(() => cards.value.filter((card) => card.matched).length / 2);
const targetCardHeight = computed(() => `clamp(128px, ${Math.round(21 * session.settings.targetScale)}vh, 200px)`);
const cardColSpan = computed(() => round.value.columns === 4 ? 3 : 4);

function createCardStates(memoryCards: MemoryCard[]): MemoryCardState[] {
  return memoryCards.map((card) => ({ ...card, matched: false, revealed: false }));
}

function clearCloseTimeout() {
  if (!closeTimeout) return;
  window.clearTimeout(closeTimeout);
  closeTimeout = 0;
}

function cardTargetId(card: MemoryCardState) {
  return `memory-cards:card:${card.id}`;
}

function isCardOpen(card: MemoryCardState) {
  return card.revealed || card.matched;
}

function cardColor(card: MemoryCardState) {
  if (card.matched) return "success";
  if (lastMismatchCardIds.value.includes(card.id)) return "warning";
  if (card.revealed) return "primary";
  return "surface";
}

function chooseCard(card: MemoryCardState) {
  if (session.status !== "running" || inputBlocked.value || card.matched || card.revealed) return;

  card.revealed = true;
  selectedCardIds.value = [...selectedCardIds.value, card.id];
  feedbackMessage.value = selectedCardIds.value.length === 1 ? "Теперь найди такую же карточку." : "Смотрим, пара ли это.";

  if (selectedCardIds.value.length < 2) return;

  inputBlocked.value = true;
  const [first, second] = selectedCardIds.value.map((cardId) => cards.value.find((item) => item.id === cardId));
  if (!first || !second) return;

  if (first.pairId === second.pairId) {
    first.matched = true;
    second.matched = true;
    selectedCardIds.value = [];
    lastMismatchCardIds.value = [];
    void playMemoryCardsMatchMelody(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId: cardTargetId(second), pairId: second.pairId, expected: first.label, actual: second.label, isCorrect: true });
    feedbackMessage.value = matchedCount.value === round.value.pairCount ? "Все пары найдены." : "Пара найдена. Продолжаем спокойно.";
    inputBlocked.value = false;
    if (matchedCount.value === round.value.pairCount) finishSession("game-complete");
    return;
  }

  lastMismatchCardIds.value = [first.id, second.id];
  void playMemoryCardsMismatchMelody(session.settings.sound);
  recordMistake({ roundId: round.value.roundId, targetId: cardTargetId(second), expectedTargetId: cardTargetId(first), expected: first.label, actual: second.label, isCorrect: false });
  feedbackMessage.value = "Это разные карточки. Они мягко закроются.";
  closeTimeout = window.setTimeout(() => {
    first.revealed = false;
    second.revealed = false;
    selectedCardIds.value = [];
    lastMismatchCardIds.value = [];
    inputBlocked.value = false;
    feedbackMessage.value = "Попробуй открыть ещё две карточки.";
    closeTimeout = 0;
  }, 1200);
}

function restart() {
  clearCloseTimeout();
  roundIndex.value += 1;
  round.value = createMemoryCardsRound(session.settings, roundIndex.value);
  cards.value = createCardStates(round.value.cards);
  selectedCardIds.value = [];
  lastMismatchCardIds.value = [];
  inputBlocked.value = false;
  feedbackMessage.value = "Открой две карточки и найди пару.";
  startSession();
}

onMounted(() => {
  warmMemoryCardsAudio(session.settings.sound);
});

watch(() => session.settings.sound, (enabled) => {
  warmMemoryCardsAudio(enabled);
});

onUnmounted(() => {
  clearCloseTimeout();
  disposeMemoryCardsAudio();
});
</script>

<template>
  <div class="memory-shell">
    <GameHud title="Пары" :step="matchedCount" :max-steps="round.pairCount" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="9" xl="8">
          <v-card class="memory-panel pa-3 pa-md-6" color="rgba(255, 255, 255, 0.9)" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Спокойная память</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">Найди одинаковые карточки</h1>
            <div class="feedback-line text-body-1 text-medium-emphasis text-center mb-3">{{ feedbackMessage }}</div>
            <v-row class="memory-grid" justify="center">
              <v-col v-for="card in cards" :key="card.id" cols="6" :sm="cardColSpan" :md="cardColSpan">
                <GameDwellButton :target-id="cardTargetId(card)" :disabled="session.status !== 'running' || inputBlocked || card.matched || card.revealed" :dwell-ms="session.settings.dwellMs" :min-height="targetCardHeight" :color="cardColor(card)" @select="chooseCard(card)">
                  <template #default>
                    <div class="memory-card-content">
                      <template v-if="isCardOpen(card)">
                        <div class="memory-card-emoji emoji-glyph">{{ card.emoji }}</div>
                        <div class="text-h5 font-weight-bold mt-2">{{ card.label }}</div>
                      </template>
                      <template v-else>
                        <v-icon icon="mdi-cards" size="76" color="primary" />
                        <div class="sr-only">Закрытая карточка</div>
                      </template>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Пары" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.memory-shell {
  background: radial-gradient(circle at 20% 20%, #fff6d8 0 22%, transparent 34%), linear-gradient(135deg, #e7f5ff 0%, #f7edff 52%, #fff3e2 100%);
  block-size: 100vh;
  overflow: hidden;
}

.game-container {
  block-size: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-block: clamp(5rem, 10vh, 7rem) clamp(1rem, 4vh, 2.5rem);
}

.game-container :deep(.v-row) {
  margin: 0;
}

.memory-panel {
  max-block-size: calc(100vh - 6rem);
  overflow: hidden;
}

.memory-grid {
  flex: 0 1 min(1040px, 100%);
  inline-size: min(1040px, 100%);
  max-inline-size: 1040px;
  margin-inline: auto;
}

.memory-grid :deep(.v-col) {
  padding: 6px;
}

.feedback-line {
  min-block-size: 1.5rem;
}

.memory-card-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 100%;
}

.memory-card-emoji {
  font-size: clamp(3rem, min(7vw, 10vh), 6.5rem);
  line-height: 1;
}

.sr-only {
  block-size: 1px;
  clip: rect(0, 0, 0, 0);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (max-height: 44rem) {
  .game-container {
    justify-content: flex-start;
    padding-block-start: 5rem;
  }
}
</style>
