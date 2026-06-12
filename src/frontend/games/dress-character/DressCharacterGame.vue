<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type ClothingSlot = "hat" | "jacket" | "shoes";

type ClothingItem = {
  slot: ClothingSlot;
  label: string;
  prompt: string;
  hint: string;
  icon: string;
  color: string;
};

const clothingItems: ClothingItem[] = [
  {
    slot: "hat",
    label: "Шапка",
    prompt: "Сначала найдём тёплую шапку.",
    hint: "Посмотри на шапку сверху.",
    icon: "mdi-account-tie-hat",
    color: "deep-purple-lighten-4"
  },
  {
    slot: "jacket",
    label: "Куртка",
    prompt: "Теперь выбери куртку для прогулки.",
    hint: "Куртка надевается на плечи.",
    icon: "mdi-tshirt-crew",
    color: "light-blue-lighten-4"
  },
  {
    slot: "shoes",
    label: "Обувь",
    prompt: "Осталось выбрать обувь.",
    hint: "Обувь ждёт внизу, у ног.",
    icon: "mdi-shoe-sneaker",
    color: "teal-lighten-4"
  }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("dress-character", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 130
}, {
  finishOnMistakes: false
});

const dressed = reactive<Record<ClothingSlot, boolean>>({
  hat: false,
  jacket: false,
  shoes: false
});
const hintedSlot = ref<ClothingSlot>();
const lastMistakeSlot = ref<ClothingSlot>();
const feedbackMessage = ref("Слушай мягкую подсказку и выбирай нужную одежду.");

const resultVisible = computed(() => session.status === "finished");
const currentItem = computed(() => clothingItems[session.step % clothingItems.length]);
const completedCycles = computed(() => Math.floor(session.step / clothingItems.length));
const progressText = computed(() => `Шаг ${Math.min(session.step + 1, session.maxSteps)} из ${session.maxSteps}`);

function choiceTargetId(item: ClothingItem) {
  return `dress-character:choice:${item.slot}`;
}

function resetClothes() {
  dressed.hat = false;
  dressed.jacket = false;
  dressed.shoes = false;
}

function choose(item: ClothingItem) {
  if (session.status !== "running") return;

  const expectedItem = currentItem.value;
  const targetId = choiceTargetId(item);
  const expectedTargetId = choiceTargetId(expectedItem);
  const roundId = `dress-character:round:${session.step + 1}`;

  if (item.slot === expectedItem.slot) {
    if (item.slot === "hat" && session.step > 0) resetClothes();
    dressed[item.slot] = true;
    hintedSlot.value = undefined;
    lastMistakeSlot.value = undefined;
    feedbackMessage.value = `Да, это ${item.label.toLowerCase()}. Персонажу удобно.`;
    recordSuccess({ roundId, targetId, answerId: item.slot, expected: expectedItem.label, actual: item.label, isCorrect: true });
    return;
  }

  hintedSlot.value = expectedItem.slot;
  lastMistakeSlot.value = item.slot;
  feedbackMessage.value = `Ничего страшного. ${expectedItem.hint}`;
  recordMistake({ roundId, targetId, expectedTargetId, answerId: item.slot, expected: expectedItem.label, actual: item.label, isCorrect: false });
  recordHint({ roundId, targetId: expectedTargetId, reason: "clothing-sequence" });
}

function restart() {
  resetClothes();
  hintedSlot.value = undefined;
  lastMistakeSlot.value = undefined;
  feedbackMessage.value = "Слушай мягкую подсказку и выбирай нужную одежду.";
  startSession();
}
</script>

<template>
  <div class="dress-character-shell">
    <GameHud title="Одень персонажа" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Одежда по порядку</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Одень персонажа</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-6">{{ currentItem.prompt }}</p>

            <v-card class="hint-card pa-4 pa-md-5 mb-6" color="amber-lighten-5" rounded="xl" variant="flat">
              <div class="d-flex flex-wrap align-center justify-center ga-3">
                <v-avatar :color="currentItem.color" size="64">
                  <v-icon :icon="currentItem.icon" size="40" />
                </v-avatar>
                <div>
                  <div class="text-caption text-medium-emphasis">Мягкая подсказка</div>
                  <div class="text-h5 font-weight-bold">Найди: {{ currentItem.label.toLowerCase() }}</div>
                </div>
                <v-chip color="primary" size="large" variant="tonal">{{ progressText }}</v-chip>
              </div>
            </v-card>

            <div class="play-area">
              <v-card class="character-card pa-4 pa-md-5" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                <div class="text-body-1 text-medium-emphasis text-center mb-3">Комплект {{ completedCycles + 1 }}</div>
                <div class="character-stage" aria-label="Персонаж для одевания">
                  <div :class="['clothing-piece clothing-piece--hat', { 'clothing-piece--visible': dressed.hat }]" />
                  <div class="character-head" />
                  <div :class="['clothing-piece clothing-piece--jacket', { 'clothing-piece--visible': dressed.jacket }]" />
                  <div class="character-body" />
                  <div class="character-legs" />
                  <div :class="['clothing-piece clothing-piece--shoes', { 'clothing-piece--visible': dressed.shoes }]" />
                </div>
                <v-alert class="mt-4 text-body-1" color="primary" icon="mdi-lightbulb-on-outline" rounded="xl" variant="tonal">
                  {{ feedbackMessage }}
                </v-alert>
              </v-card>

              <div class="choice-grid" aria-label="Выбор одежды">
                <GameDwellButton v-for="item in clothingItems" :key="item.slot" :class="{ 'choice-button--hinted': hintedSlot === item.slot }" :target-id="choiceTargetId(item)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="180" :color="hintedSlot === item.slot ? 'primary' : item.color" @select="choose(item)">
                  <template #default>
                    <div :class="['choice-content', { 'choice-content--mistake': lastMistakeSlot === item.slot }]">
                      <v-icon class="choice-icon" :icon="item.icon" />
                      <div class="text-h5 font-weight-bold mt-3">{{ item.label }}</div>
                      <div v-if="hintedSlot === item.slot" class="text-caption mt-2">попробуй это</div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Одень персонажа" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.dress-character-shell {
  background: linear-gradient(135deg, #fff8e1 0%, #e8f5e9 48%, #e3f2fd 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.hint-card {
  border: 2px solid rgb(var(--v-theme-primary) / 14%);
}

.play-area {
  align-items: stretch;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: minmax(20rem, 1fr) minmax(18rem, 0.9fr);
}

.character-card {
  min-inline-size: 0;
}

.character-stage {
  align-items: center;
  block-size: min(28rem, 52vh);
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-inline: auto;
  position: relative;
}

.character-head {
  background: #ffccbc;
  block-size: 5rem;
  border: 0.25rem solid rgb(121 85 72 / 24%);
  border-radius: 50%;
  inline-size: 5rem;
  z-index: 3;
}

.character-body {
  background: #fff3e0;
  block-size: 8.5rem;
  border: 0.25rem solid rgb(121 85 72 / 18%);
  border-radius: 2rem 2rem 1.25rem 1.25rem;
  inline-size: 8rem;
  margin-block-start: 0.4rem;
  z-index: 1;
}

.character-legs {
  background: linear-gradient(90deg, #90a4ae 0 42%, transparent 42% 58%, #90a4ae 58% 100%);
  block-size: 5.8rem;
  border-radius: 0 0 1rem 1rem;
  inline-size: 5rem;
}

.clothing-piece {
  opacity: 0.16;
  position: absolute;
  transition: opacity 180ms ease, transform 180ms ease;
  z-index: 4;
}

.clothing-piece--visible {
  opacity: 1;
  transform: scale(1.04);
}

.clothing-piece--hat {
  background: #b39ddb;
  block-size: 2.4rem;
  border-radius: 2rem 2rem 0.8rem 0.8rem;
  inline-size: 6.3rem;
  inset-block-start: calc(50% - 13.1rem);
}

.clothing-piece--jacket {
  background: #81d4fa;
  block-size: 7.7rem;
  border-radius: 2rem 2rem 1.1rem 1.1rem;
  inline-size: 9.2rem;
  inset-block-start: calc(50% - 4.4rem);
  z-index: 2;
}

.clothing-piece--shoes {
  background: linear-gradient(90deg, #80cbc4 0 46%, transparent 46% 54%, #80cbc4 54% 100%);
  block-size: 1.7rem;
  border-radius: 1rem;
  inline-size: 7.2rem;
  inset-block-end: calc(50% - 13.5rem);
}

.choice-grid {
  display: grid;
  gap: 1rem;
}

.choice-icon {
  font-size: clamp(4.5rem, min(11vw, 16vh), 7rem);
  line-height: 1;
}

.choice-content--mistake {
  opacity: 0.68;
}

.choice-button--hinted {
  filter: drop-shadow(0 0 1rem rgb(var(--v-theme-primary) / 38%));
  transform: scale(1.02);
}

@media (max-width: 56rem) {
  .play-area {
    grid-template-columns: 1fr;
  }

  .choice-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .play-area {
    grid-template-columns: minmax(0, 0.85fr) minmax(18rem, 1.15fr);
  }

  .character-stage {
    block-size: 16rem;
  }
}
</style>
