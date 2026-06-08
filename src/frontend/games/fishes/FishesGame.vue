<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSession } from "../../core/session";

const router = useRouter();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("fishes", {
  maxSteps: 7,
  dwellMs: 1100,
  sessionSeconds: 90
});

const fish = reactive({ id: "fish", x: 50, y: 52, flip: false });
const resultVisible = computed(() => session.status === "finished");

function moveFish() {
  const nextX = 14 + Math.random() * 72;
  fish.flip = nextX < fish.x;
  fish.x = nextX;
  fish.y = 30 + Math.random() * 50;
  fish.id = `fish-${Date.now()}`;
}

function catchFish() {
  if (session.status !== "running") return;
  recordSuccess({ targetId: fish.id });
  if (session.step < session.maxSteps) moveFish();
}

function restart() {
  startSession();
  moveFish();
}

moveFish();
</script>

<template>
  <div class="fishes-shell">
    <GameHud title="Рыбки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <div class="sea">
      <div class="coral coral-a">🪸</div>
      <div class="coral coral-b">🪸</div>
      <GameDwellButton
        class="fish-target"
        color="transparent"
        :disabled="session.status !== 'running'"
        :dwell-ms="session.settings.dwellMs"
        :min-height="160 * session.settings.targetScale"
        :style="{ left: `${fish.x}%`, top: `${fish.y}%`, inlineSize: `${190 * session.settings.targetScale}px` }"
        @select="catchFish"
      >
        <template #default>
          <div class="fish" :style="{ transform: fish.flip ? 'scaleX(-1)' : 'scaleX(1)' }">🐠</div>
          <div class="text-body-2 font-weight-bold">Посмотри на рыбку</div>
        </template>
      </GameDwellButton>
    </div>
    <GameResultDialog :model-value="resultVisible" title="Рыбки" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.fishes-shell {
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
}

.sea {
  background: linear-gradient(180deg, #c7f7ff 0%, #6dd5ed 58%, #2193b0 100%);
  block-size: 100%;
  inline-size: 100%;
  position: relative;
}

.fish-target {
  border-radius: 999px;
  position: absolute;
  transform: translate(-50%, -50%);
  transition: left 700ms ease, top 700ms ease;
}

.fish {
  filter: drop-shadow(0 14px 18px rgb(0 70 100 / 24%));
  font-size: clamp(4rem, 10vw, 7rem);
  line-height: 1;
}

.coral {
  bottom: 32px;
  font-size: clamp(4rem, 9vw, 8rem);
  opacity: 0.85;
  position: absolute;
}

.coral-a { left: 8%; }
.coral-b { right: 10%; }
</style>
