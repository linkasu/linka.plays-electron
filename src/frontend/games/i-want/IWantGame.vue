<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { buildIWantPhrase, generateIWantRound, iWantCards, type IWantCard, type IWantRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession, finishSession } = useGameSessionFor("i-want", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 120, targetScale: 1.05 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({
  gameId: "i-want",
  soundEnabled: toRef(session.settings, "sound"),
  volume: 0.34,
  warmAssetIds: ["i-want.intro", "i-want.next", "i-want.complete"]
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<IWantRound>({
  session,
  startSession,
  generateRound: generateIWantRound
});

const feedback = ref("Выбери карточку, чтобы сказать: «Я хочу ...».");
const selectedCardId = ref<string>();
const isChangingRound = ref(false);
const cardMinHeight = computed(() => Math.round(184 * session.settings.targetScale));
const phrase = computed(() => {
  const selectedCard = iWantCards.find((card) => card.id === selectedCardId.value);
  return buildIWantPhrase(selectedCard);
});

function cardTargetId(card: IWantCard) {
  return `i-want:card:${card.id}`;
}

function phraseAssetId(card: IWantCard) {
  return `i-want.phrase.${card.id}`;
}

async function choose(card: IWantCard) {
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
  const finishedAfterSuccess = session.step >= session.maxSteps;
  await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [phraseAssetId(card), "i-want.complete"] : [phraseAssetId(card)], 80, 170);

  if (finishedAfterSuccess) {
    feedback.value = "Спасибо. Я услышал твои желания.";
    finishSession("game-complete");
    isChangingRound.value = false;
    return;
  }

  if (session.status === "running") {
    nextRound();
    selectedCardId.value = undefined;
    feedback.value = "Следующий выбор. Можно выбрать любую карточку.";
    await promptAudio.playSequenceAndWait(["i-want.next"], 180);
  } else {
    feedback.value = "Спасибо. Я услышал твои желания.";
  }
  isChangingRound.value = false;
}

function restart() {
  feedback.value = "Выбери карточку, чтобы сказать: «Я хочу ...».";
  selectedCardId.value = undefined;
  isChangingRound.value = false;
  restartRoundGame();
  promptAudio.cancelPending();
  promptAudio.play("i-want.intro", 260);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("i-want.intro", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="i-want-shell">
    <GameHud title="Я хочу..." :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="10">
          <v-card class="i-want-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC: любой выбор засчитывается</div>
            <div class="phrase-panel text-center mb-4 mb-md-5">
              <v-chip class="mb-3" color="primary" size="large" variant="tonal">{{ round.prompt }}</v-chip>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ phrase }}</h1>
              <div class="feedback-text text-body-1 text-md-h6 text-medium-emphasis">{{ feedback }}</div>
            </div>

            <v-row dense>
              <v-col v-for="card in round.cards" :key="card.id" cols="6" sm="4" md="4">
                <GameDwellButton :target-id="cardTargetId(card)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="cardMinHeight" :color="selectedCardId === card.id ? 'deep-purple-darken-3' : 'surface'" @select="choose(card)">
                  <template #default>
                    <div class="card-content">
                      <div class="card-emoji emoji-glyph mb-2" aria-hidden="true">{{ card.emoji }}</div>
                      <div class="card-label text-h5 text-md-h4 font-weight-bold">{{ card.label }}</div>
                      <div class="card-kind text-body-2 mt-1">{{ card.kind }}</div>
                    </div>
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
  padding-block-start: 7rem;
}

.card-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 8.5rem;
  text-align: center;
}

.card-emoji {
  font-size: clamp(3.4rem, 7vw, 5.4rem);
  line-height: 1;
}

.card-kind {
  color: #263238;
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 4.25rem;
  }

  .i-want-card {
    padding: 1rem !important;
  }

  .i-want-card > .text-overline {
    display: none;
  }

  .phrase-panel {
    margin-block-end: 0.75rem !important;
  }

  .i-want-card h1 {
    font-size: 2rem !important;
    line-height: 1.05;
    margin-block: 0.35rem !important;
  }

  .feedback-text,
  .i-want-card :deep(.v-chip) {
    font-size: 0.9rem !important;
  }

  .game-container :deep(.dwell-button) {
    min-block-size: 6.6rem !important;
  }

  .card-content {
    min-block-size: 5.8rem;
  }

  .card-emoji {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-block-end: 0.2rem !important;
  }

  .card-label {
    font-size: 1.15rem !important;
    line-height: 1.05;
  }

  .card-kind {
    font-size: 0.875rem !important;
    margin-block-start: 0.25rem !important;
  }
}
</style>
