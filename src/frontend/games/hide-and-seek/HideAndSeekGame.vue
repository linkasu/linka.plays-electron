<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useGameTimers } from "../../composables/useGameTimers";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssets from "../../data/ttsAssets.json";
import { disposeHideAndSeekAudio, playHideAndSeekMistakeMelody, playHideAndSeekSuccessMelody, resetHideAndSeekAudioSession, warmHideAndSeekAudio } from "./audio";
import { createHideAndSeekLayout, hideAndSeekFallbackObstacles, hideObjectBehindCover, type HideAndSeekCover, type HideAndSeekRect, type HideAndSeekSpot } from "./model";

type SeekPicture = { id: string; emoji: string; name: string };
type SeekRound = { id: string; target: SeekPicture; spots: HideAndSeekSpot<SeekPicture>[] };
type ElementComponent = { $el?: HTMLElement };

const totalRounds = 10;
const coversPerRound = 5;
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
const coverPool: HideAndSeekCover[] = [
  { id: "bush", emoji: "🌿", label: "куст" },
  { id: "rock", emoji: "🪨", label: "камень" },
  { id: "box", emoji: "📦", label: "коробка" },
  { id: "tree", emoji: "🌲", label: "ёлка" },
  { id: "umbrella", emoji: "☂️", label: "зонтик" }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("hide-and-seek", {
  maxSteps: totalRounds,
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const hideAndSeekTtsAssets = (ttsAssets as TtsAsset[]).filter((asset) => asset.game === "hide-and-seek");
const rounds = ref<SeekRound[]>(createRounds());
const pageIndex = ref(0);
const isAdvancing = ref(false);
const resultVisible = computed(() => session.status === "finished");
const currentRound = computed(() => rounds.value[pageIndex.value]);
const currentObject = computed(() => currentRound.value?.target);
const feedbackMessage = ref("Посмотри, кто выглядывает из-за укрытия.");
const lastMistakeSpotId = ref<string>();
const shellRef = ref<HTMLElement>();
const promptRef = ref<ElementComponent>();
const viewportSize = ref({ width: window.innerWidth, height: window.innerHeight });
const obstacleBounds = ref<HideAndSeekRect[]>(hideAndSeekFallbackObstacles(window.innerWidth, window.innerHeight));
const sceneLayout = computed(() => createHideAndSeekLayout({
  viewportWidth: viewportSize.value.width,
  viewportHeight: viewportSize.value.height,
  targetScale: session.settings.targetScale,
  targetCount: coversPerRound,
  obstacles: obstacleBounds.value
}));
const { setGameTimeout, clearGameTimers } = useGameTimers();
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
  return {
    id: `hide-and-seek-round-${roundIndex}-${Date.now()}`,
    target,
    spots: hideObjectBehindCover(shuffled(coverPool), target)
  };
}

function createRounds() {
  return shuffled(picturePool).slice(0, totalRounds).map((target, index) => createRound(index, target));
}

function ttsAsset(id: string) {
  return hideAndSeekTtsAssets.find((asset) => asset.id === id);
}

function playPrompt(delayMs = 0) {
  setGameTimeout(() => {
    const object = currentObject.value;
    if (!object) return;
    playTtsAsset(session.settings.sound, ttsAsset(`hide-and-seek.prompt.${object.id}`), 0.36);
  }, delayMs);
}

function playResponseTts(id: string, delayMs = 920) {
  setGameTimeout(() => {
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

function spotTargetId(spot: HideAndSeekSpot<SeekPicture>) {
  return `hide-and-seek:${currentRound.value?.id ?? "round"}:cover:${spot.id}`;
}

function spotStyle(spot: HideAndSeekSpot<SeekPicture>) {
  const point = sceneLayout.value.placements[spot.placementIndex];
  const isLastMistake = spot.id === lastMistakeSpotId.value;

  return {
    left: `${point.x}px`,
    top: `${point.y}px`,
    inlineSize: `${objectWidth()}px`,
    opacity: spot.opened && !spot.hiddenObject ? 0.52 : isLastMistake ? 0.76 : 1
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

function spotColor(spot: HideAndSeekSpot<SeekPicture>) {
  if (spot.opened && spot.hiddenObject) return "success";
  return spot.id === lastMistakeSpotId.value ? "warning" : "surface";
}

function chooseSpot(spot: HideAndSeekSpot<SeekPicture>) {
  if (session.status !== "running" || spot.opened || !currentObject.value || isAdvancing.value) return;

  const expectedObject = currentObject.value;
  spot.opened = true;
  if (!spot.hiddenObject) {
    lastMistakeSpotId.value = spot.id;
    feedbackMessage.value = `За укрытием пусто. Поищи ${expectedObject.name} в другом месте.`;
    void playHideAndSeekMistakeMelody(session.settings.sound);
    playResponseTts("hide-and-seek.mistake");
    recordMistake({ targetId: spotTargetId(spot), expectedTargetId: expectedObject.id, coverId: spot.id, actual: "empty", expected: expectedObject.name, isCorrect: false });
    return;
  }

  lastMistakeSpotId.value = undefined;
  feedbackMessage.value = session.step + 1 >= session.maxSteps ? "Всех нашли!" : `Нашли ${expectedObject.name}! Сейчас новая сцена.`;
  recordSuccess({ targetId: spotTargetId(spot), answerId: expectedObject.id, coverId: spot.id, expected: expectedObject.name, actual: expectedObject.name, isCorrect: true });
  void playHideAndSeekSuccessMelody(session.settings.sound);
  playResponseTts("hide-and-seek.correct");
  isAdvancing.value = true;
  setGameTimeout(() => {
    if (session.status !== "running") return;
    if (session.step >= session.maxSteps) {
      finishSession("max-steps");
      return;
    }
    pageIndex.value = Math.min(pageIndex.value + 1, rounds.value.length - 1);
    lastMistakeSpotId.value = undefined;
    feedbackMessage.value = "Открывай укрытия и найди спрятавшегося друга.";
    isAdvancing.value = false;
    scheduleLayoutUpdate();
    playPrompt(180);
  }, 1900);
}

function restart() {
  clearGameTimers();
  rounds.value = createRounds();
  pageIndex.value = 0;
  isAdvancing.value = false;
  lastMistakeSpotId.value = undefined;
  resetHideAndSeekAudioSession();
  feedbackMessage.value = "Открывай укрытия и найди спрятавшегося друга.";
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
  clearGameTimers();
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
        <div class="text-overline text-secondary mb-2">Кто спрятался?</div>
        <GameWordImage v-if="currentObject" class="prompt-sample mb-3" :word-id="currentObject.id" :word="currentObject.name" :emoji="currentObject.emoji" />
        <div class="text-h3 font-weight-bold">{{ currentObject ? currentObject.name : 'всех друзей' }}</div>
        <div class="text-body-1 text-medium-emphasis mt-2">{{ feedbackMessage }}</div>
      </v-card>
      <GameDwellButton
        v-for="spot in currentRound?.spots ?? []"
        :key="`${currentRound?.id}:${spot.id}`"
        class="hide-spot"
        :color="spotColor(spot)"
        :target-id="spotTargetId(spot)"
        :disabled="session.status !== 'running' || spot.opened || isAdvancing"
        :dwell-ms="session.settings.dwellMs"
        :hit-padding="objectHitPadding()"
        :min-height="objectHeight()"
        :style="spotStyle(spot)"
        @select="chooseSpot(spot)"
      >
        <template #default>
          <div class="spot-content">
            <div v-if="spot.hiddenObject && !spot.opened" class="peek-window">
              <GameWordImage class="peek-object" :word-id="spot.hiddenObject.id" :word="spot.hiddenObject.name" :emoji="spot.hiddenObject.emoji" decorative />
            </div>
            <GameWordImage v-if="spot.opened && spot.hiddenObject" class="found-object" :word-id="spot.hiddenObject.id" :word="spot.hiddenObject.name" :emoji="spot.hiddenObject.emoji" />
            <div v-else-if="spot.opened" class="empty-spot" aria-hidden="true">✨</div>
            <div v-else class="cover-emoji" aria-hidden="true">{{ spot.emoji }}</div>
          </div>
          <div class="text-h6 font-weight-bold">{{ spot.opened ? (spot.hiddenObject ? spot.hiddenObject.name : 'пусто') : spot.label }}</div>
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
  inline-size: min(27.75rem, calc(100vw - 4rem));
  left: 2rem;
  position: absolute;
  top: 7.375rem;
  z-index: 3;
}

.prompt-sample {
  font-size: clamp(5rem, 12vw, 8rem);
  line-height: 1;
}

.hide-spot {
  position: absolute;
  transform: translate(-50%, -50%);
}

.spot-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-block-size: 7rem;
  position: relative;
}

.cover-emoji,
.empty-spot,
.found-object,
.peek-object {
  font-size: clamp(3.5rem, 7vw, 5.5rem);
  line-height: 1;
}

.peek-window {
  block-size: 2.4rem;
  inset-block-start: -0.8rem;
  overflow: hidden;
  position: absolute;
}

.peek-object {
  transform: translateY(0.45rem);
}

.cover-emoji {
  position: relative;
  z-index: 1;
}

@media (max-height: 43.75rem) {
 .prompt {
    inline-size: min(30rem, calc(100vw - 2rem));
    left: 50%;
    max-inline-size: min(30rem, calc(100vw - 2rem));
    padding: 0.75rem 1rem !important;
    top: 7.75rem;
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
