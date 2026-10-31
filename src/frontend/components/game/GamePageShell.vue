<script setup lang="ts">
import { computed } from "vue";

import type { SceneKind } from "../../themes";
type GradientPreset = "warm" | "cool" | "violet" | "forest" | "sunset" | "night" | "neutral";

const props = withDefaults(
  defineProps<{
    gradient?: GradientPreset | string;
    paddingTop?: string;
    fullHeight?: boolean;
  }>(),
  {
    gradient: "warm",
    paddingTop: "8.75rem",
    fullHeight: false,
  },
);

const gradientPresets: Record<GradientPreset, SceneKind> = {
  warm: "paper",
  cool: "sky",
  violet: "paper",
  forest: "meadow",
  sunset: "autumn",
  night: "night",
  neutral: "paper",
};

const backgroundValue = computed(() => {
  const value = props.gradient;
  const scene = value in gradientPresets ? gradientPresets[value as GradientPreset] : value;
  return `var(--linka-scene-${scene || "paper"})`;
});

const shellStyle = computed(() => ({
  "--page-shell-bg": backgroundValue.value,
  "--page-shell-padding-top": props.paddingTop,
}));
</script>

<template>
  <div :class="['game-page-shell', { 'game-page-shell--full': fullHeight }]" :style="shellStyle">
    <slot name="hud" />
    <div class="game-page-shell__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.game-page-shell {
  background: var(--page-shell-bg);
  min-block-size: 100vh;
  min-block-size: 100dvh;
}

.game-page-shell--full {
  block-size: 100vh;
  block-size: 100dvh;
  overflow: hidden;
}

.game-page-shell__content {
  padding-block-start: var(--page-shell-padding-top);
}

@media (max-height: 42rem) {
  .game-page-shell__content {
    padding-block-start: calc(var(--page-shell-padding-top) - 1.25rem);
  }
}
</style>
