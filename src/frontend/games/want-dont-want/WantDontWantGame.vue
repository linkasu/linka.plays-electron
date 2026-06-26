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
import { generateWantDontWantRound, type WantDontWantAnswer, type WantDontWantRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession, finishSession } = useGameSessionFor("want-dont-want", {
  maxSteps: 9,
  overrides: { preset: "gentle", dwellMs: 1300, sessionSeconds: 120, targetScale: 1.2 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({
  gameId: "want-dont-want",
  soundEnabled: toRef(session.settings, "sound"),
  volume: 0.34,
  warmAssetIds: ["want-dont-want.intro", "want-dont-want.next", "want-dont-want.complete"]
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<WantDontWantRound>({
  session,
  startSession,
  generateRound: generateWantDontWantRound
});

const feedback = ref("Посмотри на ответ, который подходит тебе сейчас.");
const isChangingRound = ref(false);
const choiceMinHeight = computed(() => Math.round(220 * session.settings.targetScale));

function answerTargetId(value: WantDontWantAnswer) {
  return `want-dont-want:answer:${value}`;
}

function phraseAssetId(value: WantDontWantAnswer) {
  return `want-dont-want.phrase.${value}.${round.value.item.id}`;
}

async function answer(value: WantDontWantAnswer) {
  if (session.status !== "running" || isChangingRound.value) return;

  const choice = round.value.choices.find((item) => item.id === value);
  if (!choice) return;

  isChangingRound.value = true;
  const targetId = answerTargetId(value);
  recordSuccess({
    roundId: round.value.roundId,
    targetId,
    answerId: value,
    itemId: round.value.item.id,
    expected: "valid-communication",
    actual: value,
    isCorrect: true
  });
  feedback.value = `Ты сказал: «${choice.confirmation} ${round.value.item.title}». Спасибо, я понял.`;
  const finishedAfterSuccess = session.step >= session.maxSteps;
  await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [phraseAssetId(value), "want-dont-want.complete"] : [phraseAssetId(value)], 80, 170);

  if (finishedAfterSuccess) {
    feedback.value = "Спасибо. Я услышал твой выбор.";
    finishSession("game-complete");
    isChangingRound.value = false;
    return;
  }

  if (session.status === "running" && session.step < session.maxSteps) {
    nextRound();
    feedback.value = "Следующий выбор. Можно сказать как тебе подходит.";
    await promptAudio.playSequenceAndWait(["want-dont-want.next"], 180);
  } else {
    feedback.value = "Спасибо. Я услышал твой выбор.";
  }
  isChangingRound.value = false;
}

function restart() {
  feedback.value = "Посмотри на ответ, который подходит тебе сейчас.";
  isChangingRound.value = false;
  restartRoundGame();
  promptAudio.cancelPending();
  promptAudio.play("want-dont-want.intro", 260);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("want-dont-want.intro", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="want-shell">
    <GameHud title="Хочу / не хочу" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="want-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Любой ответ важен</div>
            <div class="item-display mb-4 mb-md-5">
              <v-chip class="mb-3 text-white" color="deep-purple-darken-3" size="large" variant="flat">{{ round.item.kind }}</v-chip>
              <div class="item-emoji emoji-glyph">{{ round.item.emoji }}</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ round.item.title }}</h1>
              <div class="want-prompt text-h6 text-md-h5">{{ round.prompt }}</div>
              <div class="text-h6 text-md-h5 mt-3">{{ feedback }}</div>
            </div>

            <v-row>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" md="6">
                <GameDwellButton :target-id="answerTargetId(choice.id)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="choiceMinHeight" :color="choice.id === 'want' ? 'deep-purple-darken-3' : 'teal-darken-3'" @select="answer(choice.id)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                    <div class="text-h3 text-md-h2 font-weight-bold">{{ choice.title }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Хочу / не хочу" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.want-shell {
  background: linear-gradient(135deg, #fff7e8 0%, #eef8f4 52%, #f5f0ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 7rem;
}

.item-display {
  text-align: center;
}

.want-prompt {
  color: #263238;
}

.item-emoji {
  font-size: clamp(5rem, 12vw, 8.5rem);
  line-height: 1;
}

.choice-emoji {
  font-size: clamp(4rem, 9vw, 6.5rem);
  line-height: 1;
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 4.25rem;
  }

  .want-card {
    padding: 1rem !important;
  }

  .item-display {
    margin-block-end: 0.75rem !important;
  }

  .item-emoji {
    font-size: clamp(3rem, 7vw, 4.4rem);
  }

  .want-card h1 {
    font-size: 2.1rem !important;
    line-height: 1.05;
  }

  .game-container :deep(.dwell-button) {
    min-block-size: 9.2rem !important;
  }
}
</style>
