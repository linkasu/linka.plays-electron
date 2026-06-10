<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateFindLetterRound, type FindLetterOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("find-letter", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindLetterRound(session.settings, roundIndex)
});

const feedbackMessage = ref("Посмотри на образец и найди такую же букву.");
const hintedRoundId = ref<string>();
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const pendingSelection = ref(false);
let feedbackTimer = 0;

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);

function choiceTargetId(choice: FindLetterOption) {
  return `find-letter:choice:${choice.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  feedbackMessage.value = "Посмотри на образец и найди такую же букву.";
  hintedRoundId.value = undefined;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
  pendingSelection.value = false;
}

function answer(choice: FindLetterOption) {
  if (session.status !== "running" || pendingSelection.value) return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.target);
  clearFeedbackTimer();

  if (choice.id === round.value.target.id) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    feedbackMessage.value = "Верно. Это нужная буква.";
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.letter, actual: choice.letter, isCorrect: true });

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
      }, 550);
    }
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = choice.id;
  hintedRoundId.value = round.value.roundId;
  feedbackMessage.value = `Почти. Ищи букву ${round.value.target.letter}; она подсвечена мягкой рамкой.`;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.letter, actual: choice.letter, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
  }, 850);
}

function choiceColor(choice: FindLetterOption) {
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (hintedChoiceId.value === choice.id) return "primary";
  return "surface";
}

function restart() {
  resetFeedback();
  restartRoundGame();
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="find-letter-shell">
    <GameHud title="Найди букву" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-letter-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Зрительный поиск</div>
            <div class="target-letter-card mx-auto mb-4" aria-label="Буква для поиска">
              <div class="target-letter">{{ round.target.letter }}</div>
            </div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ feedbackMessage }}</p>

            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="6" sm="4" :md="round.choices.length > 4 ? 4 : 3">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="answer(choice)">
                  <template #default>
                    <div :class="['letter-choice', { 'letter-choice--hinted': hintedChoiceId === choice.id, 'letter-choice--mistake': wrongChoiceId === choice.id }]">
                      {{ choice.letter }}
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди букву" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-letter-shell {
  background: linear-gradient(135deg, #f5f7ff 0%, #fff3e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.find-letter-card {
  overflow: hidden;
}

.target-letter-card {
  align-items: center;
  background: rgb(var(--v-theme-primary) / 10%);
  border: 0.25rem solid rgb(var(--v-theme-primary) / 28%);
  border-radius: 2rem;
  display: flex;
  inline-size: min(14rem, 44vw);
  justify-content: center;
  min-block-size: min(11rem, 24vh);
}

.target-letter,
.letter-choice {
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 700;
  line-height: 1;
}

.target-letter {
  color: rgb(var(--v-theme-primary));
  font-size: clamp(5.5rem, min(15vw, 18vh), 9.5rem);
}

.letter-choice {
  color: rgb(var(--v-theme-on-surface));
  font-size: clamp(5rem, min(11vw, 15vh), 8rem);
  transition: transform 160ms ease, text-shadow 160ms ease;
}

.letter-choice--hinted {
  color: rgb(var(--v-theme-on-primary));
  text-shadow: 0 0 1rem rgb(255 255 255 / 42%);
  transform: scale(1.08);
}

.letter-choice--mistake {
  transform: scale(0.96);
}

.choice-grid {
  row-gap: 0.75rem;
}

@media (max-height: 43rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .target-letter-card {
    min-block-size: 8rem;
  }
}
</style>
