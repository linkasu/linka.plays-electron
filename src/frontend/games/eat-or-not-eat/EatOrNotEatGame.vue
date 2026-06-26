<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeEatOrNotEatAudio, playEatOrNotEatMistakeMelody, warmEatOrNotEatAudio } from "./audio";
import { generateEatOrNotEatRound, type EatOrNotEatAnswer, type EatOrNotEatRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("eat-or-not-eat", {
  maxSteps: 8,
  overrides: { dwellMs: 1200, sessionSeconds: 120 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({ gameId: "eat-or-not-eat", soundEnabled: toRef(session.settings, "sound"), warmAssetIds: ["eat-or-not-eat.prompt", "eat-or-not-eat.correct", "eat-or-not-eat.mistake", "eat-or-not-eat.complete"] });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<EatOrNotEatRound>({
  session,
  startSession,
  generateRound: generateEatOrNotEatRound
});
const feedbackText = ref("Выбери, можно ли это есть.");
const isSpeaking = ref(false);

const answers: Array<{ id: EatOrNotEatAnswer; title: string; emoji: string }> = [
  { id: "food", title: "Можно есть", emoji: "🍽️" },
  { id: "thing", title: "Нельзя есть", emoji: "📦" }
];

function answerTargetId(value: EatOrNotEatAnswer) {
  return `eat-or-not-eat:answer:${value}`;
}

async function answer(value: EatOrNotEatAnswer) {
  if (session.status !== "running" || isSpeaking.value) return;
  const targetId = answerTargetId(value);
  const expectedTargetId = answerTargetId(round.value.correctAnswer);
  if (value === round.value.correctAnswer) {
    recordSuccess({ roundId: round.value.roundId, targetId, itemId: round.value.item.id, expected: round.value.correctAnswer, actual: value, isCorrect: true });
    feedbackText.value = "Верно.";
    isSpeaking.value = true;
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["eat-or-not-eat.correct", "eat-or-not-eat.complete"] : ["eat-or-not-eat.correct"], 80, 170);
    isSpeaking.value = false;
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      return;
    }
    nextRound();
    feedbackText.value = "Выбери, можно ли это есть.";
    promptAudio.play("eat-or-not-eat.prompt", 180);
  }
  else {
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, itemId: round.value.item.id, expected: round.value.correctAnswer, actual: value, isCorrect: false });
    void playEatOrNotEatMistakeMelody(session.settings.sound);
    feedbackText.value = "Посмотри на предмет ещё раз и выбери другой ответ.";
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(["eat-or-not-eat.mistake"], 80);
    isSpeaking.value = false;
  }
}

function restart() {
  feedbackText.value = "Выбери, можно ли это есть.";
  isSpeaking.value = false;
  promptAudio.cancelPending();
  restartRoundGame();
  promptAudio.play("eat-or-not-eat.prompt", 220);
}

onMounted(() => {
  warmEatOrNotEatAudio(session.settings.sound);
  promptAudio.warm();
  promptAudio.play("eat-or-not-eat.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  disposeEatOrNotEatAudio();
});

</script>

<template>
  <div class="eat-shell">
    <GameHud title="Съедобное" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="eat-card pa-6 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Куда положим?</div>
            <div class="item-display mb-8">
              <div class="item-emoji emoji-glyph">{{ round.item.emoji }}</div>
              <h1 class="text-h3 font-weight-bold">{{ round.item.word }}</h1>
              <p class="text-h6 text-medium-emphasis mb-0">{{ feedbackText }}</p>
            </div>
            <v-row>
              <v-col v-for="option in answers" :key="option.id" cols="12" md="6">
                <GameDwellButton :target-id="answerTargetId(option.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="13.125rem" @select="answer(option.id)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ option.emoji }}</div>
                    <div class="text-h4 font-weight-bold">{{ option.title }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Съедобное" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.eat-shell {
  background: linear-gradient(135deg, #fff3df 0%, #ecfff5 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.item-display {
  text-align: center;
}

.item-emoji,
.choice-emoji {
  font-size: clamp(4rem, 10vw, 7rem);
  line-height: 1;
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .eat-card {
    padding: 1rem !important;
  }

  .eat-card > .text-overline {
    display: none;
  }

  .item-display {
    margin-block-end: 0.9rem !important;
  }

  .item-display h1 {
    font-size: clamp(2rem, 6vh, 2.5rem) !important;
  }

  .item-display p {
    font-size: 1rem !important;
  }

  .item-emoji,
  .choice-emoji {
    font-size: clamp(3rem, 9vh, 4.25rem);
  }

  .eat-card :deep(.dwell-button) {
    min-block-size: 10rem !important;
  }
}
</style>
