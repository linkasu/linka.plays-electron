<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeFollowCueAudio, playFollowCueMistakeMelody, playFollowCueSuccessMelody, warmFollowCueAudio } from "./audio";

type CueSlot = {
  id: string;
  label: string;
  className: string;
  rotationDeg: number;
};

type CueItem = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

type CueChoice = {
  id: string;
  slot: CueSlot;
  item: CueItem;
  isTarget: boolean;
};

type CueRound = {
  roundId: string;
  prompt: string;
  choices: CueChoice[];
  target: CueChoice;
  correctIndex: number;
};

const cueSlots: CueSlot[] = [
  { id: "top-left", label: "сверху слева", className: "cue-target--top-left", rotationDeg: -135 },
  { id: "top-right", label: "сверху справа", className: "cue-target--top-right", rotationDeg: -45 },
  { id: "bottom-left", label: "снизу слева", className: "cue-target--bottom-left", rotationDeg: 135 },
  { id: "bottom-right", label: "снизу справа", className: "cue-target--bottom-right", rotationDeg: 45 }
];

const cueItems: CueItem[] = [
  { id: "star", label: "звезда", icon: "mdi-star-four-points-outline", color: "amber" },
  { id: "leaf", label: "лист", icon: "mdi-leaf", color: "success" },
  { id: "cloud", label: "облако", icon: "mdi-cloud-outline", color: "info" },
  { id: "flower", label: "цветок", icon: "mdi-flower-outline", color: "secondary" },
  { id: "bell", label: "колокольчик", icon: "mdi-bell-outline", color: "warning" },
  { id: "heart", label: "сердце", icon: "mdi-heart-outline", color: "pink" },
  { id: "fish", label: "рыбка", icon: "mdi-fish", color: "cyan" },
  { id: "moon", label: "луна", icon: "mdi-moon-waning-crescent", color: "indigo" }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("follow-cue", { maxSteps: 8, finishOnMistakes: false });

const cueStrength = ref(0);
const lastMistakeId = ref<string>();

function generateRound(roundIndex: number): CueRound {
  const correctIndex = (roundIndex * 3 + 1) % cueSlots.length;
  const itemOffset = roundIndex % cueItems.length;
  const choices = cueSlots.map((slot, index) => {
    const item = cueItems[(itemOffset + index * 2) % cueItems.length];
    return {
      id: `follow-cue:${roundIndex}:${slot.id}`,
      slot,
      item,
      isTarget: index === correctIndex
    };
  });

  return {
    roundId: `follow-cue:round:${roundIndex}`,
    prompt: "Следуй за мягкой подсказкой",
    choices,
    target: choices[correctIndex],
    correctIndex
  };
}

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound
});

const cueStyle = computed(() => ({
  "--cue-rotation": `${round.value.target.slot.rotationDeg}deg`
}));
const cueStrengthClass = computed(() => `follow-cue--strength-${cueStrength.value}`);
const helperText = computed(() => {
  if (!cueStrength.value) return "Смотри на стрелку: она показывает нужную карточку.";
  return "Подсказка ярче. Выбери подсвеченную карточку.";
});

function choiceTargetId(choiceId: string) {
  return `follow-cue:choice:${choiceId}`;
}

function choiceColor(choice: CueChoice) {
  if (choice.isTarget && cueStrength.value > 0) return "primary";
  if (lastMistakeId.value === choice.id) return "warning";
  return "surface";
}

function answer(choice: CueChoice) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.isTarget) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.slot.label, actual: choice.slot.label, isCorrect: true });
    cueStrength.value = 0;
    lastMistakeId.value = undefined;
    void playFollowCueSuccessMelody(session.settings.sound);
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.slot.label, actual: choice.slot.label, isCorrect: false });
  cueStrength.value = Math.min(3, cueStrength.value + 1);
  lastMistakeId.value = choice.id;
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-cue-target", strength: cueStrength.value });
  void playFollowCueMistakeMelody(session.settings.sound);
}

function restart() {
  cueStrength.value = 0;
  lastMistakeId.value = undefined;
  restartRoundGame();
}

onMounted(() => {
  warmFollowCueAudio(session.settings.sound);
});

onUnmounted(() => {
  disposeFollowCueAudio();
});
</script>

<template>
  <div :class="['follow-cue-shell', cueStrengthClass]">
    <GameHud title="Следуй за подсказкой" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="follow-cue-card pa-3 pa-md-5" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Визуальная подсказка</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-body-1 text-md-h6 text-medium-emphasis text-center mb-3">{{ helperText }}</p>

            <div class="cue-board" :style="cueStyle" role="list" aria-label="Крупные цели для выбора">
              <div class="cue-guide" aria-hidden="true">
                <div class="cue-beam" />
                <v-icon class="cue-arrow" icon="mdi-arrow-right-bold" />
                <div class="cue-glow" />
              </div>

              <GameDwellButton
                v-for="choice in round.choices"
                :key="choice.id"
                :class="['cue-target', choice.slot.className, { 'cue-target--hinted': choice.isTarget, 'cue-target--mistake': lastMistakeId === choice.id }]"
                :target-id="choiceTargetId(choice.id)"
                :disabled="session.status !== 'running'"
                :dwell-ms="session.settings.dwellMs"
                min-height="clamp(8.5rem, 20vh, 12rem)"
                :color="choiceColor(choice)"
                role="listitem"
                @select="answer(choice)"
              >
                <template #default="{ active, progress }">
                  <v-icon class="choice-icon" :icon="choice.item.icon" :color="choice.isTarget && cueStrength > 0 ? undefined : choice.item.color" />
                  <div class="text-body-1 text-md-h6 font-weight-bold mt-2">{{ choice.item.label }}</div>
                  <v-chip v-if="choice.isTarget && (cueStrength > 1 || (active && progress > 0.78))" class="mt-3" color="primary" variant="flat" size="large">
                    сюда
                  </v-chip>
                </template>
              </GameDwellButton>
            </div>

            <div class="cue-feedback-slot mt-2">
              <v-alert class="cue-feedback text-body-2" :class="{ 'cue-feedback--visible': cueStrength > 0 }" color="primary" icon="mdi-arrow-right-bold" rounded="xl" variant="tonal">
                Следуй за стрелкой к подсвеченной карточке.
              </v-alert>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Следуй за подсказкой" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.follow-cue-shell {
  background: linear-gradient(135deg, #f4f8ff 0%, #fff8ed 48%, #f0fbf6 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 6.25rem;
}

.follow-cue-card {
  --cue-color: #c2410c;
  --cue-color-rgb: 194 65 12;
  overflow: hidden;
}

.cue-board {
  display: grid;
  gap: clamp(0.75rem, 1.4vw, 1rem);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-inline: auto;
  max-inline-size: 58rem;
  position: relative;
}

.cue-guide {
  block-size: min(20rem, 44vw);
  inline-size: min(20rem, 44vw);
  inset-block-start: 50%;
  inset-inline-start: 50%;
  pointer-events: none;
  position: absolute;
  transform: translate(-50%, -50%) rotate(var(--cue-rotation));
  z-index: 2;
}

.cue-beam {
  display: none;
}

.cue-arrow {
  color: var(--cue-color);
  filter: drop-shadow(0 0 0.85rem rgb(var(--cue-color-rgb) / 34%));
  font-size: clamp(3rem, 8vw, 5.75rem);
  inset-block-start: 50%;
  inset-inline-start: 62%;
  position: absolute;
  transform: translate(-50%, -50%);
}

.cue-glow {
  display: none;
}

.cue-target {
  min-inline-size: 0;
  position: relative;
  z-index: 1;
}

.cue-target--hinted {
  filter: drop-shadow(0 0 0.9rem rgb(var(--v-theme-primary) / 30%));
}

.choice-icon {
  font-size: clamp(4rem, min(9vw, 13vh), 6.25rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.cue-target--mistake .choice-icon {
  filter: saturate(0.72) opacity(0.7);
  transform: scale(0.94);
}

.follow-cue--strength-1 .cue-target--hinted,
.follow-cue--strength-2 .cue-target--hinted,
.follow-cue--strength-3 .cue-target--hinted {
  filter: drop-shadow(0 0 1.3rem rgb(var(--v-theme-primary) / 46%));
  transform: scale(1.02);
}

.follow-cue--strength-1 .cue-beam,
.follow-cue--strength-2 .cue-beam,
.follow-cue--strength-3 .cue-beam {
  display: none;
}

.follow-cue--strength-2 .cue-arrow,
.follow-cue--strength-3 .cue-arrow {
  filter: drop-shadow(0 0 1.25rem rgb(var(--cue-color-rgb) / 56%));
  transform: translate(-50%, -50%) scale(1.08);
}

.follow-cue--strength-3 .cue-glow {
  display: none;
}

.cue-feedback-slot {
  block-size: 2.75rem;
  overflow: hidden;
}

.cue-feedback {
  opacity: 0;
  transition: opacity 120ms ease;
}

.cue-feedback--visible {
  opacity: 1;
}

@media (max-width: 640px) {
  .cue-board {
    gap: 0.65rem;
  }

  .cue-guide {
    inline-size: min(16rem, 58vw);
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 5rem;
  }
}
</style>
