<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameSessionChrome from "../../components/game/GameSessionChrome.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { generateMatchSameRound, type MatchSameRound } from "./model";

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("match-same", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "match-same",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["match-same.prompt", "match-same.correct", "match-same.mistake"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const hintedRoundId = ref<string>();
const isSpeaking = ref(false);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateMatchSameRound(session.settings, roundIndex)
});

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);

function choiceTargetId(choiceId: string) {
  return `match-same:choice:${choiceId}`;
}

async function playRoundPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["match-same.prompt"], delayMs);
  isSpeaking.value = false;
}

async function answer(choice: MatchSameRound["choices"][number]) {
  if (session.status !== "running" || isSpeaking.value) return;
  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);

  if (choice.id === round.value.target.id) {
    isSpeaking.value = true;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: true });
    hintedRoundId.value = undefined;
    void pianoFeedback.playSuccess();
    await promptAudio.playSequenceAndWait(["match-same.correct"], 80);
    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      await playRoundPrompt(180);
      return;
    }
    isSpeaking.value = false;
    return;
  }

  isSpeaking.value = true;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
  hintedRoundId.value = round.value.roundId;
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait(["match-same.mistake", "match-same.prompt"], 80, 170);
  isSpeaking.value = false;
}

function restart() {
  hintedRoundId.value = undefined;
  isSpeaking.value = false;
  promptAudio.cancelPending();
  restartRoundGame();
  void playRoundPrompt(220);
}

onMounted(() => {
  promptAudio.warm();
  void playRoundPrompt(420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <GameSessionChrome title="Где такой же?" :session="session" :result-visible="resultVisible" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" gradient="linear-gradient(135deg, #f4f7ff 0%, #fff0e8 100%)" padding-top="5rem" @pause="pauseSession" @resume="resumeSession" @restart="restart">
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11">
          <v-card class="match-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Найди такую же картинку</div>
            <div class="sample-card mx-auto mb-4 mb-md-6">
              <div class="sample-emoji emoji-glyph">{{ round.target.emoji }}</div>
            </div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-4 mb-md-6">{{ round.prompt }}</h1>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="clamp(9.5rem, 22vh, 11rem)" :sm="3" :highlight-choice="(choice) => hintedChoiceId === choice.id" :color="(choice) => hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer">
              <template #default="{ choice }">
                <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ choice.word }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </GameSessionChrome>
</template>

<style scoped>
.match-card {
  overflow: hidden;
}

.sample-card {
  align-items: center;
  background: rgb(var(--v-theme-primary) / 10%);
  border: 0.25rem solid rgb(var(--v-theme-primary) / 26%);
  border-radius: 2rem;
  display: flex;
  inline-size: min(15rem, 46vw);
  justify-content: center;
  min-block-size: min(12rem, 25vh);
}

.sample-emoji {
  font-size: clamp(5rem, min(14vw, 17vh), 9rem);
  line-height: 1;
}

.choice-emoji {
  font-size: clamp(3.8rem, min(8vw, 13vh), 6.8rem);
  line-height: 1;
}

@media (max-height: 44rem) {
 .sample-card {
    inline-size: min(10rem, 38vw);
    min-block-size: 6.25rem;
  }

 .sample-emoji {
    font-size: clamp(4rem, min(10vw, 12vh), 6rem);
  }

 .match-card {
    padding-block: 1rem !important;
  }

 .match-card .text-overline {
    display: none;
  }
}
</style>
