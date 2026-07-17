<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeEatOrNotEatAudio, playEatOrNotEatMistakeMelody, warmEatOrNotEatAudio } from "./audio";
import { createEatOrNotEatRoundGenerator, type EatOrNotEatAnswer, type EatOrNotEatRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("eat-or-not-eat", {
  maxSteps: 8,
  overrides: { dwellMs: 1200, sessionSeconds: 120 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({ gameId: "eat-or-not-eat", soundEnabled: toRef(session.settings, "sound"), warmAssetIds: ["eat-or-not-eat.prompt", "eat-or-not-eat.correct", "eat-or-not-eat.mistake", "eat-or-not-eat.complete"] });

let generateRound = createEatOrNotEatRoundGenerator();
const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<EatOrNotEatRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateRound(roundIndex)
});
const feedbackText = ref("Выбери зону: еда или не еда.");
const isSpeaking = ref(false);

const answers: Array<{ id: EatOrNotEatAnswer; title: string; helper: string; emoji: string; color: string }> = [
  { id: "food", title: "Еда", helper: "Можно есть", emoji: "🍎", color: "green-lighten-4" },
  { id: "thing", title: "Не еда", helper: "Нельзя есть", emoji: "🧸", color: "blue-lighten-4" }
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
    feedbackText.value = "Выбери зону: еда или не еда.";
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
  feedbackText.value = "Выбери зону: еда или не еда.";
  isSpeaking.value = false;
  promptAudio.cancelPending();
  generateRound = createEatOrNotEatRoundGenerator();
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
            <div class="text-overline text-secondary text-center mb-2">Разложи по двум зонам</div>
            <div class="item-display mb-8">
              <GameWordImage class="item-emoji" :word-id="round.item.id" :word="round.item.word" :emoji="round.item.emoji" />
              <h1 class="text-h3 font-weight-bold">{{ round.prompt }}</h1>
              <p class="text-h6 text-medium-emphasis mb-0">{{ feedbackText }}</p>
            </div>
            <v-row>
              <v-col v-for="option in answers" :key="option.id" cols="12" sm="6">
                <GameDwellButton :target-id="answerTargetId(option.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="13.125rem" :color="option.color" @select="answer(option.id)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ option.emoji }}</div>
                    <div class="text-h3 font-weight-bold">{{ option.title }}</div>
                    <div class="text-h6 mt-2">{{ option.helper }}</div>
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

 .eat-card >.text-overline {
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
