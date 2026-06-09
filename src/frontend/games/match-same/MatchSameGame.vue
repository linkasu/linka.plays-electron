<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateMatchSameRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("match-same", {
  maxSteps: 8,
  dwellMs: 1200,
  sessionSeconds: 120
}, {
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

function answer(index: number) {
  if (session.status !== "running") return;
  const choice = round.value.choices[index];
  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);

  if (index === round.value.correctIndex) {
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
  <div class="match-shell">
    <GameHud title="Где такой же?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="match-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Найди такую же картинку</div>
            <div class="sample-card mx-auto mb-4 mb-md-6">
              <div class="sample-emoji emoji-glyph">{{ round.target.emoji }}</div>
            </div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-4 mb-md-6">{{ round.prompt }}</h1>
            <v-row dense justify="center">
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="6" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :class="{ 'hinted-choice': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer(index)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                    <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ choice.word }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Где такой же?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.match-shell {
  background: linear-gradient(135deg, #f4f7ff 0%, #fff0e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

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

.hinted-choice {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .sample-card {
    min-block-size: 8rem;
  }
}
</style>
