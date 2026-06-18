<script setup lang="ts">
import { computed, onMounted, onUnmounted, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useChoiceRoundFlow } from "../../composables/useChoiceRoundFlow";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { findAnimalFeedback } from "./audio";
import { generateFindAnimalRound, type FindAnimalChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("find-animal", {
  maxSteps: 8,
  finishOnMistakes: false
});

const promptAudio = useGamePromptAudio({ gameId: "find-animal", soundEnabled: toRef(session.settings, "sound") });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindAnimalRound(session.settings, roundIndex)
});

function choiceTargetId(choiceId: string) {
  return `find-animal:choice:${choiceId}`;
}

function choiceMinHeight(choiceCount: number) {
  if (choiceCount <= 3) return "clamp(180px, 28vh, 300px)";
  return "clamp(168px, 25vh, 260px)";
}

const choiceFlow = useChoiceRoundFlow<FindAnimalChoice>({
  session,
  round,
  nextRound,
  restartRoundGame,
  isSameChoice: (left, right) => left.id === right.id,
  buildAnswerPayload: (choice, currentRound, isCorrect) => ({
    targetId: choiceTargetId(choice.id),
    ...(isCorrect ? {} : { expectedTargetId: choiceTargetId(currentRound.target.id) }),
    expected: currentRound.target.word,
    actual: choice.word
  }),
  buildHintPayload: (currentRound) => ({
    roundId: currentRound.roundId,
    targetId: choiceTargetId(currentRound.target.id),
    reason: "wrong-animal-selected"
  }),
  recordSuccess,
  recordMistake,
  recordHint,
  feedback: {
    playSuccess: () => { void findAnimalFeedback.playSuccess(session.settings.sound); },
    playMistake: () => { void findAnimalFeedback.playMistake(session.settings.sound); }
  },
  prompt: {
    play: (assetId, delayMs) => promptAudio.play(assetId, delayMs),
    cancel: promptAudio.cancelPending,
    promptAssetId: (currentRound) => `find-animal.prompt.${currentRound.target.id}`,
    successAssetId: "find-animal.correct",
    mistakeAssetId: "find-animal.mistake"
  }
});

const { hintedRoundId, lastMistakeId, pendingSelection, hintedChoice, answer } = choiceFlow;
const hintedChoiceId = computed(() => hintedChoice.value?.id);
const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Посмотри на названного зверька и удержи взгляд.";
  return `Почти получилось. Верный зверёк подсвечен: ${round.value.target.word}.`;
});

function restart() {
  choiceFlow.restart();
}

onMounted(() => {
  findAnimalFeedback.warm(session.settings.sound);
  promptAudio.warm();
  choiceFlow.start();
});

watch(() => session.settings.sound, (enabled) => {
  findAnimalFeedback.warm(enabled);
});

onUnmounted(() => {
  findAnimalFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="forest" padding-top="0" full-height>
    <template #hud>
      <GameHud title="Найди животное" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row class="game-row" justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="find-animal-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1 mb-md-2">Лесная поляна</div>
            <h1 class="text-h4 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="hint-line text-body-1 text-md-h5 text-medium-emphasis text-center mb-3 mb-md-5">{{ hintText }}</p>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="choiceMinHeight(round.choices.length)" :highlight-choice="(choice) => hintedChoiceId === choice.id" :color="(choice) => hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer">
              <template #default="{ choice, active, progress }">
                <div :class="['animal-emoji', 'emoji-glyph', { 'animal-emoji--mistake': choice.id === lastMistakeId }]">{{ choice.emoji }}</div>
                <div class="animal-label text-h6 text-md-h4 font-weight-bold mt-2">{{ hintedChoiceId === choice.id && active && progress > 0.78 ? `Вот ${choice.word}` : choice.word }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди животное" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.game-container {
  block-size: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-block: clamp(5.5rem, 11vh, 8rem) clamp(1rem, 4vh, 3rem);
}

.find-animal-card {
  max-block-size: calc(100vh - 6.75rem);
  overflow: hidden;
}

.game-row {
  align-items: center;
  flex: 1 1 auto;
}

.animal-emoji {
  font-size: clamp(3.1rem, min(8vw, 12vh), 7rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.animal-label {
  overflow-wrap: anywhere;
}

.hint-line {
  min-block-size: 1.5rem;
}

.animal-emoji--mistake {
  filter: saturate(0.75) opacity(0.72);
  transform: scale(0.96);
}

@media (max-height: 44rem) {
  .game-container {
    justify-content: flex-start;
    padding-block-start: 5.25rem;
  }

  .game-row {
    align-items: flex-start;
  }
}
</style>
