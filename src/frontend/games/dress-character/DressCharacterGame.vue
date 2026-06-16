<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeDressCharacterAudio, playDressCharacterHintMelody, playDressCharacterSuccessMelody, warmDressCharacterAudio } from "./audio";

type ClothingSlot = "hat" | "jacket" | "shoes";

type ClothingItem = {
  slot: ClothingSlot;
  label: string;
  prompt: string;
  hint: string;
  color: string;
  darkColor: string;
};

const clothingItems: ClothingItem[] = [
  {
    slot: "hat",
    label: "Шапка",
    prompt: "Сначала найдём тёплую шапку.",
    hint: "Посмотри на шапку сверху.",
    color: "#b39ddb",
    darkColor: "#4a3d76"
  },
  {
    slot: "jacket",
    label: "Куртка",
    prompt: "Теперь выбери куртку для прогулки.",
    hint: "Куртка надевается на плечи.",
    color: "#64b5f6",
    darkColor: "#16446f"
  },
  {
    slot: "shoes",
    label: "Обувь",
    prompt: "Осталось выбрать обувь.",
    hint: "Обувь ждёт внизу, у ног.",
    color: "#4db6ac",
    darkColor: "#15514d"
  }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("dress-character", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 130, sound: true },
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
    void playDressCharacterSuccessMelody(session.settings.sound);
    recordSuccess({ roundId, targetId, answerId: item.slot, expected: expectedItem.label, actual: item.label, isCorrect: true });
    return;
  }

  hintedSlot.value = expectedItem.slot;
  lastMistakeSlot.value = item.slot;
  feedbackMessage.value = `Ничего страшного. ${expectedItem.hint}`;
  void playDressCharacterHintMelody(session.settings.sound);
  recordMistake({ roundId, targetId, expectedTargetId, answerId: item.slot, expected: expectedItem.label, actual: item.label, isCorrect: false });
  recordHint({ roundId, targetId: expectedTargetId, reason: "clothing-sequence" });
}

function itemStyle(item: ClothingItem) {
  return {
    "--item-color": item.color,
    "--item-dark": item.darkColor
  };
}

function choiceColor(item: ClothingItem) {
  if (hintedSlot.value === item.slot) return "primary";
  if (lastMistakeSlot.value === item.slot) return "deep-orange-darken-2";
  return "blue-grey-darken-4";
}

function restart() {
  resetClothes();
  hintedSlot.value = undefined;
  lastMistakeSlot.value = undefined;
  feedbackMessage.value = "Слушай мягкую подсказку и выбирай нужную одежду.";
  startSession();
}

onMounted(() => {
  warmDressCharacterAudio(session.settings.sound);
});

onUnmounted(() => {
  disposeDressCharacterAudio();
});
</script>

<template>
  <div class="dress-character-shell">
    <GameHud title="Одень персонажа" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="dress-card pa-3 pa-md-4" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Гардероб для прогулки</div>
            <h1 class="text-h5 text-md-h4 font-weight-bold text-center mb-1">Одень персонажа</h1>
            <p class="prompt-line text-body-1 text-md-h6 text-medium-emphasis text-center mb-3">{{ currentItem.prompt }}</p>

            <div class="play-area">
              <v-card class="character-card pa-3" rounded="xl" variant="flat">
                <div class="scene-meta d-flex align-center justify-space-between mb-2">
                  <span>Комплект {{ completedCycles + 1 }}</span>
                  <v-chip color="primary" size="small" variant="tonal">{{ progressText }}</v-chip>
                </div>
                <div class="character-stage" aria-label="Персонаж для одевания">
                  <div class="closet-sparkle closet-sparkle--one" />
                  <div class="closet-sparkle closet-sparkle--two" />
                  <div :class="['dress-piece dress-piece--hat', { 'dress-piece--visible': dressed.hat, 'dress-piece--hint': hintedSlot === 'hat' }]" />
                  <div class="person person--head">
                    <span class="person-eye person-eye--left" />
                    <span class="person-eye person-eye--right" />
                    <span class="person-smile" />
                  </div>
                  <div class="person person--neck" />
                  <div :class="['dress-piece dress-piece--jacket', { 'dress-piece--visible': dressed.jacket, 'dress-piece--hint': hintedSlot === 'jacket' }]">
                    <span class="dress-piece__detail dress-piece__detail--one" />
                    <span class="dress-piece__detail dress-piece__detail--two" />
                  </div>
                  <div class="person person--body" />
                  <div class="person person--arm person--arm-left" />
                  <div class="person person--arm person--arm-right" />
                  <div class="person person--leg person--leg-left" />
                  <div class="person person--leg person--leg-right" />
                  <div :class="['dress-piece dress-piece--shoes', { 'dress-piece--visible': dressed.shoes, 'dress-piece--hint': hintedSlot === 'shoes' }]">
                    <span class="dress-piece__detail dress-piece__detail--one" />
                    <span class="dress-piece__detail dress-piece__detail--two" />
                  </div>
                  <div class="scene-rug" />
                </div>
                <v-alert class="feedback-alert mt-2 text-body-2 font-weight-bold" color="primary" icon="mdi-lightbulb-on-outline" rounded="xl" variant="tonal">
                  {{ feedbackMessage }}
                </v-alert>
              </v-card>

              <div class="choice-grid" aria-label="Выбор одежды">
                <GameDwellButton v-for="item in clothingItems" :key="item.slot" :class="['choice-button', `choice-button--${item.slot}`, { 'choice-button--hinted': hintedSlot === item.slot }]" :style="itemStyle(item)" :target-id="choiceTargetId(item)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="118" :color="choiceColor(item)" @select="choose(item)">
                  <template #default>
                    <div :class="['choice-content', { 'choice-content--mistake': lastMistakeSlot === item.slot }]">
                      <div :class="['choice-art', `choice-art--${item.slot}`]" aria-hidden="true">
                        <span class="choice-art__detail choice-art__detail--one" />
                        <span class="choice-art__detail choice-art__detail--two" />
                      </div>
                      <div class="text-h5 text-md-h4 font-weight-bold mt-1">{{ item.label }}</div>
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
  background: radial-gradient(circle at 12% 18%, rgb(255 226 170 / 68%), transparent 26%), linear-gradient(135deg, #fff7dc 0%, #e7f6f0 48%, #e9efff 100%);
  block-size: 100vh;
  overflow: hidden;
}

.game-container {
  block-size: 100vh;
  padding-block: 4.75rem 0.75rem;
}

.dress-card {
  background: rgb(255 251 244 / 96%);
  max-block-size: calc(100vh - 5.5rem);
  overflow: hidden;
}

.prompt-line {
  min-block-size: 1.4rem;
}

.play-area {
  align-items: stretch;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(19rem, 1fr) minmax(18rem, 0.92fr);
}

.character-card {
  background: linear-gradient(160deg, #dff7f3 0%, #f6eefb 100%);
  min-inline-size: 0;
}

.scene-meta {
  color: rgb(var(--v-theme-on-surface) / 70%);
  font-size: 0.88rem;
  font-weight: 700;
}

.character-stage {
  block-size: clamp(18rem, 50vh, 26rem);
  margin-inline: auto;
  max-inline-size: 30rem;
  overflow: hidden;
  position: relative;
}

.closet-sparkle {
  background: rgb(255 255 255 / 70%);
  border-radius: 999px;
  position: absolute;
}

.closet-sparkle--one {
  block-size: 3.1rem;
  inline-size: 10rem;
  inset-block-start: 12%;
  inset-inline-start: 8%;
}

.closet-sparkle--two {
  block-size: 2.5rem;
  inline-size: 8rem;
  inset-block-start: 55%;
  inset-inline-end: 8%;
}

.scene-rug {
  background: radial-gradient(ellipse, rgb(255 214 165 / 70%) 0 58%, transparent 60%);
  block-size: 4.1rem;
  inline-size: 18rem;
  inset-block-end: 0.5rem;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
  z-index: 0;
}

.person,
.dress-piece {
  position: absolute;
  z-index: 2;
}

.person--head {
  background: #ffd2bd;
  block-size: clamp(4.1rem, 10vh, 5.8rem);
  border: 0.22rem solid rgb(93 64 55 / 18%);
  border-radius: 50%;
  box-shadow: inset 0 -0.35rem 0 rgb(0 0 0 / 5%);
  inline-size: clamp(4.1rem, 10vh, 5.8rem);
  inset-block-start: 14%;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  z-index: 5;
}

.person-eye {
  background: #263238;
  block-size: 0.45rem;
  border-radius: 999px;
  inline-size: 0.45rem;
  inset-block-start: 46%;
  position: absolute;
}

.person-eye--left {
  inset-inline-start: 34%;
}

.person-eye--right {
  inset-inline-end: 34%;
}

.person-smile {
  border-block-end: 0.18rem solid #8d5b4c;
  border-radius: 0 0 999px 999px;
  block-size: 0.7rem;
  inline-size: 1.5rem;
  inset-block-start: 61%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.person--neck {
  background: #f3bda9;
  block-size: 2rem;
  border-radius: 0.6rem;
  inline-size: 1.5rem;
  inset-block-start: 31%;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  z-index: 3;
}

.person--body {
  background: linear-gradient(180deg, #fff2d9 0%, #ffe0b2 100%);
  block-size: clamp(7.2rem, 20vh, 10.2rem);
  border: 0.22rem solid rgb(93 64 55 / 14%);
  border-radius: 2rem 2rem 1.25rem 1.25rem;
  box-shadow: inset 0 -0.5rem 0 rgb(0 0 0 / 5%);
  inline-size: clamp(6.8rem, 16vh, 9.3rem);
  inset-block-start: 34%;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

.person--arm {
  background: #ffd2bd;
  block-size: clamp(4.8rem, 13vh, 6.4rem);
  border-radius: 999px;
  inline-size: 1.35rem;
  inset-block-start: 39%;
  z-index: 1;
}

.person--arm-left {
  inset-inline-start: calc(50% - 5.6rem);
  transform: rotate(18deg);
}

.person--arm-right {
  inset-inline-start: calc(50% + 4.4rem);
  transform: rotate(-18deg);
}

.person--leg {
  background: #78909c;
  block-size: clamp(4.6rem, 12vh, 6.5rem);
  border-radius: 0 0 0.8rem 0.8rem;
  inline-size: 1.55rem;
  inset-block-start: 68%;
  z-index: 1;
}

.person--leg-left {
  inset-inline-start: calc(50% - 2.2rem);
}

.person--leg-right {
  inset-inline-start: calc(50% + 0.65rem);
}

.dress-piece {
  opacity: 0.2;
  transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
}

.dress-piece--visible,
.dress-piece--hint {
  opacity: 1;
}

.dress-piece--hint {
  filter: drop-shadow(0 0 1rem rgb(var(--v-theme-primary) / 48%));
}

.dress-piece--hat {
  background: linear-gradient(180deg, #d8c5ff 0%, #a78bda 100%);
  block-size: clamp(2.2rem, 5.5vh, 3rem);
  border: 0.2rem solid rgb(255 255 255 / 86%);
  border-radius: 2rem 2rem 0.75rem 0.75rem;
  box-shadow: inset 0 -0.25rem 0 rgb(0 0 0 / 10%);
  inline-size: clamp(5.2rem, 13vh, 7.2rem);
  inset-block-start: 9%;
  inset-inline-start: 50%;
  transform: translateX(-50%) rotate(-2deg);
  z-index: 7;
}

.dress-piece--hat::before {
  background: #f6e7ff;
  block-size: 1.1rem;
  border-radius: 999px;
  content: "";
  inline-size: 1.1rem;
  inset-block-start: -0.65rem;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.dress-piece--jacket {
  background: linear-gradient(150deg, #64b5f6 0%, #1976d2 100%);
  block-size: clamp(7rem, 18vh, 9.5rem);
  border: 0.2rem solid rgb(255 255 255 / 88%);
  border-radius: 2rem 2rem 1.1rem 1.1rem;
  box-shadow: inset 0 -0.45rem 0 rgb(0 0 0 / 12%);
  inline-size: clamp(8rem, 19vh, 11rem);
  inset-block-start: 34%;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  z-index: 4;
}

.dress-piece--jacket::before,
.dress-piece--jacket::after {
  background: linear-gradient(180deg, #64b5f6, #1769aa);
  block-size: 82%;
  border: 0.18rem solid rgb(255 255 255 / 82%);
  border-radius: 999px;
  content: "";
  inline-size: 1.35rem;
  inset-block-start: 0.7rem;
  position: absolute;
}

.dress-piece--jacket::before {
  inset-inline-start: -1.15rem;
  transform: rotate(14deg);
}

.dress-piece--jacket::after {
  inset-inline-end: -1.15rem;
  transform: rotate(-14deg);
}

.dress-piece--jacket .dress-piece__detail--one {
  background: rgb(255 255 255 / 70%);
  block-size: 74%;
  inline-size: 0.18rem;
  inset-block-start: 0.75rem;
  inset-inline-start: 50%;
  position: absolute;
}

.dress-piece--jacket .dress-piece__detail--two {
  background: #ffeb3b;
  block-size: 0.55rem;
  border-radius: 999px;
  inline-size: 0.55rem;
  inset-block-start: 45%;
  inset-inline-start: calc(50% + 0.55rem);
  position: absolute;
}

.dress-piece--shoes {
  block-size: 2.2rem;
  inline-size: clamp(6.6rem, 16vh, 8.8rem);
  inset-block-start: calc(68% + clamp(3.9rem, 10vh, 5.65rem));
  inset-inline-start: 50%;
  transform: translateX(-50%);
  z-index: 5;
}

.dress-piece--shoes::before,
.dress-piece--shoes::after {
  background: linear-gradient(180deg, #4db6ac 0%, #00897b 100%);
  border: 0.18rem solid rgb(255 255 255 / 88%);
  border-radius: 1rem 1rem 0.55rem 0.55rem;
  box-shadow: inset 0 -0.25rem 0 rgb(0 0 0 / 12%);
  block-size: 1.7rem;
  content: "";
  inline-size: 3.2rem;
  position: absolute;
}

.dress-piece--shoes::before {
  inset-inline-start: 0.25rem;
  transform: rotate(-5deg);
}

.dress-piece--shoes::after {
  inset-inline-end: 0.25rem;
  transform: rotate(5deg);
}

.choice-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-rows: repeat(3, minmax(0, 1fr));
}

.choice-button :deep(.dwell-button) {
  background: radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--item-color) 62%, white), transparent 0 18%, transparent 19%),
    linear-gradient(135deg, color-mix(in srgb, var(--item-color) 38%, #263238) 0%, #253238 52%, var(--item-dark) 100%) !important;
  background-color: #253238 !important;
  border: 0.18rem solid color-mix(in srgb, var(--item-color) 62%, white);
  color: #fff;
  padding: 0.7rem !important;
  text-shadow: 0 0.08rem 0.12rem rgb(0 0 0 / 38%);
}

.choice-button :deep(.dwell-button--active) {
  background: linear-gradient(135deg, color-mix(in srgb, var(--item-color) 55%, #263238), var(--item-dark)) !important;
}

.choice-art {
  block-size: clamp(3.2rem, min(8vw, 10vh), 5.2rem);
  inline-size: clamp(5.3rem, min(13vw, 17vh), 8.6rem);
  margin-inline: auto;
  position: relative;
}

.choice-art::before,
.choice-art::after,
.choice-art__detail {
  background: var(--item-color);
  border: 0.2rem solid rgb(255 255 255 / 92%);
  box-shadow: inset 0 -0.25rem 0 rgb(0 0 0 / 10%);
  content: "";
  display: block;
  position: absolute;
}

.choice-art--hat::before {
  block-size: 48%;
  border-radius: 2rem 2rem 0.8rem 0.8rem;
  inline-size: 72%;
  inset-block-start: 35%;
  inset-inline-start: 14%;
}

.choice-art--hat::after {
  background: color-mix(in srgb, var(--item-color) 65%, white);
  block-size: 22%;
  border-radius: 999px;
  inline-size: 18%;
  inset-block-start: 13%;
  inset-inline-start: 41%;
}

.choice-art--hat .choice-art__detail,
.choice-art--shoes .choice-art__detail {
  display: none;
}

.choice-art--jacket::before {
  block-size: 74%;
  border-radius: 1.2rem 1.2rem 0.75rem 0.75rem;
  inline-size: 56%;
  inset-block-start: 15%;
  inset-inline-start: 22%;
}

.choice-art--jacket::after {
  background: rgb(255 255 255 / 62%);
  block-size: 57%;
  border: 0;
  box-shadow: none;
  inline-size: 0.2rem;
  inset-block-start: 28%;
  inset-inline-start: 50%;
}

.choice-art--jacket .choice-art__detail--one,
.choice-art--jacket .choice-art__detail--two {
  block-size: 57%;
  border-radius: 999px;
  inline-size: 17%;
  inset-block-start: 26%;
}

.choice-art--jacket .choice-art__detail--one {
  inset-inline-start: 4%;
  transform: rotate(15deg);
}

.choice-art--jacket .choice-art__detail--two {
  inset-inline-end: 4%;
  transform: rotate(-15deg);
}

.choice-art--shoes::before,
.choice-art--shoes::after {
  block-size: 42%;
  border-radius: 1.2rem 1.2rem 0.55rem 0.55rem;
  inline-size: 38%;
  inset-block-start: 42%;
}

.choice-art--shoes::before {
  inset-inline-start: 10%;
  transform: rotate(-7deg);
}

.choice-art--shoes::after {
  inset-inline-end: 10%;
  transform: rotate(7deg);
}

.choice-content--mistake {
  opacity: 0.68;
}

.choice-button--hinted {
  filter: drop-shadow(0 0 1rem rgb(var(--v-theme-primary) / 38%));
  transform: scale(1.02);
}

@media (max-width: 56rem) {
  .dress-character-shell {
    overflow-y: auto;
  }

  .game-container {
    block-size: auto;
    padding-block-start: 7.5rem;
  }

  .dress-card {
    max-block-size: none;
  }

  .play-area {
    grid-template-columns: 1fr;
  }

  .choice-grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 4.35rem;
  }

  .dress-card {
    padding-block: 0.75rem !important;
  }

  .dress-card .text-overline {
    display: none;
  }

  .prompt-line {
    margin-block-end: 0.5rem !important;
  }

  .play-area {
    gap: 0.75rem;
    grid-template-columns: minmax(0, 0.9fr) minmax(18rem, 1.1fr);
  }

  .character-stage {
    block-size: 17.2rem;
  }

  .choice-art {
    block-size: clamp(2.4rem, min(5.2vw, 7vh), 3.4rem);
    inline-size: clamp(4.2rem, min(9vw, 12vh), 5.8rem);
  }

  .choice-grid {
    gap: 0.55rem;
  }

  .choice-button :deep(.dwell-button) {
    min-block-size: 108px !important;
  }
}
</style>
