<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateFindShapeRound, type FindShapeId, type FindShapeOption, type FindShapeRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("find-shape", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<FindShapeRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindShapeRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<FindShapeId>();

const shapeView: Record<FindShapeId, { title: string; color: string }> = {
  circle: { title: "Круг", color: "#0f766e" },
  square: { title: "Квадрат", color: "#2563eb" },
  triangle: { title: "Треугольник", color: "#d97706" },
  star: { title: "Звезда", color: "#a855f7" },
  heart: { title: "Сердце", color: "#db2777" },
  diamond: { title: "Ромб", color: "#0891b2" }
};

const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Выбери форму, которая названа сверху.";
  return `Почти. Нужна форма: ${round.value.target.label}. Она мягко подсвечена.`;
});

function choiceTargetId(choiceId: FindShapeId) {
  return `find-shape:choice:${choiceId}`;
}

function choose(choice: FindShapeOption) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.id, actual: choice.id, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.id, actual: choice.id, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-shape-selected" });
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="find-shape-shell">
    <GameHud title="Найди форму" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-shape-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Форма среди карточек</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5" role="status">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length <= 3 ? 4 : 3">
                <GameDwellButton :class="{ 'target-hint': hintedRoundId === round.roundId && choice.id === round.target.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="round.choices.length >= 5 ? 210 : 235" @select="choose(choice)">
                  <template #default>
                    <div :class="['shape-choice', { 'shape-choice--mistake': choice.id === lastMistakeId }]">
                      <svg class="shape-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                        <circle v-if="choice.id === 'circle'" cx="60" cy="60" r="42" :fill="shapeView[choice.id].color" />
                        <rect v-else-if="choice.id === 'square'" x="22" y="22" width="76" height="76" rx="10" :fill="shapeView[choice.id].color" />
                        <polygon v-else-if="choice.id === 'triangle'" points="60,16 104,98 16,98" :fill="shapeView[choice.id].color" />
                        <polygon v-else-if="choice.id === 'star'" points="60,12 74,43 108,46 82,68 90,102 60,84 30,102 38,68 12,46 46,43" :fill="shapeView[choice.id].color" />
                        <path v-else-if="choice.id === 'heart'" d="M60 101 C25 72 14 55 18 36 C22 18 45 15 60 33 C75 15 98 18 102 36 C106 55 95 72 60 101 Z" :fill="shapeView[choice.id].color" />
                        <polygon v-else points="60,10 104,60 60,110 16,60" :fill="shapeView[choice.id].color" />
                      </svg>
                      <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ shapeView[choice.id].title }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-shape-outline" rounded="xl" variant="tonal">
                Ошибка не завершает игру. Посмотри на подсвеченную форму и попробуй ещё раз.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди форму" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-shape-shell {
  background: linear-gradient(135deg, #fff7ed 0%, #eef8ff 52%, #f5f3ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.find-shape-card {
  overflow: hidden;
}

.choice-grid {
  row-gap: 0.75rem;
}

.shape-choice {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: filter 160ms ease, transform 160ms ease;
}

.shape-choice--mistake {
  filter: saturate(0.7) opacity(0.72);
  transform: scale(0.97);
}

.shape-svg {
  block-size: clamp(5.5rem, min(14vw, 19vh), 8.75rem);
  filter: drop-shadow(0 0.4rem 0.45rem rgb(15 23 42 / 16%));
  inline-size: clamp(5.5rem, min(14vw, 19vh), 8.75rem);
}

.target-hint {
  filter: drop-shadow(0 0 1.15rem rgb(var(--v-theme-primary) / 38%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }
}
</style>
