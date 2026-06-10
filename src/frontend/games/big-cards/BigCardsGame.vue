<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateBigCardsRound, type BigCard, type BigCardsRound } from "./model";

const router = useRouter();
const isResponding = ref(false);
const feedbackText = ref("Выбери одну большую карточку взглядом.");
let feedbackTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("big-cards", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 90,
  targetScale: 1.6,
  motionSpeed: 0.45,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRound } = useRoundGame<BigCardsRound>({
  session,
  startSession,
  generateRound: generateBigCardsRound
});

function cardTargetId(roundId: string, cardId: string) {
  return `big-cards:${roundId}:card:${cardId}`;
}

function choose(card: BigCard) {
  if (session.status !== "running" || isResponding.value) return;

  isResponding.value = true;
  feedbackText.value = `Ты выбрал: ${card.label}. Хорошо.`;
  recordSuccess({
    roundId: round.value.roundId,
    targetId: cardTargetId(round.value.roundId, card.id),
    cardId: card.id,
    label: card.label,
    suggestedId: round.value.suggested.id,
    isSuggested: card.id === round.value.suggested.id
  });

  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    isResponding.value = false;
    feedbackText.value = "Можно выбрать любую карточку.";
    if (session.status === "running" && session.step < session.maxSteps) nextRound();
  }, 850);
}

function restart() {
  window.clearTimeout(feedbackTimer);
  isResponding.value = false;
  feedbackText.value = "Выбери одну большую карточку взглядом.";
  restartRound();
}

onUnmounted(() => {
  window.clearTimeout(feedbackTimer);
});
</script>

<template>
  <div class="big-cards-shell">
    <GameHud title="Большие карточки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="big-cards-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="9">
          <v-card class="pa-5 pa-md-8" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Мягкий выбор без ошибок</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">Большие карточки</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-2">{{ round.prompt }}</p>
            <p class="text-h6 text-md-h5 text-center mb-6">{{ feedbackText }}</p>

            <v-row class="card-grid" justify="center">
              <v-col v-for="card in round.choices" :key="card.id" cols="12" sm="6" :md="round.choices.length === 3 ? 4 : 6" :lg="round.choices.length === 4 ? 3 : round.choices.length === 3 ? 4 : 5">
                <GameDwellButton :target-id="cardTargetId(round.roundId, card.id)" :disabled="session.status !== 'running' || isResponding" :dwell-ms="session.settings.dwellMs" :min-height="260" :color="card.color" @select="choose(card)">
                  <template #default="{ active, progress }">
                    <div class="card-emoji emoji-glyph">{{ card.emoji }}</div>
                    <div class="text-h4 text-md-h3 font-weight-bold mt-3">{{ card.label }}</div>
                    <div class="text-body-1 text-md-h6 text-medium-emphasis mt-2">
                      {{ active && progress > 0.8 ? "Почти готово" : card.id === round.suggested.id ? "Мягкая подсказка" : "Тоже можно" }}
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Большие карточки" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.big-cards-shell {
  background: linear-gradient(135deg, #fff7ed 0%, #eef8ff 52%, #f4fff1 100%);
  min-block-size: 100vh;
}

.big-cards-container {
  padding-block-start: 8.75rem;
}

.card-grid {
  row-gap: 1rem;
}

.card-emoji {
  font-size: clamp(5.5rem, min(13vw, 20vh), 10rem);
  line-height: 1;
}

@media (max-height: 44rem) {
  .big-cards-container {
    padding-block-start: 7.5rem;
  }

  .card-emoji {
    font-size: clamp(4.5rem, min(11vw, 16vh), 8rem);
  }
}
</style>
