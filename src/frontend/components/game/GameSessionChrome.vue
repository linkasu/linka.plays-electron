<script setup lang="ts">
import { useRouter } from "vue-router";
import type { GameSessionState } from "../../core/session";
import { resolveMenuRoute } from "../../core/menuMode";
import GameHud from "./GameHud.vue";
import GamePageShell from "./GamePageShell.vue";
import GameResultDialog from "./GameResultDialog.vue";

type GameResultMetrics = {
  finishReason?: string;
  validGazeRatio?: number;
  meanDwellMs?: number;
  targetCancels?: number;
  gazeLostCount?: number;
  hintsUsed?: number;
};

const props = withDefaults(defineProps<{
  title: string;
  session: GameSessionState;
  resultVisible: boolean;
  durationMs: number;
  recommendation: string;
  metrics?: GameResultMetrics;
  gradient?: string;
  paddingTop?: string;
  fullHeight?: boolean;
  showProgress?: boolean;
  showTimer?: boolean;
}>(), {
  gradient: "warm",
  paddingTop: "8.75rem",
  fullHeight: false,
  showProgress: true,
  showTimer: true
});

const emit = defineEmits<{
  pause: [];
  resume: [];
  restart: [];
}>();

const router = useRouter();

function goToMenu() {
  router.push(resolveMenuRoute());
}
</script>

<template>
  <GamePageShell :gradient="gradient" :padding-top="paddingTop" :full-height="fullHeight">
    <template #hud>
      <GameHud
        :title="title"
        :step="session.step"
        :max-steps="session.maxSteps"
        :score="session.score"
        :mistakes="session.mistakes"
        :duration-ms="durationMs"
        :session-seconds="session.settings.sessionSeconds"
        :paused="session.status === 'paused'"
        :show-progress="showProgress"
        :show-timer="showTimer"
        @pause="emit('pause')"
        @resume="emit('resume')"
      />
      <slot name="hud-extra" />
    </template>

    <slot />

    <GameResultDialog
      :model-value="resultVisible"
      :title="title"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="goToMenu"
      @restart="emit('restart')"
    />
  </GamePageShell>
</template>
