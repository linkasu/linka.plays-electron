<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

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
  { id: "bottom-right", label: "снизу справа", className: "cue-target--bottom-right", rotationDeg: 45 },
  { id: "bottom-left", label: "снизу слева", className: "cue-target--bottom-left", rotationDeg: 135 }
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
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("follow-cue", {
  maxSteps: 8,
  dwellMs: 1250,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

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
  if (!cueStrength.value) return "Смотри на световую стрелку. Она спокойно показывает следующую цель.";
  return "Почти получилось. Подсказка стала ярче, ошибку можно просто исправить.";
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
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.slot.label, actual: choice.slot.label, isCorrect: false });
  cueStrength.value = Math.min(3, cueStrength.value + 1);
  lastMistakeId.value = choice.id;
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-cue-target", strength: cueStrength.value });
}

function restart() {
  cueStrength.value = 0;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div :class="['follow-cue-shell', cueStrengthClass]">
    <GameHud title="Следуй за подсказкой" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="follow-cue-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Визуальная подсказка</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-4">{{ helperText }}</p>

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
                min-height="clamp(10.5rem, 24vh, 15rem)"
                :color="choiceColor(choice)"
                role="listitem"
                @select="answer(choice)"
              >
                <template #default="{ active, progress }">
                  <v-icon class="choice-icon" :icon="choice.item.icon" :color="choice.isTarget && cueStrength > 0 ? undefined : choice.item.color" />
                  <div class="text-h6 text-md-h5 font-weight-bold mt-3">{{ choice.item.label }}</div>
                  <v-chip v-if="choice.isTarget && (cueStrength > 1 || (active && progress > 0.78))" class="mt-3" color="primary" variant="flat" size="large">
                    сюда
                  </v-chip>
                </template>
              </GameDwellButton>
            </div>

            <v-expand-transition>
              <v-alert v-if="cueStrength > 0" class="mt-5 text-h6" color="primary" icon="mdi-arrow-right-bold" rounded="xl" variant="tonal">
                Неверная цель только усиливает подсказку. Следуй за стрелкой к светлой карточке.
              </v-alert>
            </v-expand-transition>
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
  padding-block-start: 8.75rem;
}

.follow-cue-card {
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
  background: linear-gradient(90deg, transparent 0%, rgb(var(--v-theme-primary) / 20%) 34%, rgb(var(--v-theme-primary) / 42%) 100%);
  block-size: clamp(1.8rem, 5vw, 3rem);
  border-radius: 999px;
  filter: blur(0.08rem);
  inline-size: 58%;
  inset-block-start: 50%;
  inset-inline-start: 45%;
  position: absolute;
  transform: translateY(-50%);
}

.cue-arrow {
  color: rgb(var(--v-theme-primary));
  filter: drop-shadow(0 0 1rem rgb(var(--v-theme-primary) / 42%));
  font-size: clamp(3rem, 8vw, 5.75rem);
  inset-block-start: 50%;
  inset-inline-start: 62%;
  position: absolute;
  transform: translate(-50%, -50%);
}

.cue-glow {
  background: radial-gradient(circle, rgb(var(--v-theme-primary) / 32%) 0%, transparent 68%);
  block-size: 42%;
  border-radius: 999px;
  inline-size: 42%;
  inset-block-start: 50%;
  inset-inline-start: 83%;
  position: absolute;
  transform: translate(-50%, -50%);
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
  font-size: clamp(4.75rem, min(11vw, 16vh), 7.5rem);
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
  background: linear-gradient(90deg, transparent 0%, rgb(var(--v-theme-primary) / 30%) 32%, rgb(var(--v-theme-primary) / 62%) 100%);
}

.follow-cue--strength-2 .cue-arrow,
.follow-cue--strength-3 .cue-arrow {
  filter: drop-shadow(0 0 1.4rem rgb(var(--v-theme-primary) / 62%));
  transform: translate(-50%, -50%) scale(1.08);
}

.follow-cue--strength-3 .cue-glow {
  background: radial-gradient(circle, rgb(var(--v-theme-primary) / 48%) 0%, transparent 70%);
  transform: translate(-50%, -50%) scale(1.15);
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
    padding-block-start: 7.5rem;
  }
}
</style>
