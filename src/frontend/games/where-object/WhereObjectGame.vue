<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateWhereObjectRound, phraseFor, type WhereObjectPlace, type WhereObjectPreposition } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("where-object", {
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
  generateRound: (roundIndex) => generateWhereObjectRound(session.settings, roundIndex)
});

const correctChoiceId = computed(() => round.value.correctId);
const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) {
    return round.value.mode === "place"
      ? "Найди карточку, где лежит предмет, и удержи взгляд."
      : "Посмотри на сцену и выбери короткое слово: на, под или в.";
  }

  return round.value.mode === "place"
    ? `Мягкая подсказка: ${round.value.targetObject.word} ${phraseFor(round.value.targetPlace, round.value.targetPreposition)}.`
    : `Мягкая подсказка: правильное слово — «${round.value.targetPreposition.label}».`;
});

function placeTargetId(placeId: string) {
  return `where-object:place:${placeId}`;
}

function prepositionTargetId(prepositionId: string) {
  return `where-object:preposition:${prepositionId}`;
}

function answerPlace(place: WhereObjectPlace) {
  if (session.status !== "running" || round.value.mode !== "place") return;

  const targetId = placeTargetId(place.id);
  const expectedTargetId = placeTargetId(round.value.targetPlace.id);
  if (place.id === round.value.targetPlace.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: place.id, expected: phraseFor(round.value.targetPlace, round.value.targetPreposition), actual: phraseFor(place, round.value.targetPreposition), isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: place.id, expected: phraseFor(round.value.targetPlace, round.value.targetPreposition), actual: phraseFor(place, round.value.targetPreposition), isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-place-selected" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = place.id;
}

function answerPreposition(preposition: WhereObjectPreposition) {
  if (session.status !== "running" || round.value.mode !== "preposition") return;

  const targetId = prepositionTargetId(preposition.id);
  const expectedTargetId = prepositionTargetId(round.value.targetPreposition.id);
  if (preposition.id === round.value.targetPreposition.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: preposition.id, expected: round.value.targetPreposition.label, actual: preposition.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: preposition.id, expected: round.value.targetPreposition.label, actual: preposition.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-preposition-selected" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = preposition.id;
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="where-object-shell">
    <GameHud title="Где предмет?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC и предлоги</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>

            <v-card v-if="round.mode === 'preposition'" class="scene-card pa-5 mb-5" color="blue-lighten-5" rounded="xl" variant="flat">
              <div class="place-scene place-scene--large" :class="`place-scene--${round.targetPreposition.id}`">
                <v-icon class="place-icon" :color="round.targetPlace.color" :icon="round.targetPlace.icon" />
                <div class="object-emoji emoji-glyph">{{ round.targetObject.emoji }}</div>
              </div>
              <div class="text-h5 font-weight-bold text-center mt-3">
                {{ round.targetObject.word }} и {{ round.targetPlace.label }}
              </div>
            </v-card>

            <v-row v-if="round.mode === 'place'" class="choice-grid" justify="center" dense>
              <v-col v-for="place in round.places" :key="place.id" cols="12" sm="6" :md="round.places.length <= 3 ? 4 : 3">
                <GameDwellButton :class="{ 'target-hint': hintedRoundId === round.roundId && correctChoiceId === place.id }" :target-id="placeTargetId(place.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="230" :color="hintedRoundId === round.roundId && correctChoiceId === place.id ? 'primary' : 'surface'" @select="answerPlace(place)">
                  <template #default="{ active, progress }">
                    <div class="place-scene" :class="`place-scene--${round.targetPreposition.id}`">
                      <v-icon class="place-icon" :color="place.color" :icon="place.icon" />
                      <div v-if="place.id === round.targetPlace.id" :class="['object-emoji', 'emoji-glyph', { 'object-emoji--found': active && progress > 0.7 }]">{{ round.targetObject.emoji }}</div>
                    </div>
                    <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ phraseFor(place, round.targetPreposition) }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-row v-else justify="center" dense>
              <v-col v-for="preposition in round.prepositions" :key="preposition.id" cols="12" sm="4">
                <GameDwellButton :class="{ 'target-hint': hintedRoundId === round.roundId && correctChoiceId === preposition.id }" :target-id="prepositionTargetId(preposition.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="180" :color="hintedRoundId === round.roundId && correctChoiceId === preposition.id ? 'primary' : 'surface'" @select="answerPreposition(preposition)">
                  <template #default>
                    <div :class="['preposition-word', { 'preposition-word--mistake': preposition.id === lastMistakeId }]">{{ preposition.label }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-check-circle-outline" rounded="xl" variant="tonal">
                Ошибка не страшна. Правильный вариант подсвечен, можно спокойно попробовать ещё раз.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Где предмет?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.where-object-shell {
  background: linear-gradient(135deg, #f5efff 0%, #effaf6 52%, #fff8e7 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.choice-grid {
  row-gap: 0.75rem;
}

.scene-card {
  align-items: center;
  display: flex;
  flex-direction: column;
}

.place-scene {
  block-size: clamp(8.5rem, 20vh, 12rem);
  inline-size: min(100%, 16rem);
  margin-inline: auto;
  position: relative;
}

.place-scene--large {
  block-size: clamp(14rem, 36vh, 20rem);
  inline-size: min(100%, 28rem);
}

.place-icon {
  filter: drop-shadow(0 0.8rem 1rem rgb(0 0 0 / 10%));
  font-size: clamp(7rem, 16vh, 11rem);
  inset-block-end: 8%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.place-scene--large .place-icon {
  font-size: clamp(11rem, 28vh, 17rem);
}

.object-emoji {
  font-size: clamp(3.3rem, 9vh, 5.4rem);
  line-height: 1;
  position: absolute;
  transform: translate(-50%, -50%);
  transition: transform 180ms ease;
  z-index: 2;
}

.place-scene--large .object-emoji {
  font-size: clamp(5rem, 14vh, 8rem);
}

.object-emoji--found {
  transform: translate(-50%, -50%) scale(1.08);
}

.place-scene--on .object-emoji {
  inset-block-start: 16%;
  inset-inline-start: 50%;
}

.place-scene--under .object-emoji {
  inset-block-start: 85%;
  inset-inline-start: 50%;
}

.place-scene--in .object-emoji {
  inset-block-start: 58%;
  inset-inline-start: 50%;
}

.preposition-word {
  font-size: clamp(3.8rem, 11vw, 6rem);
  font-weight: 800;
  line-height: 1;
}

.preposition-word--mistake {
  opacity: 0.62;
}

.target-hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 7.5rem;
  }
}
</style>
