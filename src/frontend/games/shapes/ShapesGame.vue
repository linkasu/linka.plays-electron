<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateShapesRound, type ShapeId, type ShapeOption, type ShapesRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("shapes", {
  maxSteps: 8,
  overrides: { dwellMs: 1200, sessionSeconds: 120, sound: false }
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<ShapesRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateShapesRound(session.settings, roundIndex)
});

const hintText = ref("");

const shapeView: Record<ShapeId, { color: string; label: string }> = {
  circle: { color: "#0f766e", label: "Круг" },
  square: { color: "#1d4ed8", label: "Квадрат" },
  triangle: { color: "#b45309", label: "Треугольник" },
  star: { color: "#a21caf", label: "Звезда" }
};

function choiceTargetId(choiceId: ShapeId) {
  return `shapes:choice:${choiceId}`;
}

function choose(choice: ShapeOption, index: number) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);

  if (index === round.value.correctIndex) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.id, actual: choice.id, isCorrect: true });
    hintText.value = "";
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  hintText.value = `Почти. Нужна форма: ${shapeView[round.value.target.id].label.toLowerCase()}.`;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.id, actual: choice.id, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, hint: hintText.value });
}

function restart() {
  hintText.value = "";
  restartRoundGame();
}
</script>

<template>
  <div class="shapes-shell">
    <GameHud title="Формы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="shapes-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Смотрим на форму</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <v-alert class="hint-alert mb-4" :class="{ 'hint-alert--visible': hintText }" color="primary" variant="tonal" rounded="xl" density="comfortable" role="status">
              {{ hintText || "Выбери подходящую большую карточку." }}
            </v-alert>
            <v-row class="choice-row" justify="center">
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="6" md="3" class="choice-col">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="190" @select="choose(choice, index)">
                  <template #default>
                    <div class="shape-wrap" :aria-label="shapeView[choice.id].label">
                      <svg class="shape-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                        <circle v-if="choice.id === 'circle'" cx="60" cy="60" r="42" :fill="shapeView[choice.id].color" />
                        <rect v-else-if="choice.id === 'square'" x="22" y="22" width="76" height="76" rx="8" :fill="shapeView[choice.id].color" />
                        <polygon v-else-if="choice.id === 'triangle'" points="60,16 104,98 16,98" :fill="shapeView[choice.id].color" />
                        <polygon v-else points="60,12 74,43 108,46 82,68 90,102 60,84 30,102 38,68 12,46 46,43" :fill="shapeView[choice.id].color" />
                      </svg>
                      <div class="text-h5 text-md-h4 font-weight-bold mt-2">{{ shapeView[choice.id].label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Формы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.shapes-shell {
  background: linear-gradient(135deg, #fff7ed 0%, #ecfeff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.shapes-card {
  background: rgb(var(--v-theme-surface));
}

.hint-alert {
  margin-inline: auto;
  max-inline-size: 42rem;
  opacity: 0.72;
  text-align: center;
}

.hint-alert--visible {
  opacity: 1;
}

.choice-row {
  row-gap: 0.5rem;
}

.choice-col {
  min-inline-size: 10rem;
}

.shape-wrap {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.shape-svg {
  block-size: clamp(5.5rem, min(16vw, 22vh), 9.5rem);
  filter: drop-shadow(0 0.35rem 0.4rem rgb(15 23 42 / 18%));
  inline-size: clamp(5.5rem, min(16vw, 22vh), 9.5rem);
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 7.75rem;
  }

  .shape-svg {
    block-size: 5.75rem;
    inline-size: 5.75rem;
  }
}

@media (max-height: 40rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }
}
</style>
