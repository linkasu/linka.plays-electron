<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateWhoIsThisRound, type WhoIsThisChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("who-is-this", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateWhoIsThisRound(session.settings, roundIndex)
});

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);
const feedbackText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Посмотри на картинку и выбери подходящее слово.";
  return `Ничего страшного. Здесь подходит: ${round.value.target.label}.`;
});

function choiceTargetId(choiceId: string) {
  return `who-is-this:choice:${choiceId}`;
}

function choose(choice: WhoIsThisChoice) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, text: `Можно выбрать: ${round.value.target.label}.`, reason: "wrong-person-selected" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="who-is-this-shell">
    <GameHud title="Кто это?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC-словарь</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ feedbackText }}</p>

            <v-row align="stretch" class="main-row" dense>
              <v-col cols="12" md="5">
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

              <v-col cols="12" md="7">
                <v-row class="choice-grid" dense>
                  <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6">
                    <GameDwellButton :class="{ 'choice-hint': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="205" :color="hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="choose(choice)">
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

            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-check-circle-outline" rounded="xl" variant="tonal">
                Ошибка мягкая: верный ответ подсвечен. Переведи взгляд на карточку «{{ round.target.label }}».
              </v-alert>
            </v-expand-transition>
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

.choice-hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .picture-card {
    min-block-size: 21rem;
  }
}
</style>
