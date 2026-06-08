<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSession } from "../../core/session";

type HiddenObject = { id: string; emoji: string; name: string; x: number; y: number; found: boolean };

const objects = reactive<HiddenObject[]>([
  { id: "cat", emoji: "🐱", name: "кота", x: 18, y: 58, found: false },
  { id: "star", emoji: "⭐", name: "звезду", x: 76, y: 34, found: false },
  { id: "flower", emoji: "🌸", name: "цветок", x: 52, y: 72, found: false },
  { id: "duck", emoji: "🦆", name: "утку", x: 32, y: 30, found: false },
  { id: "ball", emoji: "⚽", name: "мяч", x: 68, y: 62, found: false }
]);

const router = useRouter();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("hide-and-seek", {
  maxSteps: objects.length,
  dwellMs: 1200,
  sessionSeconds: 120
});

const resultVisible = computed(() => session.status === "finished");
const currentObject = computed(() => objects.find((object) => !object.found));

function findObject(object: HiddenObject) {
  if (session.status !== "running" || object.found || object.id !== currentObject.value?.id) return;
  object.found = true;
  recordSuccess({ targetId: object.id });
}

function restart() {
  objects.forEach((object) => { object.found = false; });
  startSession();
}
</script>

<template>
  <div class="seek-shell">
    <GameHud title="Прятки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <div class="scene">
      <v-card class="prompt pa-5" rounded="xl" elevation="8">
        <div class="text-overline text-secondary">Найди</div>
        <div class="text-h4 font-weight-bold">{{ currentObject ? currentObject.name : 'всех друзей' }}</div>
      </v-card>
      <GameDwellButton
        v-for="object in objects"
        :key="object.id"
        class="hidden-target"
        color="transparent"
        :disabled="session.status !== 'running' || object.found || object.id !== currentObject?.id"
        :dwell-ms="session.settings.dwellMs"
        :min-height="150"
        :style="{ left: `${object.x}%`, top: `${object.y}%`, inlineSize: '160px', opacity: object.found ? 1 : object.id === currentObject?.id ? 0.9 : 0.28 }"
        @select="findObject(object)"
      >
        <template #default>
          <div class="object-emoji">{{ object.emoji }}</div>
        </template>
      </GameDwellButton>
    </div>
    <GameResultDialog :model-value="resultVisible" title="Прятки" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
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
  position: absolute;
  top: 118px;
  z-index: 3;
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
