<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateGreaterLessRound, type GreaterLessSide } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("greater-less", {
  maxSteps: 8,
  overrides: { dwellMs: 1200, sessionSeconds: 120, sound: false }
});

const hint = ref("");
const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateGreaterLessRound(session.settings, roundIndex)
});

function sideTargetId(side: GreaterLessSide) {
  return `greater-less:choice:${side}`;
}

function sideLabel(side: GreaterLessSide) {
  return side === "left" ? "слева" : "справа";
}

function buildHint() {
  const left = round.value.left.count;
  const right = round.value.right.count;
  const correct = sideLabel(round.value.correctSide);
  return round.value.comparison === "more"
    ? `Больше ${correct}: ${Math.max(left, right)} больше, чем ${Math.min(left, right)}.`
    : `Меньше ${correct}: ${Math.min(left, right)} меньше, чем ${Math.max(left, right)}.`;
}

function choose(side: GreaterLessSide) {
  if (session.status !== "running") return;
  const targetId = sideTargetId(side);
  const expectedTargetId = sideTargetId(round.value.correctSide);
  const selectedCount = side === "left" ? round.value.left.count : round.value.right.count;
  const expectedCount = round.value.correctSide === "left" ? round.value.left.count : round.value.right.count;

  if (side === round.value.correctSide) {
    hint.value = "";
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expectedSide: round.value.correctSide, selectedSide: side, expected: expectedCount, actual: selectedCount, isCorrect: true });
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  hint.value = buildHint();
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, expectedSide: round.value.correctSide, selectedSide: side, expected: expectedCount, actual: selectedCount, isCorrect: false });
  recordHint({ roundId: round.value.roundId, text: hint.value });
}

function restartGame() {
  hint.value = "";
  restart();
}
</script>

<template>
  <div class="greater-less-shell">
    <GameHud title="Больше / меньше" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Сравни группы</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert v-if="hint" class="mb-4 text-body-1 font-weight-bold" color="primary" icon="mdi-lightbulb-outline" rounded="xl" variant="tonal">
              {{ hint }}
            </v-alert>
            <v-row class="choice-row" dense>
              <v-col v-for="group in [round.left, round.right]" :key="group.side" cols="12" sm="6" md="6">
                <GameDwellButton :target-id="sideTargetId(group.side)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="250" color="surface" @select="choose(group.side)">
                  <template #default>
                    <div class="group-label text-overline mb-3">{{ group.side === "left" ? "Слева" : "Справа" }}</div>
                    <div class="group-items" aria-hidden="true">
                      <span v-for="(item, index) in group.items" :key="index" class="group-emoji emoji-glyph">{{ item }}</span>
                    </div>
                    <div class="sr-only">{{ group.side === "left" ? "Левая" : "Правая" }} группа</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Больше / меньше" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.greater-less-shell {
  background: linear-gradient(135deg, #fff6df 0%, #e8f6ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.choice-row {
  row-gap: 1rem;
}

.group-items {
  align-content: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  justify-content: center;
  margin-inline: auto;
  max-inline-size: 30rem;
  min-block-size: 13rem;
}

.group-label {
  color: #263238;
}

.group-emoji {
  font-size: clamp(3.25rem, min(7vw, 9vh), 5.25rem);
  line-height: 1;
}

.sr-only {
  block-size: 1px;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (min-width: 68.75rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }
}

@media (max-height: 40rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .choice-row :deep(.dwell-button) {
    min-block-size: 13rem !important;
  }

  .group-items {
    min-block-size: 8rem;
  }
}
</style>
