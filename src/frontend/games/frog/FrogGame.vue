<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { randomTargetCenterPercent } from "../../core/placement";
import { useGameSession } from "../../core/session";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("frog", {
  maxSteps: 8,
  dwellMs: 850,
  sessionSeconds: 90
});

const firefly = reactive({ id: "firefly", x: 62, y: 44 });
const resultVisible = computed(() => session.status === "finished");

function fireflyWidth() {
  return 150 * session.settings.targetScale;
}

function fireflyHeight() {
  return 140 * session.settings.targetScale;
}

function moveFirefly() {
  const point = randomTargetCenterPercent({
    targetWidth: fireflyWidth(),
    targetHeight: fireflyHeight(),
    previous: firefly,
    minDistance: 200
  });
  firefly.id = `firefly-${Date.now()}`;
  firefly.x = point.x;
  firefly.y = point.y;
}

function catchFirefly() {
  if (session.status !== "running") return;
  recordSuccess({ targetId: firefly.id });
  if (session.step < session.maxSteps) moveFirefly();
}

function restart() {
  startSession();
  moveFirefly();
}

moveFirefly();
</script>

<template>
  <div class="frog-shell">
    <GameHud title="Жаба" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <div class="meadow">
      <div class="frog">🐸</div>
      <GameDwellButton
        class="firefly-target"
        color="transparent"
        :target-id="firefly.id"
        :disabled="session.status !== 'running'"
        :dwell-ms="session.settings.dwellMs"
        :min-height="fireflyHeight()"
        :style="{ left: `${firefly.x}%`, top: `${firefly.y}%`, inlineSize: `${fireflyWidth()}px` }"
        @select="catchFirefly"
      >
        <template #default>
          <div class="firefly">✨</div>
          <div class="text-body-2 font-weight-bold">Поймай</div>
        </template>
      </GameDwellButton>
    </div>
    <GameResultDialog :model-value="resultVisible" title="Жаба" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.frog-shell {
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
}

.meadow {
  background: radial-gradient(circle at 50% 30%, #36436f 0%, #14213d 48%, #06111f 100%);
  block-size: 100%;
  inline-size: 100%;
  position: relative;
}

.frog {
  bottom: 42px;
  filter: drop-shadow(0 16px 18px rgb(0 0 0 / 32%));
  font-size: clamp(5rem, 12vw, 10rem);
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.firefly-target {
  border-radius: 999px;
  position: absolute;
  transform: translate(-50%, -50%);
  transition: left 600ms ease, top 600ms ease;
}

.firefly {
  filter: drop-shadow(0 0 20px #fff7a8);
  font-size: clamp(3.5rem, 8vw, 6rem);
  line-height: 1;
}
</style>
