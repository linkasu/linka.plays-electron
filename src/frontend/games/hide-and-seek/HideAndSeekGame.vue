<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { clampTargetCenterPercent } from "../../core/placement";
import { useGameSession } from "../../core/session";
import { disposeHideAndSeekAudio, playHideAndSeekMistakeMelody, playHideAndSeekSuccessMelody, resetHideAndSeekAudioSession, warmHideAndSeekAudio } from "./audio";

type HiddenObject = { id: string; emoji: string; name: string; x: number; y: number; found: boolean };

const objects = reactive<HiddenObject[]>([
  { id: "cat", emoji: "🐱", name: "кота", x: 18, y: 58, found: false },
  { id: "star", emoji: "⭐", name: "звезду", x: 76, y: 34, found: false },
  { id: "flower", emoji: "🌸", name: "цветок", x: 52, y: 72, found: false },
  { id: "duck", emoji: "🦆", name: "утку", x: 32, y: 30, found: false },
  { id: "ball", emoji: "⚽", name: "мяч", x: 68, y: 62, found: false }
]);

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("hide-and-seek", {
  maxSteps: objects.length,
  dwellMs: 1200,
  sessionSeconds: 120
});

const resultVisible = computed(() => session.status === "finished");
const currentObject = computed(() => objects.find((object) => !object.found));
const feedbackMessage = ref("Смотри спокойно и выбирай того, кого просим.");
const lastMistakeObjectId = ref<string>();
const mistakenObjectIdsForCurrentTarget = new Set<string>();

function objectWidth() {
  return 160 * session.settings.targetScale;
}

function objectHeight() {
  return 150 * session.settings.targetScale;
}

function objectTargetId(object: HiddenObject) {
  return `hide-and-seek:object:${object.id}`;
}

function objectStyle(object: HiddenObject) {
  const point = clampTargetCenterPercent({ x: object.x, y: object.y }, {
    targetWidth: objectWidth(),
    targetHeight: objectHeight()
  });
  const isLastMistake = object.id === lastMistakeObjectId.value;

  return {
    left: `${point.x}%`,
    top: `${point.y}%`,
    inlineSize: `${objectWidth()}px`,
    opacity: object.found ? 1 : isLastMistake ? 0.72 : 0.42
  };
}

function objectColor(object: HiddenObject) {
  return object.id === lastMistakeObjectId.value ? "warning" : "transparent";
}

function chooseObject(object: HiddenObject) {
  if (session.status !== "running" || object.found || !currentObject.value) return;

  const expectedObject = currentObject.value;
  if (object.id !== expectedObject.id) {
    lastMistakeObjectId.value = object.id;
    feedbackMessage.value = `Почти. Попробуем ещё раз: найди ${expectedObject.name}.`;
    if (mistakenObjectIdsForCurrentTarget.has(object.id)) return;

    mistakenObjectIdsForCurrentTarget.add(object.id);
    recordMistake({ targetId: object.id, expectedTargetId: expectedObject.id, actual: object.name, expected: expectedObject.name, isCorrect: false });
    void playHideAndSeekMistakeMelody(session.settings.sound);
    return;
  }

  object.found = true;
  lastMistakeObjectId.value = undefined;
  mistakenObjectIdsForCurrentTarget.clear();
  feedbackMessage.value = currentObject.value ? "Есть! Ищем следующего друга." : "Всех нашли!";
  recordSuccess({ targetId: object.id, answerId: object.id, expected: object.name, actual: object.name, isCorrect: true });
  void playHideAndSeekSuccessMelody(session.settings.sound);
}

function restart() {
  objects.forEach((object) => { object.found = false; });
  lastMistakeObjectId.value = undefined;
  mistakenObjectIdsForCurrentTarget.clear();
  resetHideAndSeekAudioSession();
  feedbackMessage.value = "Смотри спокойно и выбирай того, кого просим.";
  startSession();
}

onMounted(() => {
  resetHideAndSeekAudioSession();
  warmHideAndSeekAudio(session.settings.sound);
});

onUnmounted(() => {
  disposeHideAndSeekAudio();
});
</script>

<template>
  <div class="seek-shell">
    <GameHud title="Прятки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <div class="scene">
      <v-card class="prompt pa-7 pa-md-8 text-center" rounded="xl" elevation="10">
        <div class="text-overline text-secondary mb-2">Найди</div>
        <div v-if="currentObject" class="prompt-sample emoji-glyph mb-3">{{ currentObject.emoji }}</div>
        <div class="text-h3 font-weight-bold">{{ currentObject ? currentObject.name : 'всех друзей' }}</div>
        <div class="text-body-1 text-medium-emphasis mt-2">{{ feedbackMessage }}</div>
      </v-card>
      <GameDwellButton
        v-for="object in objects"
        :key="object.id"
        class="hidden-target"
        :color="objectColor(object)"
        :target-id="objectTargetId(object)"
        :disabled="session.status !== 'running' || object.found"
        :dwell-ms="session.settings.dwellMs"
        :min-height="objectHeight()"
        :style="objectStyle(object)"
        @select="chooseObject(object)"
      >
        <template #default>
          <div class="object-emoji emoji-glyph">{{ object.emoji }}</div>
        </template>
      </GameDwellButton>
    </div>
    <GameResultDialog :model-value="resultVisible" title="Прятки" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
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
  left: 32px;
  min-inline-size: min(360px, calc(100vw - 64px));
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
</style>
