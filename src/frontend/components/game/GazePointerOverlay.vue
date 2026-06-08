<script setup lang="ts">
import { computed } from "vue";
import { useGazePointer } from "../../composables/useGazePointer";

const { pointer } = useGazePointer();

const markerStyle = computed(() => ({
  left: `${pointer.value.x}px`,
  top: `${pointer.value.y}px`
}));
</script>

<template>
  <div
    v-if="pointer.valid"
    class="gaze-pointer"
    :class="`is-${pointer.source}`"
    :style="markerStyle"
    aria-hidden="true"
  />
</template>

<style scoped>
.gaze-pointer {
  block-size: 22px;
  border: 3px solid rgb(255 255 255 / 82%);
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgb(108 92 231 / 22%), 0 6px 18px rgb(20 20 40 / 22%);
  inline-size: 22px;
  pointer-events: none;
  position: fixed;
  transform: translate(-50%, -50%);
  z-index: 1000;
}

.gaze-pointer.is-tobii {
  background: #6c5ce7;
}

.gaze-pointer.is-mouse {
  background: #ff8a3d;
}
</style>
