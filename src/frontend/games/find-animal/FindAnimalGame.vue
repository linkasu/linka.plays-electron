<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateFindAnimalRound, type FindAnimalChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("find-animal", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindAnimalRound(session.settings, roundIndex)
});

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);
const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Посмотри на названного зверька и удержи взгляд.";
  return `Почти получилось. Верный зверёк подсвечен: ${round.value.target.word}.`;
});

function choiceTargetId(choiceId: string) {
  return `find-animal:choice:${choiceId}`;
}

function mdCols(choiceCount: number) {
  if (choiceCount <= 2) return 5;
  if (choiceCount === 3) return 4;
  return 3;
}

function lgCols(choiceCount: number) {
  return choiceCount === 5 ? 2 : mdCols(choiceCount);
}

function answer(choice: FindAnimalChoice) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-animal-selected" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="find-animal-shell">
    <GameHud title="Найди животное" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="find-animal-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Лесная поляна</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="mdCols(round.choices.length)" :lg="lgCols(round.choices.length)">
                <GameDwellButton :class="{ 'target-hint': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="round.choices.length >= 5 ? 190 : 230" :color="hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer(choice)">
                  <template #default="{ active, progress }">
                    <div :class="['animal-emoji', 'emoji-glyph', { 'animal-emoji--mistake': choice.id === lastMistakeId }]">{{ choice.emoji }}</div>
                    <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ hintedChoiceId === choice.id && active && progress > 0.78 ? `Вот ${choice.word}` : choice.word }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-paw" rounded="xl" variant="tonal">
                Ошибки не страшны. Попробуй посмотреть на карточку: {{ round.target.word }}.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди животное" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-animal-shell {
  background: linear-gradient(135deg, #fff8ed 0%, #edf7f0 54%, #eef4ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.find-animal-card {
  overflow: hidden;
}

.choice-grid {
  row-gap: 0.75rem;
}

.animal-emoji {
  font-size: clamp(4.8rem, min(11vw, 16vh), 8rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.animal-emoji--mistake {
  filter: saturate(0.75) opacity(0.72);
  transform: scale(0.96);
}

.target-hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }
}
</style>
