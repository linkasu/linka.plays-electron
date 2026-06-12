<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeFindEmotionAudio, playFindEmotionMistakeMelody, playFindEmotionSuccessMelody, warmFindEmotionAudio } from "./audio";
import { generateFindEmotionRound, type FindEmotionOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("find-emotion", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindEmotionRound(session.settings, roundIndex)
});

const mistakesInRound = ref(0);
const lastMistakeId = ref<string>();

const hintedChoiceId = computed(() => mistakesInRound.value > 0 ? round.value.target.id : undefined);
const hintText = computed(() => {
  if (mistakesInRound.value <= 0) return "Выбери лицо с нужной эмоцией.";
  return `Посмотри на подсказку: ${round.value.target.label} подсвечена мягкой рамкой.`;
});

function choiceTargetId(choiceId: string) {
  return `find-emotion:choice:${choiceId}`;
}

function answer(choice: FindEmotionOption, index: number) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (index === round.value.correctIndex) {
    void playFindEmotionSuccessMelody(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    mistakesInRound.value = 0;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  mistakesInRound.value += 1;
  lastMistakeId.value = choice.id;
  void playFindEmotionMistakeMelody(session.settings.sound);
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
}

function restart() {
  mistakesInRound.value = 0;
  lastMistakeId.value = undefined;
  restartRoundGame();
}

onMounted(() => {
  warmFindEmotionAudio(session.settings.sound);
});

watch(() => session.settings.sound, (enabled) => {
  warmFindEmotionAudio(enabled);
});

onUnmounted(() => {
  disposeFindEmotionAudio();
});
</script>

<template>
  <div class="find-emotion-shell">
    <GameHud title="Найди эмоцию" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-emotion-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Смотри на лицо</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="4" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :class="{ 'hinted-choice': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="176" :color="hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer(choice, index)">
                  <template #default>
                    <div :class="['emotion-choice', { 'emotion-choice--mistake': choice.id === lastMistakeId }]">
                      <div class="emotion-emoji emoji-glyph" aria-hidden="true">{{ choice.emoji }}</div>
                      <div class="sr-only">{{ choice.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди эмоцию" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-emotion-shell {
  background: linear-gradient(135deg, #fff5f8 0%, #eef8ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 6rem;
}

.find-emotion-card {
  overflow: hidden;
}

.choice-grid {
  margin: -6px;
}

.choice-grid :deep(.v-col) {
  padding: 6px;
}

.emotion-choice {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 7.5rem;
  transition: filter 160ms ease, transform 160ms ease;
}

.emotion-emoji {
  font-size: clamp(4.25rem, min(10vw, 15vh), 8rem);
  line-height: 1;
}

.sr-only {
  block-size: 1px;
  clip: rect(0, 0, 0, 0);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

.hinted-choice {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 38%));
  transform: scale(1.03);
}

.emotion-choice--mistake {
  filter: grayscale(0.25) opacity(0.74);
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 5.25rem;
  }

  .emotion-choice {
    min-block-size: 6.75rem;
  }
}
</style>
