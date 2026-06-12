<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type PictureFragment = {
  id: string;
  label: string;
  hint: string;
  emoji: string;
  color: string;
};

type FixPictureRound = {
  roundId: string;
  target: PictureFragment;
  choices: PictureFragment[];
};

const pictureFragments: PictureFragment[] = [
  { id: "sky", label: "небо", hint: "голубой верх картинки", emoji: "☁️", color: "blue-lighten-4" },
  { id: "sun", label: "солнце", hint: "тёплый круг света", emoji: "☀️", color: "amber-lighten-3" },
  { id: "hill", label: "холм", hint: "зелёный дальний холм", emoji: "🌿", color: "green-lighten-4" },
  { id: "tree", label: "дерево", hint: "высокое дерево сбоку", emoji: "🌳", color: "teal-lighten-4" },
  { id: "wall", label: "домик", hint: "стены маленького домика", emoji: "🏠", color: "orange-lighten-4" },
  { id: "roof", label: "крыша", hint: "крыша домика", emoji: "🔺", color: "red-lighten-4" },
  { id: "path", label: "дорожка", hint: "мягкая дорожка к домику", emoji: "〰️", color: "brown-lighten-4" },
  { id: "flowers", label: "цветы", hint: "цветы внизу картинки", emoji: "🌸", color: "pink-lighten-4" }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("fix-picture", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 130
}, {
  finishOnMistakes: false
});

const revealedIds = ref<string[]>([]);
const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

function rotateChoices(choices: PictureFragment[], roundIndex: number) {
  const shift = roundIndex % choices.length;
  return [...choices.slice(shift), ...choices.slice(0, shift)];
}

function generateFixPictureRound(roundIndex: number): FixPictureRound {
  const targetIndex = Math.min(roundIndex - 1, pictureFragments.length - 1);
  const target = pictureFragments[targetIndex];
  const decoyA = pictureFragments[(targetIndex + 2) % pictureFragments.length];
  const decoyB = pictureFragments[(targetIndex + 5) % pictureFragments.length];

  return {
    roundId: `fix-picture:round:${roundIndex}:${target.id}`,
    target,
    choices: rotateChoices([target, decoyA, decoyB], roundIndex)
  };
}

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<FixPictureRound>({
  session,
  startSession,
  generateRound: generateFixPictureRound
});

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);
const pictureComplete = computed(() => revealedIds.value.length >= pictureFragments.length);
const feedbackText = computed(() => {
  if (pictureComplete.value) return "Картинка восстановлена мягко и спокойно.";
  if (hintedRoundId.value === round.value.roundId) return `Почти. Подсказка: выбери ${round.value.target.hint}.`;
  return `Выбери следующий фрагмент: ${round.value.target.label}.`;
});

function isFragmentRevealed(fragmentId: string) {
  return revealedIds.value.includes(fragmentId);
}

function choiceTargetId(choiceId: string) {
  return `fix-picture:${round.value.roundId}:choice:${choiceId}`;
}

function answer(choice: PictureFragment) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);

  if (choice.id === round.value.target.id) {
    if (!isFragmentRevealed(choice.id)) revealedIds.value = [...revealedIds.value, choice.id];
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.status === "running" && session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "next-fragment" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
}

function restart() {
  revealedIds.value = [];
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="fix-picture-shell">
    <GameHud title="Почини картинку" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Последовательность и зрительный поиск</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Почини картинку</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ feedbackText }}</p>

            <v-row class="align-stretch" dense>
              <v-col cols="12" md="7">
                <v-card class="picture-board pa-3 pa-md-4" color="blue-lighten-5" rounded="xl" variant="flat">
                  <div class="picture-grid" aria-label="Восстанавливаемая картинка">
                    <v-card v-for="fragment in pictureFragments" :key="fragment.id" :class="['picture-tile', { 'picture-tile--hidden': !isFragmentRevealed(fragment.id) }]" :color="isFragmentRevealed(fragment.id) ? fragment.color : 'grey-lighten-4'" rounded="xl" elevation="0">
                      <div v-if="isFragmentRevealed(fragment.id)" class="scene-fragment">
                        <div class="fragment-emoji emoji-glyph">{{ fragment.emoji }}</div>
                        <div class="text-subtitle-1 text-md-h6 font-weight-bold mt-2">{{ fragment.label }}</div>
                      </div>
                      <div v-else class="missing-fragment text-medium-emphasis">
                        <v-icon icon="mdi-help-circle-outline" size="44" />
                        <div class="text-body-2 font-weight-bold mt-2">ждёт часть</div>
                      </div>
                    </v-card>
                  </div>
                </v-card>
              </v-col>

              <v-col cols="12" md="5">
                <v-card class="pa-4 pa-md-5 mb-4" color="blue-lighten-5" rounded="xl" variant="flat">
                  <div class="text-caption text-medium-emphasis mb-1">Следующий фрагмент</div>
                  <div class="d-flex align-center ga-3">
                    <v-avatar :color="round.target.color" size="64"><span class="cue-emoji emoji-glyph">{{ round.target.emoji }}</span></v-avatar>
                    <div>
                      <div class="text-h5 font-weight-bold">{{ round.target.label }}</div>
                      <div class="text-body-1 text-medium-emphasis">{{ revealedIds.length }} из {{ pictureFragments.length }} уже на месте</div>
                    </div>
                  </div>
                </v-card>

                <v-row class="choice-grid" dense>
                  <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="4" md="12">
                    <GameDwellButton :class="{ 'target-hint': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="150" :color="hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer(choice)">
                      <template #default>
                        <div :class="['choice-emoji emoji-glyph', { 'choice-emoji--mistake': lastMistakeId === choice.id }]">{{ choice.emoji }}</div>
                        <div class="text-h5 text-md-h4 font-weight-bold mt-2">{{ choice.label }}</div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>

                <v-expand-transition>
                  <v-alert v-if="hintedRoundId === round.roundId" class="mt-4 text-h6" color="primary" icon="mdi-lightbulb-on-outline" rounded="xl" variant="tonal">
                    Ошибка не страшна. Правильная часть картинки подсвечена.
                  </v-alert>
                </v-expand-transition>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Почини картинку" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.fix-picture-shell {
  background: linear-gradient(135deg, #eef7ff 0%, #f5f0ff 48%, #fff7e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.picture-board {
  block-size: 100%;
}

.picture-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.picture-tile {
  align-items: center;
  display: flex;
  justify-content: center;
  min-block-size: min(12rem, 28vh);
  transition: background-color 220ms ease, opacity 220ms ease, transform 220ms ease;
}

.picture-tile--hidden {
  border: 0.15rem dashed rgb(var(--v-theme-on-surface) / 18%);
}

.scene-fragment,
.missing-fragment {
  text-align: center;
}

.fragment-emoji {
  font-size: clamp(3.5rem, min(8vw, 13vh), 6.5rem);
  line-height: 1;
}

.cue-emoji {
  font-size: 2.1rem;
  line-height: 1;
}

.choice-grid {
  row-gap: 0.75rem;
}

.choice-emoji {
  font-size: clamp(3.5rem, min(8vw, 12vh), 5.4rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-emoji--mistake {
  filter: grayscale(0.35) opacity(0.72);
  transform: scale(0.95);
}

.target-hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-width: 59.99rem) {
  .picture-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .picture-tile {
    min-block-size: 7.5rem;
  }
}

@media (max-height: 820px) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .picture-board {
    display: none;
  }
}
</style>
