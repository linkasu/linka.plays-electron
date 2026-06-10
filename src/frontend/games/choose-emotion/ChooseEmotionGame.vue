<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateChooseEmotionRound, type ChooseEmotionOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("choose-emotion", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateChooseEmotionRound(session.settings, roundIndex)
});

const hintedChoiceId = ref<string>();
const lastChoiceId = ref<string>();

const helperText = computed(() => {
  if (!hintedChoiceId.value) return "Выбери эмоцию. Любой выбор помогает понять ситуацию.";
  return `Мягкая подсказка: попробуй карточку «${round.value.target.label}».`;
});

function choiceTargetId(choiceId: string) {
  return `choose-emotion:choice:${choiceId}`;
}

function choose(choice: ChooseEmotionOption, index: number) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  lastChoiceId.value = choice.id;

  if (index === round.value.correctIndex) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    hintedChoiceId.value = undefined;
    lastChoiceId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  hintedChoiceId.value = round.value.target.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "emotion-choice" });
}

function restart() {
  hintedChoiceId.value = undefined;
  lastChoiceId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="choose-emotion-shell">
    <GameHud title="Выбери эмоцию" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="emotion-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC: ситуация и эмоция</div>
            <div class="cue-emoji emoji-glyph text-center mb-3" aria-hidden="true">{{ round.cueEmoji }}</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-2">{{ round.detail }}</p>
            <p class="text-body-1 text-md-h6 text-primary text-center mb-5">{{ helperText }}</p>

            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :class="{ 'hinted-choice': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="220" :color="hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="choose(choice, index)">
                  <template #default>
                    <div :class="['emotion-choice', { 'emotion-choice--last': lastChoiceId === choice.id && hintedChoiceId }]">
                      <div class="choice-emoji emoji-glyph" aria-hidden="true">{{ choice.emoji }}</div>
                      <div class="text-h4 text-md-h3 font-weight-bold mt-3">{{ choice.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Выбери эмоцию" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.choose-emotion-shell {
  background: linear-gradient(135deg, #fff7ed 0%, #edf7ff 52%, #f6efff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.emotion-card {
  overflow: hidden;
}

.cue-emoji {
  font-size: clamp(4rem, min(9vw, 13vh), 7rem);
  line-height: 1;
}

.choice-grid {
  row-gap: 0.75rem;
}

.emotion-choice {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 10.75rem;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-emoji {
  font-size: clamp(4.5rem, min(11vw, 16vh), 8.25rem);
  line-height: 1;
}

.hinted-choice {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 34%));
  transform: scale(1.03);
}

.emotion-choice--last {
  filter: saturate(0.8) opacity(0.78);
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .emotion-choice {
    min-block-size: 8.5rem;
  }
}
</style>
