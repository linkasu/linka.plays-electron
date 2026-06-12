<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeShadowMatchAudio, playShadowMatchMistakeMelody, playShadowMatchSuccessMelody, warmShadowMatchAudio } from "./audio";
import { generateShadowMatchRound, type ShadowMatchItem } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("shadow-match", {
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
  generateRound: (roundIndex) => generateShadowMatchRound(session.settings, roundIndex)
});

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);
const hintText = computed(() => {
  if (hintedRoundId.value === round.value.roundId) return `Почти получилось. Подсказка: ${round.value.target.hint}.`;
  return "Посмотри на большую тень, затем выбери похожий предмет.";
});

function choiceTargetId(choiceId: string) {
  return `shadow-match:choice:${choiceId}`;
}

function answer(choice: ShadowMatchItem) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    void playShadowMatchSuccessMelody(session.settings.sound);
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "shadow-mismatch" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  void playShadowMatchMistakeMelody(session.settings.sound);
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}

onMounted(() => {
  warmShadowMatchAudio(session.settings.sound);
});

onUnmounted(() => {
  disposeShadowMatchAudio();
});
</script>

<template>
  <div class="shadow-match-shell">
    <GameHud title="Тень и предмет" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="shadow-match-card pa-3 pa-md-5" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Сравни силуэт и предмет</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-1">{{ round.prompt }}</h1>
            <p class="text-body-1 text-md-h6 text-medium-emphasis text-center mb-3">{{ hintText }}</p>

            <v-card class="shadow-sample mx-auto mb-3 mb-md-4" rounded="xl" variant="tonal" color="blue-grey-lighten-4">
              <v-icon class="shadow-silhouette" :icon="round.target.icon" aria-hidden="true" />
            </v-card>

            <v-row class="choice-grid" dense justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" :cols="round.choices.length === 4 ? 3 : 4" :sm="round.choices.length === 4 ? 3 : 4" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :class="{ 'target-hint': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" min-height="clamp(9rem, 24vh, 13rem)" :color="hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer(choice)">
                  <template #default>
                    <v-icon :class="['choice-icon', { 'choice-icon--mistake': choice.id === lastMistakeId }]" :icon="choice.icon" :color="choice.color" />
                    <div class="text-h6 text-md-h4 font-weight-bold mt-2">{{ choice.label }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Тень и предмет" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.shadow-match-shell {
  background: linear-gradient(135deg, #eef6ff 0%, #f6f0ff 48%, #fff7ed 100%);
  min-block-size: 100vh;
}

.game-container {
  align-items: center;
  display: flex;
  min-block-size: 100vh;
  padding-block: 5rem 2rem;
}

.shadow-match-card {
  inline-size: 100%;
  overflow: hidden;
}

.shadow-sample {
  align-items: center;
  display: flex;
  inline-size: min(14rem, 46vw);
  justify-content: center;
  min-block-size: clamp(7rem, 22vh, 12rem);
}

.shadow-silhouette {
  color: rgb(var(--v-theme-on-surface));
  filter: blur(0.025rem);
  font-size: clamp(5.5rem, min(14vw, 18vh), 9rem);
  line-height: 1;
  opacity: 0.42;
  transform: scaleX(1.08) skewX(-4deg);
}

.choice-grid {
  row-gap: 0.75rem;
}

.choice-icon {
  font-size: clamp(3.8rem, min(8vw, 12vh), 6.5rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-icon--mistake {
  filter: grayscale(0.35) opacity(0.7);
  transform: scale(0.96);
}

.target-hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block: 4.5rem 1.25rem;
  }

  .shadow-sample {
    min-block-size: 6.5rem;
  }
}
</style>
