<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateBigCardsRound, type BigCard, type BigCardsRound } from "./model";

const router = useRouter();
const isResponding = ref(false);
const feedbackText = ref("Посмотри на карточку, какая тебе больше нравится.");
let feedbackTimer = 0;
let introTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSessionFor("big-cards", {
  maxSteps: 8,
  overrides: {
    preset: "gentle",
    targetScale: 1.6,
    motionSpeed: 0.45,
    distractors: "none",
    hints: "high"
  },
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({ gameId: "big-cards", soundEnabled: toRef(session.settings, "sound") });

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
  promptAudio.play(`big-cards.${card.id}`);
  recordSuccess({
    roundId: round.value.roundId,
    targetId: cardTargetId(round.value.roundId, card.id),
    cardId: card.id,
    label: card.label,
    suggestedId: round.value.suggested.id,
    isSuggested: card.id === round.value.suggested.id
  });

  window.clearTimeout(feedbackTimer);
  promptAudio.cancelPending();
  feedbackTimer = window.setTimeout(() => {
    isResponding.value = false;
    feedbackText.value = "Можно выбрать любую карточку.";
    if (session.status === "running" && session.step < session.maxSteps) nextRound();
  }, 850);
}

function restart() {
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(introTimer);
  isResponding.value = false;
  feedbackText.value = "Посмотри на карточку, какая тебе больше нравится.";
  restartRound();
  promptAudio.play("big-cards.intro");
}

onMounted(() => {
  promptAudio.warm();
  introTimer = window.setTimeout(() => {
    promptAudio.play("big-cards.intro");
  }, 450);
});

onUnmounted(() => {
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(introTimer);
  promptAudio.dispose();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #fff7ed 0%, #eef8ff 52%, #f4fff1 100%)">
    <template #hud>
      <GameHud title="Большие карточки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="big-cards-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="9">
          <v-card class="pa-5 pa-md-8" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Мягкий выбор без ошибок</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">Большие карточки</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-2">{{ round.prompt }}</p>
            <p class="text-h6 text-md-h5 text-center mb-6">{{ feedbackText }}</p>

            <GameChoiceCardGrid :choices="round.choices" :target-id="(card) => cardTargetId(round.roundId, card.id)" :disabled="session.status !== 'running' || isResponding" :dwell-ms="session.settings.dwellMs" :min-height="260" :cols="12" :sm="6" :md="round.choices.length === 3 ? 4 : 6" :lg="round.choices.length === 4 ? 3 : round.choices.length === 3 ? 4 : 5" @select="choose">
              <template #default="{ choice: card, active, progress }">
                <div class="card-emoji emoji-glyph">{{ card.emoji }}</div>
                <div class="text-h4 text-md-h3 font-weight-bold mt-3">{{ card.label }}</div>
                <div class="big-card-note text-body-1 text-md-h6 font-weight-medium mt-2">
                  {{ active && progress > 0.8 ? "Почти готово" : card.id === round.suggested.id ? "Мягкая подсказка" : "Тоже можно" }}
                </div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Большие карточки" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.card-emoji {
  font-size: clamp(5.5rem, min(13vw, 20vh), 10rem);
  line-height: 1;
}

.big-card-note {
  color: rgb(var(--v-theme-on-surface));
}

@media (max-height: 44rem) {
  .card-emoji {
    font-size: clamp(4.5rem, min(11vw, 16vh), 8rem);
  }
}
</style>
