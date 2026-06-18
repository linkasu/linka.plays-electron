<script setup lang="ts">
import { computed, ref } from "vue";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameSessionChrome from "../../components/game/GameSessionChrome.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { generateMatchSameRound, type MatchSameRound } from "./model";

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("match-same", {
  maxSteps: 8,
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateMatchSameRound(session.settings, roundIndex)
});

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);

function choiceTargetId(choiceId: string) {
  return `match-same:choice:${choiceId}`;
}

function answer(choice: MatchSameRound["choices"][number]) {
  if (session.status !== "running") return;
  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);

  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: true });
    hintedRoundId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
  hintedRoundId.value = round.value.roundId;
}

function restart() {
  hintedRoundId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <GameSessionChrome title="Где такой же?" :session="session" :result-visible="resultVisible" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" gradient="linear-gradient(135deg, #f4f7ff 0%, #fff0e8 100%)" @pause="pauseSession" @resume="resumeSession" @restart="restart">
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="match-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Найди такую же картинку</div>
            <div class="sample-card mx-auto mb-4 mb-md-6">
              <div class="sample-emoji emoji-glyph">{{ round.target.emoji }}</div>
            </div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-4 mb-md-6">{{ round.prompt }}</h1>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="190" :highlight-choice="(choice) => hintedChoiceId === choice.id" :color="(choice) => hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer">
              <template #default="{ choice }">
                <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ choice.word }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </GameSessionChrome>
</template>

<style scoped>
.match-card {
  overflow: hidden;
}

.sample-card {
  align-items: center;
  background: rgb(var(--v-theme-primary) / 10%);
  border: 0.25rem solid rgb(var(--v-theme-primary) / 26%);
  border-radius: 2rem;
  display: flex;
  inline-size: min(15rem, 46vw);
  justify-content: center;
  min-block-size: min(12rem, 25vh);
}

.sample-emoji {
  font-size: clamp(5rem, min(14vw, 17vh), 9rem);
  line-height: 1;
}

.choice-emoji {
  font-size: clamp(3.8rem, min(8vw, 13vh), 6.8rem);
  line-height: 1;
}

@media (max-height: 44rem) {
  .sample-card {
    min-block-size: 8rem;
  }
}
</style>
