<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { gameArtSrc } from "../../core/gameArt";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  socialPhraseAssetId,
  socialPhrases,
  socialPhrasesPrompt,
  socialPhrasesPromptAssetId,
  type SocialPhrase,
} from "./model";

const router = useRouter();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  recordSuccess,
  startSession,
  finishSession,
} = useGameSessionFor("social-phrases", {
  maxSteps: 8,
  overrides: { dwellMs: 1350, sessionSeconds: 135, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
});
const promptAudio = useGamePromptAudio({
  gameId: "social-phrases",
  soundEnabled: toRef(session.settings, "sound"),
  warmAssetIds: [socialPhrasesPromptAssetId],
});

const pending = ref(false);
const saidPhraseId = ref<string>();

function phraseTargetId(phrase: SocialPhrase) {
  return `social-phrases:phrase:${phrase.id}`;
}

async function say(phrase: SocialPhrase) {
  if (session.status !== "running" || pending.value) return;
  pending.value = true;
  saidPhraseId.value = phrase.id;
  // Every card is a message: it is said for the child and counted as communication.
  recordSuccess({
    roundId: `social-phrases:say:${session.step + 1}`,
    targetId: phraseTargetId(phrase),
    answerId: phrase.id,
    phrase: phrase.phrase,
    isCorrect: true,
    noFail: true,
  });
  const finished = session.step >= session.maxSteps;
  await promptAudio.playSequenceAndWait([socialPhraseAssetId(phrase)], 60, 250);
  saidPhraseId.value = undefined;
  pending.value = false;
  if (finished) {
    finishSession("game-complete");
  }
}

function phraseColor(phrase: SocialPhrase) {
  return saidPhraseId.value === phrase.id ? "green-lighten-4" : "surface";
}

async function playPrompt(delayMs = 0) {
  pending.value = true;
  await promptAudio.playSequenceAndWait([socialPhrasesPromptAssetId], delayMs);
  pending.value = false;
}

function restart() {
  promptAudio.cancelPending();
  saidPhraseId.value = undefined;
  startSession();
  void playPrompt(220);
}

onMounted(() => {
  promptAudio.warm();
  void playPrompt(420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="social-phrases-shell">
    <GameHud
      title="Социальные фразы"
      :step="session.step"
      :max-steps="session.maxSteps"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />
    <v-container class="game-container game-hud-clear" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-3 pa-md-5" rounded="xl" elevation="8">
            <h1 class="text-h5 text-md-h4 font-weight-bold text-center mb-3">
              {{ socialPhrasesPrompt }}
            </h1>
            <GameChoiceCardGrid
              :choices="socialPhrases"
              :target-id="phraseTargetId"
              :disabled="session.status !== 'running' || pending"
              :dwell-ms="session.settings.dwellMs"
              min-height="clamp(7.5rem, 28dvh, 16rem)"
              :color="phraseColor"
              :cols="6"
              :sm="3"
              :md="3"
              :lg="3"
              @select="say"
            >
              <template #default="{ choice }">
                <div class="phrase">
                  <img
                    class="phrase__art"
                    :src="gameArtSrc(choice.artId)"
                    alt=""
                    draggable="false"
                  />
                  <div class="text-subtitle-1 text-md-h5 font-weight-bold">{{ choice.label }}</div>
                </div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog
      :model-value="session.status === 'finished'"
      title="Социальные фразы"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.social-phrases-shell {
  background: var(--linka-scene-paper);
  min-block-size: 100vh;
}

.phrase {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.phrase__art {
  block-size: clamp(4rem, 17dvh, 10rem);
  inline-size: clamp(4rem, 17dvh, 10rem);
  object-fit: contain;
}
</style>
