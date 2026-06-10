<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateActionWhoRound, type ActionWhoChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("action-who", {
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
  generateRound: (roundIndex) => generateActionWhoRound(session.settings, roundIndex)
});

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);
const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Выбери карточку, где персонаж делает названное действие.";
  return `Почти. Правильная карточка подсвечена: ${round.value.target.character.name} ${round.value.target.action.label}.`;
});

function choiceTargetId(choiceId: string) {
  return `action-who:choice:${choiceId}`;
}

function mdCols(choiceCount: number) {
  return choiceCount === 2 ? 5 : 4;
}

function answer(choice: ActionWhoChoice) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.action.label, actual: choice.action.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.action.label, actual: choice.action.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-action-selected" });
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
  <div class="action-who-shell">
    <GameHud title="Кто что делает?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="action-who-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC: действие и персонаж</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>

            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="mdCols(round.choices.length)">
                <GameDwellButton :class="{ 'target-hint': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="230" :color="hintedChoiceId === choice.id ? 'primary' : choice.action.color" @select="answer(choice)">
                  <template #default="{ active, progress }">
                    <div :class="['action-choice', { 'action-choice--mistake': choice.id === lastMistakeId }]">
                      <div class="character-stack" :style="{ '--character-color': choice.character.color }">
                        <v-icon class="character-icon" :icon="choice.character.icon" />
                        <v-icon class="action-icon" :icon="choice.action.icon" />
                      </div>
                      <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ choice.character.name }}</div>
                      <div class="text-h6 text-md-h5 text-medium-emphasis mt-1">
                        {{ hintedChoiceId === choice.id && active && progress > 0.72 ? 'вот ответ' : choice.action.label }}
                      </div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-check-circle-outline" rounded="xl" variant="tonal">
                Ошибка не страшна. Посмотри на подсвеченную карточку и удержи взгляд спокойно.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Кто что делает?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.action-who-shell {
  background: linear-gradient(135deg, #fff6e8 0%, #edf7ff 52%, #f4efff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.action-who-card {
  overflow: hidden;
}

.choice-grid {
  row-gap: 0.75rem;
}

.action-choice {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 12rem;
  transition: filter 160ms ease, transform 160ms ease;
}

.character-stack {
  align-items: center;
  display: grid;
  grid-template-areas: "stack";
  justify-items: center;
}

.character-icon,
.action-icon {
  grid-area: stack;
}

.character-icon {
  color: var(--character-color);
  font-size: clamp(5rem, min(12vw, 17vh), 8rem);
}

.action-icon {
  background: rgb(var(--v-theme-surface) / 86%);
  border-radius: 999px;
  color: rgb(var(--v-theme-primary));
  font-size: clamp(2.4rem, min(5vw, 7vh), 3.8rem);
  margin-inline-start: clamp(4.5rem, 9vw, 6.5rem);
  margin-block-start: clamp(3rem, 6vh, 4.5rem);
  padding: 0.45rem;
}

.target-hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

.action-choice--mistake {
  filter: saturate(0.72) opacity(0.74);
  transform: scale(0.96);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .action-choice {
    min-block-size: 9.75rem;
  }
}
</style>
