<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateDominoMatchingRound, type DominoChoice, type DominoSide, type DominoTile } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("domino-matching", {
  maxSteps: 10,
  dwellMs: 1300,
  sessionSeconds: 180
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateDominoMatchingRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

const helperText = computed(() => {
  if (hintedRoundId.value === round.value.roundId) return `Почти. ${round.value.explanation} Правильная сторона мягко подсвечена.`;
  return round.value.instruction;
});

function choiceTargetId(choice: DominoChoice) {
  return `domino-matching:choice:${choice.id}`;
}

function dotArray(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

function sideValue(tile: DominoTile, side: DominoSide) {
  return tile[side];
}

function sideName(side: DominoSide) {
  return side === "left" ? "левая" : "правая";
}

function choose(choice: DominoChoice) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.choices[round.value.correctIndex]);
  const actualDots = choice.tile[choice.matchSide];

  if (actualDots === round.value.targetDots) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.targetDots, actual: actualDots, side: choice.matchSide, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.targetDots, actual: actualDots, side: choice.matchSide, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, text: round.value.explanation, reason: "wrong-domino-side" });
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="domino-shell">
    <GameHud title="Домино: найди сторону" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Strategy · counting · classification</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-4">{{ round.prompt }}</h1>

            <v-row class="align-stretch" dense>
              <v-col cols="12" md="4">
                <v-sheet class="target-panel pa-4" color="primary" rounded="xl">
                  <div class="text-overline text-white text-center mb-3">Открытая сторона: {{ sideName(round.openSide) }}</div>
                  <div class="domino domino--target" aria-label="Домино, к которому нужно подобрать пару">
                    <div :class="['domino__half', { 'domino__half--open': round.openSide === 'left' }]">
                      <span v-for="dot in dotArray(round.target.left)" :key="`target-left-${dot}`" class="domino__dot" />
                    </div>
                    <div :class="['domino__half', { 'domino__half--open': round.openSide === 'right' }]">
                      <span v-for="dot in dotArray(round.target.right)" :key="`target-right-${dot}`" class="domino__dot" />
                    </div>
                  </div>
                  <div class="text-h5 text-md-h4 font-weight-bold text-white text-center mt-4">{{ round.targetDots }} точек</div>
                </v-sheet>
              </v-col>

              <v-col cols="12" md="8">
                <v-alert class="mb-4 text-body-1 text-md-h6 font-weight-bold" :color="hintedRoundId === round.roundId ? 'secondary' : 'primary'" :icon="hintedRoundId === round.roundId ? 'mdi-heart-outline' : 'mdi-dots-grid'" rounded="xl" variant="tonal">
                  {{ helperText }}
                </v-alert>

                <v-row class="choice-grid" dense>
                  <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6">
                    <GameDwellButton :class="{ 'target-hint': hintedRoundId === round.roundId && choice.tile[choice.matchSide] === round.targetDots }" :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="210" :color="hintedRoundId === round.roundId && choice.tile[choice.matchSide] === round.targetDots ? 'primary' : 'surface'" @select="choose(choice)">
                      <template #default>
                        <div :class="['choice-card', { 'choice-card--mistake': choice.id === lastMistakeId }]">
                          <div class="text-overline text-medium-emphasis mb-2">Смотри на {{ sideName(choice.matchSide) }} сторону</div>
                          <div class="domino" :aria-label="`Домино ${choice.tile.left} и ${choice.tile.right}`">
                            <div :class="['domino__half', { 'domino__half--match': choice.matchSide === 'left' }]">
                              <span v-for="dot in dotArray(choice.tile.left)" :key="`${choice.id}-left-${dot}`" class="domino__dot" />
                            </div>
                            <div :class="['domino__half', { 'domino__half--match': choice.matchSide === 'right' }]">
                              <span v-for="dot in dotArray(choice.tile.right)" :key="`${choice.id}-right-${dot}`" class="domino__dot" />
                            </div>
                          </div>
                          <div class="text-h6 font-weight-bold mt-3">{{ sideValue(choice.tile, choice.matchSide) }} точек</div>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Домино: найди сторону" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.domino-shell {
  background: linear-gradient(135deg, #f2f7ff 0%, #fff6df 52%, #eef8ee 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.target-panel {
  align-items: center;
  block-size: 100%;
  box-shadow: inset 0 -0.5rem 2rem rgb(255 255 255 / 18%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 23rem;
}

.choice-grid {
  row-gap: 1rem;
}

.choice-card {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-card--mistake {
  filter: saturate(0.72) opacity(0.72);
  transform: scale(0.97);
}

.target-hint {
  filter: drop-shadow(0 0 1.25rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

.domino {
  background: #fffaf0;
  border: 0.25rem solid #46372d;
  border-radius: 1.25rem;
  box-shadow: 0 0.75rem 1.5rem rgb(61 41 23 / 16%);
  display: grid;
  gap: 0;
  grid-template-columns: repeat(2, minmax(5.4rem, 1fr));
  inline-size: min(100%, 15rem);
  min-block-size: 8.25rem;
  overflow: hidden;
}

.domino--target {
  inline-size: min(100%, 17rem);
  min-block-size: 9.5rem;
}

.domino__half {
  align-content: center;
  border-inline-end: 0.18rem solid #6d5a4a;
  display: grid;
  gap: 0.42rem;
  grid-template-columns: repeat(3, 1fr);
  justify-items: center;
  padding: 1rem;
}

.domino__half:last-child {
  border-inline-end: 0;
}

.domino__half--open,
.domino__half--match {
  background: #fff1bf;
}

.domino__half--open {
  box-shadow: inset 0 0 0 0.35rem rgb(var(--v-theme-secondary));
}

.domino__half--match {
  box-shadow: inset 0 0 0 0.28rem rgb(var(--v-theme-primary));
}

.domino__dot {
  background: #332923;
  border-radius: 999px;
  inline-size: clamp(0.75rem, 2.4vw, 1.15rem);
  min-block-size: clamp(0.75rem, 2.4vw, 1.15rem);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .target-panel {
    min-block-size: 17rem;
  }
}
</style>
