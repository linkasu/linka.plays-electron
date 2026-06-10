<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type HouseChoice = {
  id: string;
  label: string;
  icon: string;
  color: string;
  isHouse: boolean;
};

const softObjects = [
  { label: "дерево", icon: "mdi-tree-outline", color: "success" },
  { label: "облако", icon: "mdi-cloud-outline", color: "info" },
  { label: "цветок", icon: "mdi-flower-outline", color: "secondary" },
  { label: "грибок", icon: "mdi-mushroom-outline", color: "warning" },
  { label: "кустик", icon: "mdi-sprout-outline", color: "success" },
  { label: "звезда", icon: "mdi-star-outline", color: "amber" }
] as const;

const houseColors = ["primary", "teal", "deep-purple", "indigo"] as const;

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("find-house", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 90
}, {
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

function generateRound(roundIndex: number) {
  const choiceCount = 2 + (roundIndex % 3);
  const houseSlot = (roundIndex * 2) % choiceCount;
  const choices: HouseChoice[] = [];
  let softIndex = roundIndex;

  for (let index = 0; index < choiceCount; index += 1) {
    if (index === houseSlot) {
      choices.push({
        id: `house-${roundIndex}`,
        label: "домик",
        icon: "mdi-home-outline",
        color: houseColors[roundIndex % houseColors.length],
        isHouse: true
      });
      continue;
    }

    const object = softObjects[softIndex % softObjects.length];
    choices.push({
      id: `${object.label}-${roundIndex}-${index}`,
      label: object.label,
      icon: object.icon,
      color: object.color,
      isHouse: false
    });
    softIndex += 1;
  }

  return {
    roundId: `find-house-${roundIndex}`,
    prompt: "Найди домик",
    choices,
    target: choices[houseSlot]
  };
}

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound
});

const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Смотри спокойно. Домик большой и ждёт выбора.";
  return "Почти получилось. Домик подсвечен мягкой рамкой.";
});

function choiceTargetId(choiceId: string) {
  return `find-house:choice:${choiceId}`;
}

function answer(choice: HouseChoice) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.isHouse) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: "домик", actual: choice.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: "домик", actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "soft-object-selected" });
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
  <div class="find-house-shell">
    <GameHud title="Найди домик" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-house-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Первый выбор взглядом</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :class="{ 'target-hint': hintedRoundId === round.roundId && choice.isHouse }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="choice.isHouse ? 250 : 210" :color="choice.isHouse ? choice.color : 'surface'" @select="answer(choice)">
                  <template #default="{ active, progress }">
                    <v-icon :class="['choice-icon', { 'choice-icon--house': choice.isHouse, 'choice-icon--mistake': choice.id === lastMistakeId }]" :icon="choice.icon" />
                    <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ choice.isHouse && active && progress > 0.82 ? "Домик" : choice.label }}</div>
                    <div class="text-body-1 text-medium-emphasis mt-2">{{ choice.isHouse ? "это домик" : "мягкий сосед" }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-home-outline" rounded="xl" variant="tonal">
                Попробуй посмотреть на домик. Ошибки не страшны.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди домик" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-house-shell {
  background: linear-gradient(135deg, #fff7ed 0%, #edf8f6 55%, #f4f0ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.find-house-card {
  overflow: hidden;
}

.choice-grid {
  row-gap: 0.75rem;
}

.choice-icon {
  color: rgb(var(--v-theme-primary));
  font-size: clamp(4.5rem, min(11vw, 16vh), 7.5rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-icon--house {
  color: currentColor;
  font-size: clamp(5.8rem, min(14vw, 20vh), 9rem);
}

.choice-icon--mistake {
  filter: saturate(0.7) opacity(0.72);
  transform: scale(0.96);
}

.target-hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 40%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }
}
</style>
