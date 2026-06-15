<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateUnoLikeRound, getUnoLikeMatchTraits, isUnoLikePlayable, type UnoLikeCard, type UnoLikeRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("uno-like", { maxSteps: 10, finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<UnoLikeRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateUnoLikeRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

const playableCards = computed(() => round.value.choices.filter((card) => round.value.playableIds.includes(card.id)));
const helperText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return round.value.instruction;
  return `Почти. Подойдут: ${playableCards.value.map((card) => card.label).join(", ")}. Ошибка не завершает игру.`;
});

function cardTargetId(card: UnoLikeCard) {
  return `uno-like:card:${card.id}`;
}

function matchLabel(card: UnoLikeCard) {
  const traits = getUnoLikeMatchTraits(card, round.value.openCard);
  if (traits.length === 2) return "цвет и число";
  if (traits[0] === "color") return "цвет";
  if (traits[0] === "number") return "число";
  return "другая карта";
}

function isHinted(card: UnoLikeCard) {
  return hintedRoundId.value === round.value.roundId && round.value.playableIds.includes(card.id);
}

function choose(card: UnoLikeCard) {
  if (session.status !== "running") return;

  const targetId = cardTargetId(card);
  if (isUnoLikePlayable(card, round.value.openCard)) {
    const matchTraits = getUnoLikeMatchTraits(card, round.value.openCard);
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: card.id, expected: round.value.playableIds, actual: card.label, matchTraits, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = card.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetIds: round.value.playableIds.map((id) => `uno-like:card:${id}`), answerId: card.id, expected: round.value.playableIds, actual: card.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetIds: round.value.playableIds.map((id) => `uno-like:card:${id}`), reason: "no-color-or-number-match", text: helperText.value });
}

function cardButtonColor(card: UnoLikeCard) {
  if (isHinted(card)) return "primary";
  if (lastMistakeId.value === card.id) return "orange-lighten-4";
  return "surface";
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="uno-like-shell">
    <GameHud title="Уно-подобное" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="9">
          <v-card class="pa-4 pa-md-6" color="rgba(255, 255, 255, 0.94)" rounded="xl" elevation="8">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-4">
              <div>
                <div class="text-overline text-secondary mb-1">Стратегия: цвет или число</div>
                <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ round.prompt }}</h1>
                <p class="text-h6 text-medium-emphasis mb-0" role="status">{{ helperText }}</p>
              </div>
              <v-avatar color="primary" rounded="xl" size="78">
                <v-icon icon="mdi-cards-playing-outline" size="48" />
              </v-avatar>
            </div>

            <v-row class="align-stretch" dense>
              <v-col class="open-card-col" cols="12" md="4">
                <v-sheet class="open-card-panel pa-4" color="secondary" rounded="xl">
                  <div class="text-overline text-white text-center mb-3">Открытая карта</div>
                  <div class="uno-card uno-card--open" :style="{ borderColor: round.openCard.color.hex }">
                    <div class="uno-card__stripe" :style="{ backgroundColor: round.openCard.color.hex, color: round.openCard.color.textColor }">{{ round.openCard.color.label }}</div>
                    <div class="uno-card__number">{{ round.openCard.number }}</div>
                  </div>
                  <div class="text-h5 font-weight-bold text-white text-center mt-3">{{ round.openCard.label }}</div>
                </v-sheet>
              </v-col>

              <v-col cols="12" md="8">
                <v-row class="choice-grid" dense>
                  <v-col v-for="card in round.choices" :key="card.id" cols="6" sm="3" :lg="round.choices.length >= 5 ? 4 : 6">
                    <GameDwellButton :class="{ 'target-hint': isHinted(card) }" :target-id="cardTargetId(card)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="170" :color="cardButtonColor(card)" @select="choose(card)">
                      <template #default>
                        <div :class="['choice-card', { 'choice-card--mistake': lastMistakeId === card.id }]">
                          <div class="uno-card" :style="{ borderColor: card.color.hex }">
                            <div class="uno-card__stripe" :style="{ backgroundColor: card.color.hex, color: card.color.textColor }">{{ card.color.label }}</div>
                            <div class="uno-card__number">{{ card.number }}</div>
                          </div>
                          <div class="choice-label text-body-1 text-md-h6 font-weight-bold mt-2">{{ card.label }}</div>
                          <div class="match-pill mt-2">{{ matchLabel(card) }}</div>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-heart-outline" rounded="xl" variant="tonal">
                Посмотри на цвет и число открытой карты. Подходящие варианты мягко подсвечены.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Уно-подобное" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.uno-like-shell {
  background:
    radial-gradient(circle at 18% 16%, rgb(255 224 178 / 62%), transparent 30%),
    radial-gradient(circle at 82% 18%, rgb(187 222 251 / 58%), transparent 28%),
    linear-gradient(135deg, #fff7ed 0%, #eef8ff 52%, #f5f3ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 5rem;
}

.open-card-panel {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 24rem;
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
  filter: saturate(0.74) opacity(0.74);
  transform: scale(0.97);
}

.choice-label {
  line-height: 1.12;
  overflow-wrap: anywhere;
  text-align: center;
}

.match-pill {
  background: #1b5e20;
  border-radius: 0.75rem;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1.1;
  padding: 0.35rem 0.55rem;
}

.uno-card {
  align-items: center;
  aspect-ratio: 0.72;
  background: rgb(var(--v-theme-surface));
  border: 0.45rem solid;
  border-radius: 1.35rem;
  box-shadow: 0 0.55rem 1.2rem rgb(15 23 42 / 18%);
  display: flex;
  flex-direction: column;
  inline-size: clamp(7rem, min(18vw, 22vh), 10rem);
  justify-content: center;
  overflow: hidden;
}

.uno-card--open {
  inline-size: clamp(8rem, min(22vw, 26vh), 12rem);
}

.uno-card__stripe {
  font-size: clamp(0.9rem, 2vw, 1.15rem);
  font-weight: 800;
  inline-size: 100%;
  padding-block: 0.45rem;
  text-align: center;
}

.uno-card__number {
  color: rgb(var(--v-theme-on-surface));
  font-size: clamp(4rem, min(13vw, 15vh), 7rem);
  font-weight: 950;
  line-height: 1;
  margin-block-start: auto;
  margin-block-end: auto;
}

.target-hint {
  filter: drop-shadow(0 0 1.15rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .open-card-panel {
    min-block-size: 18rem;
  }
}

@media (max-height: 820px) {
  .game-container {
    padding-block-start: 5rem;
  }

  .open-card-col,
  .open-card-panel {
    display: none;
  }

  .uno-card {
    inline-size: clamp(5rem, 12vw, 7rem);
  }
}
</style>
