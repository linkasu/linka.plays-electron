<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSession } from "../../core/session";

type Duck = { id: string; x: number; y: number; label: string };

const router = useRouter();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("ducks", {
  maxSteps: 8,
  dwellMs: 1100,
  sessionSeconds: 90
});

const ducks = reactive<Duck[]>([]);
const resultVisible = computed(() => session.status === "finished");

function spawnDucks() {
  const count = session.settings.preset === "gentle" ? 1 : 3;
  ducks.splice(0, ducks.length);
  for (let index = 0; index < count; index++) {
    ducks.push({
      id: `duck-${Date.now()}-${index}`,
      x: 16 + Math.random() * 68,
      y: 34 + Math.random() * 48,
      label: index === 0 ? "Найди утку" : "Утка"
    });
  }
}

function chooseDuck(duck: Duck) {
  if (session.status !== "running") return;
  recordSuccess({ targetId: duck.id });
  if (session.step < session.maxSteps) spawnDucks();
}

function restart() {
  startSession();
  spawnDucks();
}

spawnDucks();
</script>

<template>
  <div class="ducks-shell">
    <GameHud title="Утки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <div class="pond">
      <GameDwellButton
        v-for="duck in ducks"
        :key="duck.id"
        class="duck-target"
        color="transparent"
        :disabled="session.status !== 'running'"
        :dwell-ms="session.settings.dwellMs"
        :min-height="150 * session.settings.targetScale"
        :style="{ left: `${duck.x}%`, top: `${duck.y}%`, inlineSize: `${170 * session.settings.targetScale}px` }"
        @select="chooseDuck(duck)"
      >
        <template #default>
          <div class="duck">🦆</div>
          <div class="text-body-2 font-weight-bold">{{ duck.label }}</div>
        </template>
      </GameDwellButton>
    </div>
    <GameResultDialog :model-value="resultVisible" title="Утки" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.ducks-shell {
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
}

.pond {
  background: linear-gradient(180deg, #ddfbff 0%, #b9eaff 56%, #9ddbe8 100%);
  block-size: 100%;
  inline-size: 100%;
  position: relative;
}

.duck-target {
  border-radius: 999px;
  position: absolute;
  transform: translate(-50%, -50%);
}

.duck {
  filter: drop-shadow(0 12px 16px rgb(34 98 120 / 20%));
  font-size: clamp(4rem, 9vw, 7rem);
  line-height: 1;
}
</style>
