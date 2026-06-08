<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSession } from "../../core/session";

type Bubble = { id: string; x: number; y: number; size: number; hue: number };

const router = useRouter();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("bubbles", {
  maxSteps: 8,
  dwellMs: 1200,
  sessionSeconds: 90
});

const bubbles = reactive<Bubble[]>([]);
const resultVisible = computed(() => session.status === "finished");

function createBubble(index = 0): Bubble {
  const size = 116 * session.settings.targetScale;
  return {
    id: `bubble-${Date.now()}-${index}`,
    x: 8 + Math.random() * 76,
    y: 22 + Math.random() * 58,
    size,
    hue: 185 + Math.random() * 55
  };
}

function refillBubbles() {
  bubbles.splice(0, bubbles.length, createBubble());
}

function selectBubble(bubble: Bubble) {
  if (session.status !== "running") return;
  recordSuccess({ targetId: bubble.id });
  if (session.step < session.maxSteps) refillBubbles();
}

function restart() {
  startSession();
  refillBubbles();
}

refillBubbles();
</script>

<template>
  <div class="bubbles-shell">
    <GameHud
      title="Бульк"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <div class="bubbles-water">
      <GameDwellButton
        v-for="bubble in bubbles"
        :key="bubble.id"
        class="bubble-target"
        color="transparent"
        :disabled="session.status !== 'running'"
        :dwell-ms="session.settings.dwellMs"
        :min-height="bubble.size"
        :style="{ left: `${bubble.x}%`, top: `${bubble.y}%`, inlineSize: `${bubble.size}px`, '--bubble-hue': bubble.hue }"
        @select="selectBubble(bubble)"
      >
        <template #default>
          <div class="bubble-visual">○</div>
        </template>
      </GameDwellButton>
    </div>

    <GameResultDialog
      :model-value="resultVisible"
      title="Бульк"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :recommendation="recommendation"
      @menu="router.push('/')"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.bubbles-shell {
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.bubbles-water {
  background: linear-gradient(135deg, #dff8ff 0%, #b8ecff 45%, #e5f7ff 100%);
  block-size: 100%;
  inline-size: 100%;
  position: relative;
}

.bubble-target {
  aspect-ratio: 1;
  border-radius: 999px;
  position: absolute;
  transform: translate(-50%, -50%);
}

.bubble-visual {
  align-items: center;
  background: radial-gradient(circle at 35% 28%, #fff 0 12%, hsl(var(--bubble-hue) 90% 78% / 72%) 34%, hsl(var(--bubble-hue) 86% 54% / 52%) 100%);
  border: 3px solid hsl(var(--bubble-hue) 82% 48% / 58%);
  border-radius: 999px;
  box-shadow: inset 0 8px 20px rgb(255 255 255 / 70%), 0 18px 42px rgb(37 132 180 / 18%);
  color: transparent;
  display: flex;
  font-size: 48px;
  inline-size: 100%;
  justify-content: center;
  min-block-size: 90px;
}
</style>
