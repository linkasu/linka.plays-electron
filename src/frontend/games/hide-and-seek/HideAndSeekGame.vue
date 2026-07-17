<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssets from "../../data/ttsAssets.json";
import { disposeHideAndSeekAudio, playHideAndSeekMistakeMelody, playHideAndSeekSuccessMelody, resetHideAndSeekAudioSession, warmHideAndSeekAudio } from "./audio";
import { createHideAndSeekLayout, hideAndSeekFallbackObstacles, type HideAndSeekRect } from "./model";

type SeekPicture = { id: string; emoji: string; name: string };
type HiddenObject = SeekPicture & { placementIndex: number; hidden: boolean };
type SeekRound = { id: string; target: SeekPicture; choices: HiddenObject[] };
type ElementComponent = { $el?: HTMLElement };

const totalRounds = 10;
const choicesPerRound = 5;
const picturePool: SeekPicture[] = [
  { id: "cat", emoji: "🐱", name: "кота" },
  { id: "star", emoji: "⭐", name: "звезду" },
  { id: "flower", emoji: "🌸", name: "цветок" },
  { id: "duck", emoji: "🦆", name: "утку" },
  { id: "ball", emoji: "⚽", name: "мяч" },
  { id: "dog", emoji: "🐶", name: "собаку" },
  { id: "rabbit", emoji: "🐰", name: "зайца" },
  { id: "bear", emoji: "🐻", name: "мишку" },
  { id: "car", emoji: "🚗", name: "машинку" },
  { id: "tree", emoji: "🌳", name: "дерево" },
  { id: "apple", emoji: "🍎", name: "яблоко" },
  { id: "fish", emoji: "🐟", name: "рыбку" },
  { id: "sun", emoji: "☀️", name: "солнце" },
  { id: "moon", emoji: "🌙", name: "луну" },
  { id: "butterfly", emoji: "🦋", name: "бабочку" }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("hide-and-seek", { maxSteps: totalRounds });

const hideAndSeekTtsAssets = (ttsAssets as TtsAsset[]).filter((asset) => asset.game === "hide-and-seek");
const rounds = ref<SeekRound[]>(createRounds());
const pageIndex = ref(0);
const isAdvancing = ref(false);
const resultVisible = computed(() => session.status === "finished");
const currentRound = computed(() => rounds.value[pageIndex.value]);
const currentObject = computed(() => currentRound.value?.target);
const feedbackMessage = ref("Смотри и выбирай того, кого просим.");
const lastMistakeObjectId = ref<string>();
const shellRef = ref<HTMLElement>();
const promptRef = ref<ElementComponent>();
const viewportSize = ref({ width: window.innerWidth, height: window.innerHeight });
const obstacleBounds = ref<HideAndSeekRect[]>(hideAndSeekFallbackObstacles(window.innerWidth, window.innerHeight));
const sceneLayout = computed(() => createHideAndSeekLayout({
  viewportWidth: viewportSize.value.width,
  viewportHeight: viewportSize.value.height,
  targetScale: session.settings.targetScale,
  targetCount: choicesPerRound,
  obstacles: obstacleBounds.value
}));
const mistakenObjectIdsForCurrentTarget = new Set<string>();
let nextRoundTimer = 0;
let promptTimer = 0;
let responseTtsTimer = 0;
let layoutFrame = 0;

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function createRound(roundIndex: number, target: SeekPicture): SeekRound {
  const distractors = shuffled(picturePool.filter((picture) => picture.id !== target.id)).slice(0, choicesPerRound - 1);
  const choices = shuffled([target, ...distractors]);
  return {
    id: `hide-and-seek-round-${roundIndex}-${Date.now()}`,
    target,
    choices: choices.map((choice, placementIndex) => ({ ...choice, placementIndex, hidden: false }))
  };
}

function createRounds() {
  return shuffled(picturePool).slice(0, totalRounds).map((target, index) => createRound(index, target));
}

function ttsAsset(id: string) {
  return hideAndSeekTtsAssets.find((asset) => asset.id === id);
}

function playPrompt(delayMs = 0) {
  window.clearTimeout(promptTimer);
  promptTimer = window.setTimeout(() => {
    const object = currentObject.value;
    if (!object) return;
    playTtsAsset(session.settings.sound, ttsAsset(`hide-and-seek.prompt.${object.id}`), 0.36);
  }, delayMs);
}

function playResponseTts(id: string, delayMs = 920) {
  window.clearTimeout(responseTtsTimer);
  responseTtsTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset(id), 0.36);
  }, delayMs);
}

function objectWidth() {
  return sceneLayout.value.targetWidth;
}

function objectHeight() {
  return sceneLayout.value.targetHeight;
}

function objectHitPadding() {
  return sceneLayout.value.hitPadding;
}

function objectTargetId(object: HiddenObject) {
  return `hide-and-seek:${currentRound.value?.id ?? "round"}:object:${object.id}`;
}

function objectStyle(object: HiddenObject) {
  const point = sceneLayout.value.placements[object.placementIndex];
  const isLastMistake = object.id === lastMistakeObjectId.value;

  return {
    left: `${point.x}px`,
    top: `${point.y}px`,
    inlineSize: `${objectWidth()}px`,
    opacity: isLastMistake ? 0.72 : 0.42
  };
}

function scheduleLayoutUpdate() {
  window.cancelAnimationFrame(layoutFrame);
  layoutFrame = window.requestAnimationFrame(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    viewportSize.value = { width, height };
    const hud = shellRef.value?.querySelector<HTMLElement>(".game-hud");
    const prompt = promptRef.value?.$el;
    const measured = [hud, prompt]
      .filter((element): element is HTMLElement => Boolean(element))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
    obstacleBounds.value = measured.length === 2 ? measured : hideAndSeekFallbackObstacles(width, height);
  });
}

function objectColor(object: HiddenObject) {
  return object.id === lastMistakeObjectId.value ? "warning" : "transparent";
}

function chooseObject(object: HiddenObject) {
  if (session.status !== "running" || object.hidden || !currentObject.value || isAdvancing.value) return;

  const expectedObject = currentObject.value;
  object.hidden = true;
  if (object.id !== expectedObject.id) {
    lastMistakeObjectId.value = object.id;
    feedbackMessage.value = `Почти. Попробуем ещё раз: найди ${expectedObject.name}.`;
    void playHideAndSeekMistakeMelody(session.settings.sound);
    playResponseTts("hide-and-seek.mistake");
    if (mistakenObjectIdsForCurrentTarget.has(object.id)) return;

    mistakenObjectIdsForCurrentTarget.add(object.id);
    recordMistake({ targetId: object.id, expectedTargetId: expectedObject.id, actual: object.name, expected: expectedObject.name, isCorrect: false });
    return;
  }

  lastMistakeObjectId.value = undefined;
  mistakenObjectIdsForCurrentTarget.clear();
  feedbackMessage.value = session.step + 1 >= session.maxSteps ? "Всех нашли!" : "Есть! Сейчас новая страница.";
  recordSuccess({ targetId: object.id, answerId: object.id, expected: object.name, actual: object.name, isCorrect: true });
  void playHideAndSeekSuccessMelody(session.settings.sound);
  playResponseTts("hide-and-seek.correct");
  isAdvancing.value = true;
  window.clearTimeout(nextRoundTimer);
  nextRoundTimer = window.setTimeout(() => {
    if (session.status !== "running") return;
    pageIndex.value = Math.min(pageIndex.value + 1, rounds.value.length - 1);
    lastMistakeObjectId.value = undefined;
    mistakenObjectIdsForCurrentTarget.clear();
    feedbackMessage.value = "Смотри и выбирай того, кого просим.";
    isAdvancing.value = false;
    scheduleLayoutUpdate();
    playPrompt(180);
  }, 1900);
}

function restart() {
  window.clearTimeout(nextRoundTimer);
  window.clearTimeout(promptTimer);
  window.clearTimeout(responseTtsTimer);
  rounds.value = createRounds();
  pageIndex.value = 0;
  isAdvancing.value = false;
  lastMistakeObjectId.value = undefined;
  mistakenObjectIdsForCurrentTarget.clear();
  resetHideAndSeekAudioSession();
  feedbackMessage.value = "Смотри и выбирай того, кого просим.";
  startSession();
  playPrompt(220);
}

onMounted(() => {
  resetHideAndSeekAudioSession();
  warmHideAndSeekAudio(session.settings.sound);
  warmTtsAssets(session.settings.sound, hideAndSeekTtsAssets);
  window.addEventListener("resize", scheduleLayoutUpdate);
  scheduleLayoutUpdate();
  playPrompt(450);
});

onUnmounted(() => {
  window.clearTimeout(nextRoundTimer);
  window.clearTimeout(promptTimer);
  window.clearTimeout(responseTtsTimer);
  window.removeEventListener("resize", scheduleLayoutUpdate);
  window.cancelAnimationFrame(layoutFrame);
  disposeHideAndSeekAudio();
  disposeTtsAssets(hideAndSeekTtsAssets);
});
</script>

<template>
  <div ref="shellRef" class="seek-shell">
    <GameHud title="Прятки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <div class="scene">
      <v-card ref="promptRef" class="prompt pa-7 pa-md-8 text-center" rounded="xl" elevation="10">
        <div class="text-overline text-secondary mb-2">Найди</div>
        <GameWordImage v-if="currentObject" class="prompt-sample mb-3" :word-id="currentObject.id" :word="currentObject.name" :emoji="currentObject.emoji" />
        <div class="text-h3 font-weight-bold">{{ currentObject ? currentObject.name : 'всех друзей' }}</div>
        <div class="text-body-1 text-medium-emphasis mt-2">{{ feedbackMessage }}</div>
      </v-card>
      <GameDwellButton
        v-for="object in currentRound?.choices.filter((choice) => !choice.hidden) ?? []"
        :key="`${currentRound?.id}:${object.id}`"
        class="hidden-target"
        :color="objectColor(object)"
        :target-id="objectTargetId(object)"
        :disabled="session.status !== 'running' || object.hidden || isAdvancing"
        :dwell-ms="session.settings.dwellMs"
        :hit-padding="objectHitPadding()"
        :min-height="objectHeight()"
        :style="objectStyle(object)"
        @select="chooseObject(object)"
      >
        <template #default>
          <GameWordImage class="object-emoji" :word-id="object.id" :word="object.name" :emoji="object.emoji" />
        </template>
      </GameDwellButton>
    </div>
    <GameResultDialog :model-value="resultVisible" title="Прятки" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.seek-shell {
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
}

.scene {
  background: linear-gradient(135deg, #ffefd6 0%, #dff5ff 45%, #f6e5ff 100%);
  block-size: 100%;
  inline-size: 100%;
  position: relative;
}

.prompt {
  inline-size: min(444px, calc(100vw - 64px));
  left: 32px;
  position: absolute;
  top: 118px;
  z-index: 3;
}

.prompt-sample {
  font-size: clamp(5rem, 12vw, 8rem);
  line-height: 1;
}

.hidden-target {
  position: absolute;
  transform: translate(-50%, -50%);
}

.object-emoji {
  font-size: clamp(4rem, 8vw, 6rem);
  line-height: 1;
}

@media (max-height: 700px) {
 .prompt {
    inline-size: min(480px, calc(100vw - 32px));
    left: 50%;
    max-inline-size: min(480px, calc(100vw - 32px));
    padding: 0.75rem 1rem !important;
    top: 124px;
    transform: translateX(-50%);
  }

 .prompt-sample {
    display: none;
  }

 .prompt .text-overline,
 .prompt .text-body-1 {
    display: none;
  }

 .prompt .text-h3 {
    font-size: 1.35rem !important;
    line-height: 1.15;
  }
}
</style>
