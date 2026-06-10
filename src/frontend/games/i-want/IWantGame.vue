<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type IWantCard = {
  id: string;
  label: string;
  phrase: string;
  emoji: string;
  kind: "предмет" | "занятие" | "помощь";
};

type IWantRound = {
  roundId: string;
  prompt: string;
  cards: IWantCard[];
};

const cards: IWantCard[] = [
  { id: "water", label: "Воду", phrase: "воду", emoji: "💧", kind: "предмет" },
  { id: "apple", label: "Яблоко", phrase: "яблоко", emoji: "🍎", kind: "предмет" },
  { id: "music", label: "Музыку", phrase: "музыку", emoji: "🎵", kind: "занятие" },
  { id: "book", label: "Книгу", phrase: "книгу", emoji: "📖", kind: "предмет" },
  { id: "ball", label: "Мяч", phrase: "мяч", emoji: "🟡", kind: "предмет" },
  { id: "draw", label: "Рисовать", phrase: "рисовать", emoji: "🖍️", kind: "занятие" },
  { id: "toy", label: "Игрушку", phrase: "игрушку", emoji: "🧸", kind: "предмет" },
  { id: "rest", label: "Отдых", phrase: "отдохнуть", emoji: "🌙", kind: "занятие" },
  { id: "help", label: "Помощь", phrase: "помощь", emoji: "🤝", kind: "помощь" }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("i-want", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<IWantRound>({
  session,
  startSession,
  generateRound
});

const feedback = ref("Выбери карточку, чтобы сказать: «Я хочу ...».");
const selectedCardId = ref<string>();
const isChangingRound = ref(false);
const phrase = computed(() => {
  const selectedCard = cards.find((card) => card.id === selectedCardId.value);
  return selectedCard ? `Я хочу ${selectedCard.phrase}` : "Я хочу ...";
});

function generateRound(roundIndex = 1): IWantRound {
  if (cards.length < 6) throw new Error("Недостаточно карточек для игры Я хочу.");

  const offset = (roundIndex - 1) % cards.length;
  return {
    roundId: `i-want:round:${roundIndex}`,
    prompt: "Что ты хочешь сейчас? Любая карточка подходит.",
    cards: [...cards.slice(offset), ...cards.slice(0, offset)].slice(0, 6)
  };
}

function cardTargetId(card: IWantCard) {
  return `i-want:card:${card.id}`;
}

function choose(card: IWantCard) {
  if (session.status !== "running" || isChangingRound.value) return;

  const targetId = cardTargetId(card);
  selectedCardId.value = card.id;
  isChangingRound.value = true;

  recordSuccess({
    roundId: round.value.roundId,
    targetId,
    answerId: card.id,
    expected: "valid-communication",
    actual: `Я хочу ${card.phrase}`,
    cardKind: card.kind,
    isCorrect: true,
    noFail: true
  });
  feedback.value = `Ты сказал: «Я хочу ${card.phrase}». Спасибо, я понял.`;

  window.setTimeout(() => {
    if (session.status === "running") {
      nextRound();
      selectedCardId.value = undefined;
      feedback.value = "Следующий выбор. Можно выбрать любую карточку.";
    } else {
      feedback.value = "Спасибо. Я услышал твои желания.";
    }
    isChangingRound.value = false;
  }, 1000);
}

function restart() {
  feedback.value = "Выбери карточку, чтобы сказать: «Я хочу ...».";
  selectedCardId.value = undefined;
  isChangingRound.value = false;
  restartRoundGame();
}
</script>

<template>
  <div class="i-want-shell">
    <GameHud title="Я хочу..." :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC: любой выбор засчитывается</div>
            <div class="text-center mb-5 mb-md-7">
              <v-chip class="mb-4" color="primary" size="large" variant="tonal">{{ round.prompt }}</v-chip>
              <h1 class="text-h2 text-md-h1 font-weight-bold mb-3">{{ phrase }}</h1>
              <div class="text-h6 text-md-h5 text-medium-emphasis">{{ feedback }}</div>
            </div>

            <v-row>
              <v-col v-for="card in round.cards" :key="card.id" cols="12" sm="6" md="4">
                <GameDwellButton :target-id="cardTargetId(card)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="220" :color="selectedCardId === card.id ? 'primary' : 'surface'" @select="choose(card)">
                  <template #default>
                    <div class="card-emoji emoji-glyph mb-3">{{ card.emoji }}</div>
                    <div class="text-h4 text-md-h3 font-weight-bold">{{ card.label }}</div>
                    <div class="text-body-1 text-medium-emphasis mt-2">{{ card.kind }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Я хочу..." :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.i-want-shell {
  background: linear-gradient(135deg, #f1f7ff 0%, #fff7e8 52%, #eef8f4 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.card-emoji {
  font-size: clamp(4rem, 9vw, 6.5rem);
  line-height: 1;
}
</style>
