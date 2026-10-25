<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useGameTimers } from "../../composables/useGameTimers";
import { gameArtSrc } from "../../core/gameArt";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  disposeDressCharacterAudio,
  playDressCharacterHintMelody,
  playDressCharacterSuccessMelody,
  warmDressCharacterAudio,
} from "./audio";
import {
  clothingArtId,
  clothingSlots,
  dressCharacterMaxSteps,
  getDressCharacterExpectedItem,
  getDressCharacterKit,
  getDressCharacterTask,
  isDressCharacterKitCompleteStep,
  type ClothingItem,
  type ClothingSlot,
} from "./model";

const resetDelayMs = 1300;

const router = useRouter();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  recordSuccess,
  recordMistake,
  startSession,
} = useGameSessionFor("dress-character", {
  maxSteps: dressCharacterMaxSteps(),
  overrides: { dwellMs: 1300, sessionSeconds: 150, sound: true },
  finishOnMistakes: false,
});

const dressed = reactive<Record<ClothingSlot, boolean>>(
  Object.fromEntries(clothingSlots.map((slot) => [slot, false])) as Record<ClothingSlot, boolean>,
);
const lastMistakeChoiceId = ref<string>();
const feedbackMessage = ref("Смотри на погоду и выбирай подходящую одежду.");
const resultVisible = ref(false);
const isSpeaking = ref(false);
const isFeedbackPlaying = ref(false);
const isResettingKit = ref(false);
const isInputCoolingDown = ref(false);
const promptAudio = useGamePromptAudio({
  gameId: "dress-character",
  soundEnabled: toRef(session.settings, "sound"),
});
const { setGameTimeout, clearGameTimers } = useGameTimers();

const visibleStep = computed(() =>
  isResettingKit.value
    ? Math.max(0, session.step - 1)
    : Math.min(session.step, session.maxSteps - 1),
);
const currentKit = computed(() => getDressCharacterKit(visibleStep.value));
const currentTask = computed(() => getDressCharacterTask(visibleStep.value));
const clothingItems = computed(() => currentTask.value.choices);
const completedCycles = computed(() => Math.floor(visibleStep.value / clothingSlots.length));
const progressText = computed(
  () => `Шаг ${Math.min(visibleStep.value + 1, session.maxSteps)} из ${session.maxSteps}`,
);
const kitStyle = computed(() => {
  const entries = currentKit.value.items.flatMap((item) => [
    [`--${item.slot}-color`, item.target.color],
    [`--${item.slot}-dark`, item.target.darkColor],
  ]);
  return Object.fromEntries([
    ["--scene-start", currentKit.value.sceneStart],
    ["--scene-end", currentKit.value.sceneEnd],
    ["--scene-accent", currentKit.value.sceneAccent],
    ...entries,
  ]);
});

const childSrc = gameArtSrc("dress-character/child");
// Only correct choices are put on, so a dressed slot always shows the kit's target.
const wornItems = computed(() =>
  currentKit.value.items
    .filter((task) => dressed[task.slot])
    .map((task) => {
      const artId = clothingArtId(task.target);
      return { slot: task.slot, kind: artId.split("/")[1], src: gameArtSrc(artId) };
    }),
);

function choiceArtSrc(item: ClothingItem) {
  return gameArtSrc(clothingArtId(item));
}

function choiceTargetId(item: ClothingItem) {
  return `dress-character:choice:${item.id}`;
}

function resetClothes() {
  for (const slot of clothingSlots) dressed[slot] = false;
}

function clearResetTimer() {
  clearGameTimers();
}

function promptAssetId(task = currentTask.value, kit = currentKit.value) {
  return `dress-character.prompt.${kit.id}.${task.slot}`;
}

async function playPrompt(delayMs = 0) {
  const sessionId = session.sessionId;
  const step = session.step;
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  if (session.sessionId === sessionId && session.step === step) isSpeaking.value = false;
}

function scheduleKitReset() {
  clearResetTimer();
  isResettingKit.value = true;
  feedbackMessage.value = `${currentKit.value.title}: комплект готов. Посмотрим на него и подготовим следующую погоду.`;
  setGameTimeout(() => {
    resetClothes();
    lastMistakeChoiceId.value = undefined;
    isResettingKit.value = false;
    isInputCoolingDown.value = true;
    feedbackMessage.value = `${currentKit.value.title}. ${currentKit.value.helper}`;
    void playPrompt(150);
    setGameTimeout(() => {
      isInputCoolingDown.value = false;
    }, 700);
  }, resetDelayMs);
}

async function choose(item: ClothingItem) {
  if (
    session.status !== "running" ||
    isResettingKit.value ||
    isInputCoolingDown.value ||
    isFeedbackPlaying.value ||
    isSpeaking.value
  )
    return;

  const expectedItem = getDressCharacterExpectedItem(session.step);
  const targetId = choiceTargetId(item);
  const expectedTargetId = choiceTargetId(expectedItem);
  const roundId = `dress-character:round:${session.step + 1}`;

  if (item.id === expectedItem.id) {
    const sessionId = session.sessionId;
    isFeedbackPlaying.value = true;
    dressed[item.slot] = true;
    lastMistakeChoiceId.value = undefined;
    feedbackMessage.value = `Да, это ${item.label.toLowerCase()}. Персонажу удобно.`;
    recordSuccess({
      roundId,
      targetId,
      answerId: item.slot,
      expected: expectedItem.label,
      actual: item.label,
      isCorrect: true,
    });
    const completedStep = session.step;
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await playDressCharacterSuccessMelody(session.settings.sound);
    if (session.sessionId !== sessionId || session.step !== completedStep) return;
    if (finishedAfterSuccess) {
      isSpeaking.value = true;
      const playback = await promptAudio.playSequenceAndWait(
        ["dress-character.correct", "dress-character.complete"],
        80,
        170,
      );
      if (
        playback === "cancelled" ||
        session.sessionId !== sessionId ||
        session.step !== completedStep
      )
        return;
      isSpeaking.value = false;
      isFeedbackPlaying.value = false;
      resultVisible.value = true;
      return;
    }

    if (isDressCharacterKitCompleteStep(session.step - 1)) {
      isSpeaking.value = true;
      const playback = await promptAudio.playSequenceAndWait(
        ["dress-character.correct", "dress-character.kit-complete"],
        80,
        170,
      );
      if (
        playback === "cancelled" ||
        session.sessionId !== sessionId ||
        session.step !== completedStep
      )
        return;
      isSpeaking.value = false;
      isFeedbackPlaying.value = false;
      scheduleKitReset();
      return;
    }

    isSpeaking.value = true;
    const playback = await promptAudio.playSequenceAndWait(
      ["dress-character.correct", promptAssetId()],
      80,
      170,
    );
    if (
      playback === "cancelled" ||
      session.sessionId !== sessionId ||
      session.step !== completedStep
    )
      return;
    isSpeaking.value = false;
    isFeedbackPlaying.value = false;
    return;
  }

  isFeedbackPlaying.value = true;
  const sessionId = session.sessionId;
  const step = session.step;
  lastMistakeChoiceId.value = item.id;
  feedbackMessage.value = "Посмотри одежду ещё раз.";
  recordMistake({
    roundId,
    targetId,
    expectedTargetId,
    answerId: item.slot,
    expected: expectedItem.label,
    actual: item.label,
    isCorrect: false,
  });
  await playDressCharacterHintMelody(session.settings.sound);
  if (session.sessionId !== sessionId || session.step !== step) return;
  isSpeaking.value = true;
  const playback = await promptAudio.playSequenceAndWait(
    [
      "dress-character.mistake",
      promptAssetId(getDressCharacterTask(session.step), getDressCharacterKit(session.step)),
    ],
    80,
    170,
  );
  if (playback === "cancelled" || session.sessionId !== sessionId || session.step !== step) return;
  isSpeaking.value = false;
  lastMistakeChoiceId.value = undefined;
  isFeedbackPlaying.value = false;
}

function itemStyle(item: ClothingItem) {
  return {
    "--item-color": item.color,
    "--item-dark": item.darkColor,
  };
}

function choiceColor(item: ClothingItem) {
  if (lastMistakeChoiceId.value === item.id) return "deep-orange-darken-2";
  return "blue-grey-darken-4";
}

function restart() {
  clearResetTimer();
  promptAudio.cancelPending();
  resetClothes();
  lastMistakeChoiceId.value = undefined;
  resultVisible.value = false;
  isSpeaking.value = false;
  isFeedbackPlaying.value = false;
  isResettingKit.value = false;
  isInputCoolingDown.value = false;
  feedbackMessage.value = "Смотри на погоду и выбирай подходящую одежду.";
  startSession();
  void playPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  warmDressCharacterAudio(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearResetTimer();
  promptAudio.cancelPending();
  disposeDressCharacterAudio();
});

watch(
  () => session.status,
  (status) => {
    if (status !== "finished") {
      resultVisible.value = false;
      return;
    }
    if (!isFeedbackPlaying.value && !isSpeaking.value) resultVisible.value = true;
  },
);
</script>

<template>
  <div class="dress-character-shell">
    <GameHud
      title="Одень персонажа"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="dress-card pa-3 pa-md-4" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Гардероб для прогулки</div>
            <h1 class="text-h5 text-md-h4 font-weight-bold text-center mb-1">Одень персонажа</h1>
            <p class="prompt-line text-body-1 text-md-h6 text-medium-emphasis text-center mb-3">
              {{ isResettingKit ? currentKit.helper : currentTask.prompt }}
            </p>

            <div class="play-area">
              <v-card class="character-card pa-3" rounded="xl" variant="flat" :style="kitStyle">
                <div class="scene-meta d-flex align-center justify-space-between mb-2">
                  <span>Комплект {{ completedCycles + 1 }} · {{ currentKit.title }}</span>
                  <v-chip color="primary" size="small" variant="tonal">{{ progressText }}</v-chip>
                </div>
                <div class="character-stage" aria-label="Персонаж для одевания">
                  <div class="closet-sparkle closet-sparkle--one" />
                  <div class="closet-sparkle closet-sparkle--two" />
                  <div class="person">
                    <img class="person__child" :src="childSrc" alt="" draggable="false" />
                    <template v-for="piece in wornItems" :key="piece.slot">
                      <!-- A pair of shoes is split so that each shoe lands on its own foot. -->
                      <template v-if="piece.slot === 'shoes'">
                        <span
                          v-for="side in ['left', 'right']"
                          :key="side"
                          :class="['dress-shoe', `dress-shoe--${side}`]"
                        >
                          <img :src="piece.src" alt="" draggable="false" />
                        </span>
                      </template>
                      <img
                        v-else
                        :class="[
                          'dress-piece',
                          `dress-piece--${piece.slot}`,
                          `dress-piece--${piece.kind}`,
                        ]"
                        :src="piece.src"
                        alt=""
                        draggable="false"
                      />
                    </template>
                  </div>
                  <div class="scene-rug" />
                </div>
                <v-alert
                  class="feedback-alert mt-2 text-body-2 font-weight-bold"
                  color="primary"
                  icon="mdi-lightbulb-on-outline"
                  rounded="xl"
                  variant="tonal"
                >
                  {{ feedbackMessage }}
                </v-alert>
              </v-card>

              <div class="choice-grid" aria-label="Выбор одежды">
                <GameDwellButton
                  v-for="item in clothingItems"
                  :key="item.id"
                  :class="['choice-button', `choice-button--${item.slot}`]"
                  :style="itemStyle(item)"
                  :target-id="choiceTargetId(item)"
                  :disabled="
                    session.status !== 'running' ||
                    isResettingKit ||
                    isInputCoolingDown ||
                    isFeedbackPlaying ||
                    isSpeaking
                  "
                  :dwell-ms="session.settings.dwellMs"
                  min-height="7.375rem"
                  :color="choiceColor(item)"
                  @select="choose(item)"
                >
                  <template #default>
                    <div
                      :class="[
                        'choice-content',
                        { 'choice-content--mistake': lastMistakeChoiceId === item.id },
                      ]"
                    >
                      <img class="choice-art" :src="choiceArtSrc(item)" alt="" draggable="false" />
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
    <GameResultDialog
      :model-value="resultVisible"
      title="Одень персонажа"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.dress-character-shell {
  background:
    radial-gradient(circle at 12% 18%, rgb(255 226 170 / 68%), transparent 26%),
    linear-gradient(135deg, #fff7dc 0%, #e7f6f0 48%, #e9efff 100%);
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
  background: linear-gradient(160deg, var(--scene-start) 0%, var(--scene-end) 100%);
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
  background: radial-gradient(
    ellipse,
    color-mix(in srgb, var(--scene-accent) 74%, white) 0 58%,
    transparent 60%
  );
  block-size: 4.1rem;
  inline-size: 18rem;
  inset-block-end: 0.5rem;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
  z-index: 0;
}

.person {
  aspect-ratio: 292 / 470;
  block-size: 94%;
  inset-block-end: 2%;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
  z-index: 2;
}

.person__child,
.dress-piece,
.dress-shoe {
  position: absolute;
}

.person__child {
  block-size: 100%;
  inline-size: 100%;
  inset: 0;
  z-index: 2;
}

/* Boxes are in percent of the drawn child: head 2-41 %, body 42-66 %, feet 88-98 %. */
.dress-piece {
  animation: dress-piece-in 260ms ease-out;
  object-fit: contain;
  z-index: 3;
}

.dress-piece--hat {
  block-size: 30%;
  inline-size: 86%;
  inset-block-start: -9%;
  inset-inline-start: 7%;
  object-position: center bottom;
}

/* The hood frames the face from behind instead of covering it. */
.dress-piece--hood {
  block-size: 56%;
  inline-size: 124%;
  inset-block-start: -9%;
  inset-inline-start: -12%;
  object-position: center top;
  z-index: 1;
}

.dress-piece--jacket {
  block-size: 44%;
  inline-size: 100%;
  inset-block-start: 39%;
  inset-inline-start: 0;
  object-position: center top;
}

.dress-shoe {
  animation: dress-piece-in 260ms ease-out;
  block-size: 30%;
  inline-size: 24%;
  inset-block-end: 0;
  overflow: hidden;
  z-index: 3;
}

/* The pair is twice as wide as the box, so each half shows one shoe. */
.dress-shoe img {
  inline-size: 200%;
  inset-block-end: 0;
  position: absolute;
}

.dress-shoe--left {
  inset-inline-start: 19%;
}

.dress-shoe--right {
  inset-inline-start: 57%;
}

.dress-shoe--right img {
  inset-inline-start: -100%;
}

@keyframes dress-piece-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
}

.choice-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-rows: repeat(3, minmax(0, 1fr));
}

.choice-button :deep(.dwell-button) {
  background:
    radial-gradient(
      circle at 18% 20%,
      color-mix(in srgb, var(--item-color) 62%, white),
      transparent 0 18%,
      transparent 19%
    ),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--item-color) 38%, #263238) 0%,
      #253238 52%,
      var(--item-dark) 100%
    ) !important;
  background-color: #253238 !important;
  border: 0.18rem solid color-mix(in srgb, var(--item-color) 62%, white);
  color: #fff;
  padding: 0.7rem !important;
  text-shadow: 0 0.08rem 0.12rem rgb(0 0 0 / 38%);
}

.choice-button :deep(.dwell-button--active) {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--item-color) 55%, #263238),
    var(--item-dark)
  ) !important;
}

.choice-art {
  block-size: clamp(3.6rem, min(10vw, 12vh), 6.4rem);
  inline-size: clamp(5.3rem, min(13vw, 17vh), 8.6rem);
  margin-inline: auto;
  object-fit: contain;
}

.choice-content--mistake {
  opacity: 0.68;
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
    padding-block-start: 3.75rem;
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
    min-block-size: 6.75rem !important;
    padding: 0.35rem !important;
  }
}
</style>
