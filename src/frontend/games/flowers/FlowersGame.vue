<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { randomTargetCenterPercent } from "../../core/placement";
import { useGameSession } from "../../core/session";

type Flower = { id: string; x: number; y: number; emoji: string };

const flowerEmojis = ["🌸", "🌼", "🌷", "🌻", "🪻"];
const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("flowers", {
  maxSteps: 6,
  dwellMs: 1400,
  sessionSeconds: 90
});

const grownFlowers = reactive<Flower[]>([]);
const bud = reactive({ id: "bud", x: 50, y: 52 });
const resultVisible = computed(() => session.status === "finished");

function budSize() {
  return 150 * session.settings.targetScale;
}

function moveBud() {
  const point = randomTargetCenterPercent({
    targetWidth: budSize(),
    targetHeight: budSize(),
    previous: bud,
    minDistance: 190
  });
  bud.id = `bud-${Date.now()}`;
  bud.x = point.x;
  bud.y = point.y;
}

function growFlower() {
  if (session.status !== "running") return;
  grownFlowers.push({
    id: `flower-${Date.now()}`,
    x: bud.x,
    y: bud.y,
    emoji: flowerEmojis[Math.floor(Math.random() * flowerEmojis.length)]
  });
  recordSuccess({ targetId: bud.id });
  if (session.step < session.maxSteps) moveBud();
}

function restart() {
  grownFlowers.splice(0);
  startSession();
  moveBud();
}

moveBud();
</script>

<template>
  <div class="flowers-shell">
    <GameHud title="Цветы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <div class="garden">
      <div v-for="flower in grownFlowers" :key="flower.id" class="grown-flower" :style="{ left: `${flower.x}%`, top: `${flower.y}%` }">
        {{ flower.emoji }}
      </div>

      <GameDwellButton
        class="bud-target"
        color="transparent"
        :target-id="bud.id"
        :disabled="session.status !== 'running'"
        :dwell-ms="session.settings.dwellMs"
        :min-height="budSize()"
        :style="{ left: `${bud.x}%`, top: `${bud.y}%`, inlineSize: `${budSize()}px` }"
        @select="growFlower"
      >
        <template #default="{ progress }">
          <div class="bud" :style="{ transform: `scale(${0.75 + progress * 0.45})` }">🌱</div>
        </template>
      </GameDwellButton>
    </div>

    <GameResultDialog :model-value="resultVisible" title="Цветы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.flowers-shell {
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
}

.garden {
  background: linear-gradient(180deg, #dffce4 0%, #fff9df 48%, #b8ecb5 100%);
  block-size: 100%;
  inline-size: 100%;
  position: relative;
}

.bud-target,
.grown-flower {
  position: absolute;
  transform: translate(-50%, -50%);
}

.bud {
  font-size: clamp(4rem, 9vw, 7rem);
  line-height: 1;
  transition: transform 120ms ease;
}

.grown-flower {
  filter: drop-shadow(0 10px 18px rgb(61 112 48 / 18%));
  font-size: clamp(3rem, 7vw, 5.5rem);
}
</style>
