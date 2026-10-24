<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useGameTimers } from "../../composables/useGameTimers";
import { useRoundGame } from "../../composables/useRoundGame";
import { gameArtSrc } from "../../core/gameArt";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  disposeBuildRobotAudio,
  playBuildRobotMistakeMelody,
  playBuildRobotSuccessMelody,
  warmBuildRobotAudio,
} from "./audio";
import { generateBuildRobotRound, type RobotPart, type RobotPartId } from "./model";

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
  recordHint,
  startSession,
} = useGameSessionFor("build-robot", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false,
});

const {
  round,
  resultVisible,
  nextRound,
  restart: restartRounds,
} = useRoundGame({
  session,
  startSession,
  generateRound: generateBuildRobotRound,
});

const hintedRoundId = ref<string>();
const lastMistakePartId = ref<RobotPartId>();
const successPartId = ref<RobotPartId>();
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const promptAudio = useGamePromptAudio({
  gameId: "build-robot",
  soundEnabled: toRef(session.settings, "sound"),
});
const { setGameTimeout, clearGameTimers } = useGameTimers();

const feedbackText = computed(() => {
  if (successPartId.value) return `Верно. ${round.value.target.label} на месте.`;
  if (hintedRoundId.value === round.value.roundId) return "Почти. Посмотри на детали ещё раз.";
  return round.value.prompt;
});
const partById = computed(
  () =>
    Object.fromEntries(round.value.choices.map((part) => [part.id, part])) as Record<
      RobotPartId,
      RobotPart
    >,
);
const displayedPartIds = computed(
  () =>
    new Set<RobotPartId>([
      ...round.value.completedPartIds,
      ...(successPartId.value ? [successPartId.value] : []),
    ]),
);

function choiceTargetId(part: RobotPart) {
  return `build-robot:${round.value.roundId}:part:${part.id}`;
}

function clearFeedbackTimer() {
  clearGameTimers();
  promptAudio.cancelPending();
}

function promptAssetId() {
  return `build-robot.prompt.${round.value.target.id}`;
}

async function playPrompt(delayMs = 0) {
  const sessionId = session.sessionId;
  const roundId = round.value.roundId;
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  if (session.sessionId === sessionId && round.value.roundId === roundId) isSpeaking.value = false;
}

function resetFeedback() {
  clearFeedbackTimer();
  hintedRoundId.value = undefined;
  lastMistakePartId.value = undefined;
  successPartId.value = undefined;
  pendingSelection.value = false;
  isSpeaking.value = false;
}

async function choosePart(part: RobotPart) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const targetId = choiceTargetId(part);
  const expectedTargetId = choiceTargetId(round.value.target);
  clearFeedbackTimer();

  if (part.id === round.value.target.id) {
    const sessionId = session.sessionId;
    const roundId = round.value.roundId;
    pendingSelection.value = true;
    hintedRoundId.value = undefined;
    lastMistakePartId.value = undefined;
    successPartId.value = part.id;
    void playBuildRobotSuccessMelody(session.settings.sound);
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: part.id,
      expected: round.value.target.label,
      actual: part.label,
      isCorrect: true,
    });
    isSpeaking.value = true;
    const playback = await promptAudio.playSequenceAndWait(["build-robot.correct"], 80);
    if (
      playback === "cancelled" ||
      session.sessionId !== sessionId ||
      round.value.roundId !== roundId
    )
      return;
    isSpeaking.value = false;

    if (session.step < session.maxSteps) {
      setGameTimeout(() => {
        nextRound();
        resetFeedback();
        void playPrompt(180);
      }, 260);
    } else {
      pendingSelection.value = false;
    }
    return;
  }

  pendingSelection.value = true;
  const sessionId = session.sessionId;
  const roundId = round.value.roundId;
  void playBuildRobotMistakeMelody(session.settings.sound);
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId,
    answerId: part.id,
    expected: round.value.target.label,
    actual: part.label,
    isCorrect: false,
  });
  recordHint({
    roundId: round.value.roundId,
    targetId: expectedTargetId,
    reason: "wrong-robot-part",
  });
  hintedRoundId.value = round.value.roundId;
  lastMistakePartId.value = part.id;
  isSpeaking.value = true;
  const playback = await promptAudio.playSequenceAndWait(
    ["build-robot.mistake", promptAssetId()],
    80,
    170,
  );
  if (
    playback === "cancelled" ||
    session.sessionId !== sessionId ||
    round.value.roundId !== roundId
  )
    return;
  pendingSelection.value = false;
  lastMistakePartId.value = undefined;
  isSpeaking.value = false;
}

function choiceColor(part: RobotPart) {
  if (successPartId.value === part.id) return "green-darken-3";
  if (lastMistakePartId.value === part.id) return "deep-orange-darken-2";
  return "blue-grey-darken-4";
}

function slotColor(partId: RobotPartId) {
  if (displayedPartIds.value.has(partId)) return partById.value[partId].color;
  return "blue-grey-lighten-5";
}

function partStyle(part: RobotPart) {
  return { "--part-color": part.color };
}

// The three robots share one drawing; a hue shift keeps them apart, as the
// three colour palettes did before.
const robotArtStyle = computed(() => ({
  filter: `hue-rotate(${((round.value.robotIndex - 1) % 3) * 120}deg)`,
}));

function slotFilled(partId: RobotPartId) {
  return displayedPartIds.value.has(partId);
}

function restart() {
  resetFeedback();
  restartRounds();
  void playPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  warmBuildRobotAudio(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearFeedbackTimer();
  disposeBuildRobotAudio();
});
</script>

<template>
  <div class="build-robot-shell">
    <GameHud
      title="Собери роботика"
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
          <v-card class="robot-card pa-3 pa-md-4" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">
              Последовательность сборки
            </div>
            <h1 class="text-h5 text-md-h4 font-weight-bold text-center mb-1">Собери роботика</h1>
            <p class="feedback-line text-body-1 text-md-h6 text-medium-emphasis text-center mb-3">
              {{ feedbackText }}
            </p>

            <v-row class="align-stretch" dense>
              <v-col cols="12" sm="5">
                <v-card class="robot-stage pa-3" color="cyan-lighten-5" rounded="xl" variant="flat">
                  <div class="text-body-2 text-medium-emphasis text-center mb-2">
                    Робот {{ round.robotIndex }}, шаг {{ round.stepIndex + 1 }} из 4
                  </div>
                  <div class="robot-layout" aria-label="Собираемый робот">
                    <v-card
                      :class="[
                        'robot-slot',
                        'robot-slot--head',
                        { 'robot-slot--placed': displayedPartIds.has('head') },
                      ]"
                      :color="slotColor('head')"
                      rounded="xl"
                      variant="flat"
                    >
                      <span
                        :class="[
                          'robot-art',
                          'robot-art--head',
                          { 'robot-art--ghost': !slotFilled('head') },
                        ]"
                        :style="robotArtStyle"
                        aria-hidden="true"
                      >
                        <img
                          v-for="artId in partById.head.art"
                          :key="artId"
                          :src="gameArtSrc(artId)"
                          alt=""
                        />
                      </span>
                      <div class="text-subtitle-1 font-weight-bold mt-2">
                        {{ partById.head.label }}
                      </div>
                    </v-card>

                    <div class="robot-middle-row">
                      <v-card
                        :class="[
                          'robot-slot',
                          'robot-slot--arms',
                          'robot-slot--arms-left',
                          { 'robot-slot--placed': displayedPartIds.has('arms') },
                        ]"
                        :color="slotColor('arms')"
                        rounded="xl"
                        variant="flat"
                      >
                        <span
                          :class="[
                            'robot-art',
                            'robot-art--arm',
                            { 'robot-art--ghost': !slotFilled('arms') },
                          ]"
                          :style="robotArtStyle"
                          aria-hidden="true"
                        >
                          <img
                            v-for="artId in ['build-robot/arm-left']"
                            :key="artId"
                            :src="gameArtSrc(artId)"
                            alt=""
                          />
                        </span>
                      </v-card>

                      <v-card
                        :class="[
                          'robot-slot',
                          'robot-slot--body',
                          { 'robot-slot--placed': displayedPartIds.has('body') },
                        ]"
                        :color="slotColor('body')"
                        rounded="xl"
                        variant="flat"
                      >
                        <span
                          :class="[
                            'robot-art',
                            'robot-art--body',
                            { 'robot-art--ghost': !slotFilled('body') },
                          ]"
                          :style="robotArtStyle"
                          aria-hidden="true"
                        >
                          <img
                            v-for="artId in partById.body.art"
                            :key="artId"
                            :src="gameArtSrc(artId)"
                            alt=""
                          />
                        </span>
                        <div class="text-subtitle-1 font-weight-bold mt-2">
                          {{ partById.body.label }}
                        </div>
                      </v-card>

                      <v-card
                        :class="[
                          'robot-slot',
                          'robot-slot--arms',
                          'robot-slot--arms-right',
                          { 'robot-slot--placed': displayedPartIds.has('arms') },
                        ]"
                        :color="slotColor('arms')"
                        rounded="xl"
                        variant="flat"
                      >
                        <span
                          :class="[
                            'robot-art',
                            'robot-art--arm',
                            { 'robot-art--ghost': !slotFilled('arms') },
                          ]"
                          :style="robotArtStyle"
                          aria-hidden="true"
                        >
                          <img
                            v-for="artId in ['build-robot/arm-right']"
                            :key="artId"
                            :src="gameArtSrc(artId)"
                            alt=""
                          />
                        </span>
                      </v-card>
                    </div>

                    <v-card
                      :class="[
                        'robot-slot',
                        'robot-slot--legs',
                        { 'robot-slot--placed': displayedPartIds.has('legs') },
                      ]"
                      :color="slotColor('legs')"
                      rounded="xl"
                      variant="flat"
                    >
                      <span
                        :class="[
                          'robot-art',
                          'robot-art--legs',
                          { 'robot-art--ghost': !slotFilled('legs') },
                        ]"
                        :style="robotArtStyle"
                        aria-hidden="true"
                      >
                        <img
                          v-for="artId in partById.legs.art"
                          :key="artId"
                          :src="gameArtSrc(artId)"
                          alt=""
                        />
                      </span>
                      <div class="text-subtitle-1 font-weight-bold mt-2">
                        {{ partById.legs.label }}
                      </div>
                    </v-card>
                  </div>
                </v-card>
              </v-col>

              <v-col cols="12" sm="7">
                <v-row class="choice-grid" dense>
                  <v-col v-for="part in round.choices" :key="part.id" cols="12" sm="6">
                    <GameDwellButton
                      :class="['choice-target', `choice-target--${part.id}`]"
                      :style="partStyle(part)"
                      :target-id="choiceTargetId(part)"
                      :disabled="session.status !== 'running' || pendingSelection || isSpeaking"
                      :dwell-ms="session.settings.dwellMs"
                      min-height="8.25rem"
                      :color="choiceColor(part)"
                      @select="choosePart(part)"
                    >
                      <template #default>
                        <span
                          :class="['robot-art', 'robot-art--choice', `robot-art--${part.id}`]"
                          :style="robotArtStyle"
                          aria-hidden="true"
                        >
                          <img
                            v-for="artId in part.art"
                            :key="artId"
                            :src="gameArtSrc(artId)"
                            alt=""
                          />
                        </span>
                        <div class="text-h5 text-md-h4 font-weight-bold mt-2">{{ part.label }}</div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert
                v-if="hintedRoundId === round.roundId"
                class="mt-3 text-body-1 font-weight-bold"
                color="primary"
                icon="mdi-lightbulb-on-outline"
                rounded="xl"
                variant="tonal"
              >
                Можно попробовать ещё раз.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog
      :model-value="resultVisible"
      title="Собери роботика"
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
.build-robot-shell {
  background: linear-gradient(135deg, #eef9ff 0%, #fff7e8 52%, #f2efff 100%);
  block-size: 100vh;
  overflow: hidden;
}

.game-container {
  block-size: 100vh;
  padding-block: 4.75rem 0.75rem;
}

.robot-card {
  max-block-size: calc(100vh - 5.5rem);
  overflow: hidden;
}

.feedback-line {
  min-block-size: 1.4rem;
}

.robot-stage {
  block-size: 100%;
}

.robot-layout {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: clamp(0.75rem, 1.4vw, 1rem);
  margin-inline: auto;
  max-inline-size: 26rem;
}

.robot-middle-row {
  align-items: stretch;
  display: grid;
  gap: clamp(0.55rem, 1.1vw, 0.85rem);
  grid-template-columns: minmax(4.3rem, 0.72fr) minmax(7rem, 1.45fr) minmax(4.3rem, 0.72fr);
  inline-size: 100%;
}

.robot-slot {
  align-items: center;
  border: 0.2rem dashed rgb(var(--v-theme-primary) / 22%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: clamp(5.1rem, 12vh, 7.4rem);
  text-align: center;
  transition:
    filter 160ms ease,
    transform 160ms ease;
}

.robot-slot :deep(.v-card__underlay) {
  opacity: 0;
}

.robot-slot--head {
  inline-size: min(46%, 10.5rem);
}

.robot-slot--body {
  min-block-size: clamp(5.6rem, 13vh, 7.8rem);
}

.robot-slot--legs {
  inline-size: min(46%, 10.5rem);
}

.robot-slot--arms {
  padding-inline: 0.35rem;
}

.robot-slot--placed {
  border-style: solid;
  box-shadow: inset 0 -0.45rem 0 rgb(0 0 0 / 8%);
}

.robot-slot--hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

.choice-grid {
  block-size: 100%;
  row-gap: 0.5rem;
}

.choice-grid :deep(.dwell-button) {
  background:
    radial-gradient(
      circle at 18% 18%,
      color-mix(in srgb, var(--part-color) 44%, white),
      transparent 0 20%,
      transparent 21%
    ),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--part-color) 35%, #263238) 0%,
      #243238 46%,
      #172429 100%
    ) !important;
  background-color: #243238 !important;
  border: 0.18rem solid color-mix(in srgb, var(--part-color) 55%, white);
  color: #fff;
  padding: 0.75rem !important;
  text-shadow: 0 0.08rem 0.12rem rgb(0 0 0 / 34%);
}

.choice-target :deep(.dwell-button--active) {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--part-color) 58%, #263238),
    #1c3338
  ) !important;
}

.robot-art {
  align-items: center;
  block-size: clamp(3.6rem, min(9vw, 12vh), 6.4rem);
  display: flex;
  justify-content: center;
  margin-inline: auto;
}

.robot-art img {
  block-size: 100%;
  inline-size: auto;
  max-inline-size: 100%;
  object-fit: contain;
}

/* The antenna sits on top of the head, a third of its height. */
.robot-art--head {
  flex-direction: column;
}

.robot-art--head img:first-child {
  block-size: 34%;
  margin-block-end: -6%;
}

.robot-art--head img:last-child {
  block-size: 72%;
}

.robot-art--choice {
  block-size: clamp(4.2rem, min(8vw, 12vh), 6.4rem);
  filter: drop-shadow(0 0.35rem 0.25rem rgb(0 0 0 / 18%));
}

/* An empty slot shows a pale outline of the part it waits for. */
.robot-art--ghost img {
  filter: grayscale(1) brightness(1.6);
  opacity: 0.35;
}

@media (max-width: 37.5rem) {
  .game-container {
    overflow-y: auto;
    padding-block-start: 7.5rem;
  }

  .build-robot-shell {
    overflow-y: auto;
  }

  .robot-card {
    max-block-size: none;
  }

  .robot-slot {
    min-block-size: 7.25rem;
  }

  .robot-middle-row {
    grid-template-columns: minmax(4rem, 0.72fr) minmax(6.5rem, 1.45fr) minmax(4rem, 0.72fr);
  }
}

@media (max-height: 51.25rem) {
  .game-container {
    padding-block-start: 4.4rem;
  }

  .robot-slot {
    min-block-size: clamp(4.6rem, 10vh, 6.2rem);
  }

  .robot-art,
  .robot-art--choice {
    block-size: clamp(2.55rem, min(5.3vw, 7.4vh), 3.9rem);
    inline-size: clamp(3.4rem, min(7vw, 9.6vh), 5.1rem);
  }
}
</style>
