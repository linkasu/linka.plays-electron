<script setup lang="ts">
import { computed } from "vue";

type GradientPreset = "warm" | "cool" | "violet" | "forest" | "sunset" | "night" | "neutral";

const props = withDefaults(defineProps<{
  gradient?: GradientPreset | string;
  paddingTop?: string;
  fullHeight?: boolean;
}>(), {
  gradient: "warm",
  paddingTop: "8.75rem",
  fullHeight: false
});

const gradientPresets: Record<GradientPreset, string> = {
  warm: "linear-gradient(135deg, #fff7ed 0%, #eef8ff 100%)",
  cool: "linear-gradient(135deg, #eef4ff 0%, #f2f7ff 100%)",
  violet: "linear-gradient(135deg, #fff7ed 0%, #eef8ff 52%, #f5f3ff 100%)",
  forest: "linear-gradient(135deg, #fff8ed 0%, #edf7f0 54%, #eef4ff 100%)",
  sunset: "linear-gradient(135deg, #fff1e6 0%, #ffe4ec 100%)",
  night: "linear-gradient(135deg, #1a1c2c 0%, #2c2f4a 100%)",
  neutral: "linear-gradient(135deg, #f6f7fb 0%, #eef2f7 100%)"
};

const backgroundValue = computed(() => {
  const value = props.gradient;
  if (!value) return gradientPresets.warm;
  if (value in gradientPresets) return gradientPresets[value as GradientPreset];
  return value;
});

const shellStyle = computed(() => ({
  "--page-shell-bg": backgroundValue.value,
  "--page-shell-padding-top": props.paddingTop
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
}

.game-page-shell--full {
  block-size: 100vh;
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
