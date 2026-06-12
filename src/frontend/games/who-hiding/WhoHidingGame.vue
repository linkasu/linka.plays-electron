<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Character = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type Cover = {
  id: string;
  label: string;
  hint: string;
  icon: string;
  color: string;
  shape: "bush" | "tree" | "grass" | "flowers" | "rock" | "log";
};

type Spot = {
  id: string;
  x: number;
  y: number;
  size: number;
  character: Character;
  cover: Cover;
  isTarget: boolean;
};

const characters: Character[] = [
  { id: "cat", name: "котёнка", icon: "mdi-cat", color: "#6d4c41" },
  { id: "owl", name: "сову", icon: "mdi-owl", color: "#7e57c2" },
  { id: "duck", name: "утёнка", icon: "mdi-duck", color: "#f9a825" },
  { id: "dog", name: "щенка", icon: "mdi-dog", color: "#8d6e63" },
  { id: "bird", name: "птичку", icon: "mdi-bird", color: "#42a5f5" },
  { id: "bear", name: "мишку", icon: "mdi-teddy-bear", color: "#795548" },
  { id: "bunny", name: "зайку", icon: "mdi-rabbit", color: "#90a4ae" },
  { id: "friend", name: "друга", icon: "mdi-account", color: "#26a69a" }
];

const covers: Cover[] = [
  { id: "bush", label: "кустиком", hint: "за круглым кустиком", icon: "mdi-leaf", color: "#86c779", shape: "bush" },
  { id: "tree", label: "деревом", hint: "рядом с деревом", icon: "mdi-tree-outline", color: "#a5d6a7", shape: "tree" },
  { id: "grass", label: "травой", hint: "за высокой травой", icon: "mdi-grass", color: "#9ccc65", shape: "grass" },
  { id: "flower", label: "цветами", hint: "около цветов", icon: "mdi-flower", color: "#f8bbd0", shape: "flowers" },
  { id: "rock", label: "камнем", hint: "за серым камнем", icon: "mdi-circle", color: "#b0bec5", shape: "rock" },
  { id: "log", label: "бревном", hint: "за тёплым бревном", icon: "mdi-leaf", color: "#bc8b5f", shape: "log" }
];

const layouts = [
  [{ x: 25, y: 78, size: 178 }, { x: 54, y: 74, size: 190 }, { x: 80, y: 79, size: 174 }],
  [{ x: 19, y: 76, size: 172 }, { x: 48, y: 80, size: 188 }, { x: 76, y: 75, size: 180 }],
  [{ x: 23, y: 80, size: 182 }, { x: 53, y: 73, size: 174 }, { x: 82, y: 78, size: 190 }],
  [{ x: 18, y: 77, size: 170 }, { x: 41, y: 73, size: 178 }, { x: 64, y: 80, size: 186 }, { x: 85, y: 76, size: 170 }]
] as const;

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("who-hiding", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

function generateRound(roundIndex: number) {
  const target = characters[(roundIndex - 1) % characters.length];
  const availableDecoys = characters.filter((character) => character.id !== target.id);
  const layout = layouts[(roundIndex - 1) % layouts.length];
  const targetSlot = (roundIndex * 2) % layout.length;
  const spots: Spot[] = layout.map((point, index) => {
    const character = index === targetSlot ? target : availableDecoys[(roundIndex + index) % availableDecoys.length];
    const cover = covers[(roundIndex + index) % covers.length];

    return {
      id: `${roundIndex}-${index}-${character.id}`,
      x: point.x,
      y: point.y,
      size: point.size,
      character,
      cover,
      isTarget: index === targetSlot
    };
  });

  const targetSpot = spots[targetSlot];
  return {
    roundId: `who-hiding-${roundIndex}`,
    prompt: `Найди ${target.name}`,
    target,
    targetSpot,
    spots
  };
}

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound
});

const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Посмотри на спокойную сцену и выбери, кто спрятался за фоном.";
  return `Подсказка: ${round.value.target.name} ${round.value.targetSpot.cover.hint}. Ошибки не страшны.`;
});

function spotTargetId(spot: Spot) {
  return `who-hiding:spot:${spot.id}`;
}

function spotStyle(spot: Spot) {
  return {
    left: `${spot.x}%`,
    top: `${spot.y}%`,
    inlineSize: `${spot.size * session.settings.targetScale}px`
  };
}

function chooseSpot(spot: Spot) {
  if (session.status !== "running") return;

  const targetId = spotTargetId(spot);
  const expectedTargetId = spotTargetId(round.value.targetSpot);
  if (spot.isTarget) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: spot.character.id, expected: round.value.target.name, actual: spot.character.name, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: spot.character.id, expected: round.value.target.name, actual: spot.character.name, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-hidden-character" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = spot.id;
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="who-hiding-shell">
    <GameHud title="Кто спрятался?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Фигура и фон</div>
            <h1 class="who-hiding-title text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="who-hiding-hint text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>

            <v-card class="search-scene" color="blue-lighten-5" rounded="xl" variant="flat">
              <div class="scene-cloud scene-cloud--left" aria-hidden="true" />
              <div class="scene-cloud scene-cloud--right" aria-hidden="true" />
              <div class="scene-sun" aria-hidden="true" />
              <div class="scene-hill scene-hill--back" aria-hidden="true" />
              <div class="scene-hill scene-hill--front" aria-hidden="true" />
              <div class="scene-ground" aria-hidden="true" />
              <div class="scene-path" aria-hidden="true" />
              <v-chip class="scene-chip" color="white" prepend-icon="mdi-eye-outline" rounded="pill" size="large" variant="elevated">
                Ищи спокойным взглядом
              </v-chip>

              <GameDwellButton
                v-for="spot in round.spots"
                :key="spot.id"
                :class="['hidden-choice', { 'hidden-choice--hint': hintedRoundId === round.roundId && spot.isTarget, 'hidden-choice--mistake': spot.id === lastMistakeId }]"
                :target-id="spotTargetId(spot)"
                :disabled="session.status !== 'running'"
                :dwell-ms="session.settings.dwellMs"
                :min-height="spot.size * session.settings.targetScale"
                :style="spotStyle(spot)"
                color="transparent"
                @select="chooseSpot(spot)"
              >
                <template #default="{ active, progress }">
                  <div class="hideout" :style="{ '--character-color': spot.character.color, '--cover-color': spot.cover.color }">
                    <v-icon class="hidden-character" :icon="spot.character.icon" />
                    <div :class="['cover-shape', `cover-shape--${spot.cover.shape}`]">
                      <v-icon class="cover-icon" :icon="spot.cover.icon" />
                    </div>
                    <div v-if="active && progress > 0.72" class="spot-caption text-body-2 font-weight-bold">
                      {{ spot.character.name }} за {{ spot.cover.label }}
                    </div>
                  </div>
                </template>
              </GameDwellButton>
            </v-card>

            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-account-question-outline" rounded="xl" variant="tonal">
                Цель мягко подсвечена. Переведи взгляд туда и удержи его спокойно.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Кто спрятался?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.who-hiding-shell {
  background: linear-gradient(135deg, #eef8f5 0%, #fff7e8 52%, #f0edff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.search-scene {
  background: linear-gradient(180deg, #dff3ff 0 58%, #cfecc2 58% 100%);
  block-size: clamp(31rem, 64vh, 43rem);
  overflow: hidden;
  position: relative;
}

.scene-cloud {
  background: rgb(255 255 255 / 66%);
  border-radius: 999px;
  block-size: 4.2rem;
  box-shadow: -3.3rem 0.5rem 0 -0.6rem rgb(255 255 255 / 56%), 3.1rem 0.65rem 0 -0.8rem rgb(255 255 255 / 54%);
  inline-size: 9.4rem;
  position: absolute;
}

.scene-cloud--left {
  inset-block-start: 12%;
  inset-inline-start: 14%;
}

.scene-cloud--right {
  inset-block-start: 9%;
  inset-inline-end: 19%;
  transform: scale(0.78);
}

.scene-sun {
  background: radial-gradient(circle, #fff9c4 0 36%, rgb(255 249 196 / 0%) 68%);
  block-size: 13rem;
  inline-size: 13rem;
  inset-block-start: 5%;
  inset-inline-end: 7%;
  position: absolute;
}

.scene-hill {
  border-radius: 50% 50% 0 0;
  inset-block-end: 8%;
  position: absolute;
}

.scene-hill--back {
  background: #cde8c2;
  block-size: 28%;
  inline-size: 82%;
  inset-inline-start: -6%;
}

.scene-hill--front {
  background: #bfe2d4;
  block-size: 24%;
  inline-size: 76%;
  inset-inline-end: -8%;
}

.scene-ground {
  background: linear-gradient(180deg, #95d37d 0%, #72bd67 100%);
  block-size: 31%;
  border-radius: 55% 55% 0 0 / 28% 28% 0 0;
  inset-block-end: -1%;
  inset-inline: -4%;
  position: absolute;
}

.scene-path {
  background: rgb(235 202 139 / 44%);
  block-size: 13%;
  border-radius: 50% 50% 0 0;
  filter: blur(0.4px);
  inline-size: 54%;
  inset-block-end: -1%;
  inset-inline-start: 23%;
  position: absolute;
}

.scene-chip {
  inset-block-start: 1rem;
  inset-inline-start: 1rem;
  position: absolute;
  z-index: 3;
}

.hidden-choice {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 6;
}

.hidden-choice :deep(.dwell-button) {
  background: transparent !important;
  box-shadow: none;
  overflow: visible;
}

.hidden-choice--hint {
  filter: drop-shadow(0 0 1.3rem rgb(var(--v-theme-primary) / 48%));
}

.hidden-choice--mistake {
  opacity: 0.68;
}

.hideout {
  block-size: 100%;
  inline-size: 100%;
  position: relative;
}

.hidden-character {
  color: var(--character-color);
  font-size: clamp(4.7rem, 9vw, 7rem);
  inset-block-end: 30%;
  inset-inline-start: 50%;
  line-height: 1;
  opacity: 0.86;
  position: absolute;
  transform: translateX(-50%);
  z-index: 1;
}

.cover-shape {
  align-items: center;
  background: color-mix(in srgb, var(--cover-color) 84%, white 16%);
  border: 0.25rem solid rgb(255 255 255 / 58%);
  box-shadow: inset 0 -0.8rem 1.2rem rgb(0 0 0 / 8%);
  color: color-mix(in srgb, var(--cover-color) 68%, #2f4f4f 32%);
  display: flex;
  justify-content: center;
  position: absolute;
  z-index: 2;
}

.cover-shape--bush {
  block-size: 54%;
  border-radius: 55% 45% 48% 52%;
  inline-size: 82%;
  inset-block-end: 6%;
  inset-inline-start: 9%;
}

.cover-shape--tree {
  block-size: 76%;
  border-radius: 50% 50% 38% 38%;
  inline-size: 72%;
  inset-block-end: 3%;
  inset-inline-start: 14%;
}

.cover-shape--flowers {
  block-size: 48%;
  border-radius: 999px 999px 44% 44%;
  inline-size: 86%;
  inset-block-end: 7%;
  inset-inline-start: 7%;
}

.cover-shape--rock {
  block-size: 44%;
  border-radius: 58% 42% 45% 55%;
  inline-size: 82%;
  inset-block-end: 5%;
  inset-inline-start: 9%;
}

.cover-shape--log {
  block-size: 38%;
  border-radius: 999px;
  inline-size: 84%;
  inset-block-end: 4%;
  inset-inline-start: 8%;
}

.cover-shape--grass {
  block-size: 56%;
  border-radius: 24% 24% 42% 42%;
  inline-size: 78%;
  inset-block-end: 4%;
  inset-inline-start: 11%;
}

.cover-icon {
  font-size: clamp(3.2rem, 7vw, 5.2rem);
  opacity: 0.74;
}

.spot-caption {
  background: rgb(255 255 255 / 86%);
  border-radius: 999px;
  inset-block-end: -0.35rem;
  inset-inline: 8%;
  padding: 0.25rem 0.5rem;
  position: absolute;
  z-index: 5;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .search-scene {
    block-size: 34rem;
  }

  .scene-chip {
    display: none;
  }
}

@media (max-height: 760px) {
  .game-container {
    padding-block-start: 6.25rem;
  }

  .game-container :deep(.v-card.pa-4) {
    padding-block: 1rem !important;
  }

  .who-hiding-title {
    font-size: clamp(1.7rem, 4vw, 2.25rem) !important;
    line-height: 1.08;
    margin-block-end: 0.5rem !important;
  }

  .who-hiding-hint {
    font-size: 1rem !important;
    margin-block-end: 0.75rem !important;
  }

  .search-scene {
    block-size: min(24rem, calc(100vh - 13.75rem));
  }

  .scene-chip,
  .scene-cloud {
    display: none;
  }
}
</style>
