<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateWhoIsThisRound, type WhoIsThisChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("who-is-this", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "who-is-this",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["who-is-this.prompt", "who-is-this.mistake", "who-is-this.complete"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const lastMistakeId = ref<string>();
const isSpeaking = ref(false);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateWhoIsThisRound(session.settings, roundIndex)
});

const feedbackText = computed(() => {
  if (lastMistakeId.value) return "Посмотри на картинку ещё раз и выбери другое слово.";
  return "Посмотри на картинку и выбери подходящее слово.";
});

function choiceTargetId(choiceId: string) {
  return `who-is-this:choice:${choiceId}`;
}

function correctAssetId() {
  return `who-is-this.correct.${round.value.target.id}`;
}

async function playRoundPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["who-is-this.prompt"], delayMs);
  isSpeaking.value = false;
}

async function choose(choice: WhoIsThisChoice) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    isSpeaking.value = true;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    lastMistakeId.value = undefined;
    void pianoFeedback.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [correctAssetId(), "who-is-this.complete"] : [correctAssetId()], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      await playRoundPrompt(180);
      return;
    }
    isSpeaking.value = false;
    return;
  }

  isSpeaking.value = true;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  lastMistakeId.value = choice.id;
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait(["who-is-this.mistake"], 80);
  isSpeaking.value = false;
}

function restart() {
  lastMistakeId.value = undefined;
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
  <div class="who-is-this-shell">
    <GameHud title="Кто это?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="who-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC-словарь</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ feedbackText }}</p>
            <div class="compact-picture" :style="{ '--person-color': round.target.color }" aria-hidden="true">
              <v-icon class="compact-picture__icon" :icon="round.target.icon" />
            </div>

            <v-row align="stretch" class="main-row" dense>
              <v-col class="picture-col" cols="12" md="5">
                <v-card class="picture-card pa-5" rounded="xl" variant="flat" :style="{ '--person-color': round.target.color }">
                  <v-chip class="mb-4" color="white" prepend-icon="mdi-image-outline" rounded="pill" size="large" variant="elevated">
                    Картинка
                  </v-chip>
                  <div class="portrait" aria-hidden="true">
                    <v-icon class="portrait-icon" :icon="round.target.icon" />
                  </div>
                  <div class="text-h6 text-medium-emphasis mt-4">{{ round.target.setting }}</div>
                </v-card>
              </v-col>

              <v-col class="choices-col" cols="12" md="7">
                <v-row class="choice-grid" dense>
                  <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6">
                    <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="12.8125rem" color="surface" @select="choose(choice)">
                      <template #default="{ active, progress }">
                        <div :class="['choice-content', { 'choice-content--mistake': choice.id === lastMistakeId }]">
                          <v-icon class="choice-icon" :color="choice.color" :icon="choice.icon" />
                          <div class="text-h4 text-md-h3 font-weight-bold mt-3">{{ choice.label }}</div>
                          <div v-if="active && progress > 0.72" class="text-body-1 text-medium-emphasis mt-1">выбрать {{ choice.accusative }}</div>
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
    <GameResultDialog :model-value="resultVisible" title="Кто это?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.who-is-this-shell {
  background: linear-gradient(135deg, #fff7ec 0%, #eef8ff 52%, #f1efff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.main-row,
.choice-grid {
  row-gap: 0.75rem;
}

.picture-card {
  align-items: center;
  background: radial-gradient(circle at 50% 26%, color-mix(in srgb, var(--person-color) 20%, white 80%) 0 24%, #ffffff 54%, color-mix(in srgb, var(--person-color) 16%, #f7fbff 84%) 100%);
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 26rem;
  text-align: center;
}

.compact-picture {
  align-items: center;
  background: color-mix(in srgb, var(--person-color) 16%, white 84%);
  border: 0.25rem solid color-mix(in srgb, var(--person-color) 45%, white 55%);
  border-radius: 999rem;
  display: none;
  inline-size: min(9rem, 24vw);
  justify-content: center;
  margin: 0 auto 0.65rem;
  padding: 0.45rem;
}

.compact-picture__icon {
  color: var(--person-color);
  font-size: clamp(3rem, 9vh, 4.25rem);
}

.portrait {
  align-items: center;
  background: rgb(255 255 255 / 78%);
  border: 0.5rem solid color-mix(in srgb, var(--person-color) 58%, white 42%);
  border-radius: 42% 42% 48% 48%;
  box-shadow: 0 1.5rem 3rem rgb(60 64 92 / 14%);
  display: flex;
  inline-size: min(20rem, 70vw);
  justify-content: center;
  max-inline-size: 100%;
  padding: 2rem;
}

.portrait-icon {
  color: var(--person-color);
  font-size: clamp(8rem, min(19vw, 23vh), 13rem);
  line-height: 1;
}

.choice-content {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 10rem;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-icon {
  font-size: clamp(3.6rem, 8vw, 5.4rem);
  line-height: 1;
}

.choice-content--mistake {
  filter: saturate(0.7) opacity(0.68);
  transform: scale(0.96);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .picture-card {
    min-block-size: 21rem;
  }
}

@media (max-height: 42.5rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .who-card {
    padding: 1rem !important;
  }

  .who-card > .text-overline,
  .who-card > p {
    display: none;
  }

  .who-card > h1 {
    font-size: clamp(1.8rem, 5.4vh, 2.25rem) !important;
    line-height: 1.05;
    margin-block-end: 0.55rem !important;
  }

  .compact-picture {
    display: flex;
  }

  .main-row {
    row-gap: 0 !important;
  }

  .picture-col {
    display: none;
  }

  .choice-grid {
    row-gap: 0.35rem;
  }

  .choice-content,
  .who-card :deep(.dwell-button) {
    min-block-size: 7.85rem !important;
  }

  .choice-icon {
    font-size: clamp(2.9rem, 7.8vh, 4rem);
  }

  .choice-content .text-h4 {
    font-size: clamp(1.5rem, 4.8vh, 2rem) !important;
    margin-block-start: 0.45rem !important;
  }
}
</style>
