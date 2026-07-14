<script setup lang="ts">
import { ref, watch } from "vue";
import { wordImageSrc } from "../../core/wordImage";

const props = withDefaults(defineProps<{
  wordId: string;
  word: string;
  emoji: string;
  decorative?: boolean;
}>(), {
  decorative: false
});

const failed = ref(false);

watch(() => props.wordId, () => {
  failed.value = false;
});
</script>

<template>
  <span class="game-word-image" :aria-hidden="decorative || undefined">
    <img
      v-if="!failed"
      class="game-word-image__asset"
      :src="wordImageSrc(wordId)"
      :alt="decorative ? '' : word"
      draggable="false"
      @error="failed = true"
    >
    <span v-else class="game-word-image__fallback emoji-glyph" :aria-label="decorative ? undefined : word">{{ emoji }}</span>
  </span>
</template>

<style scoped>
.game-word-image {
  align-items: center;
  display: inline-flex;
  font-size: inherit;
  justify-content: center;
  line-height: 1;
}

.game-word-image__asset,
.game-word-image__fallback {
  block-size: 1em;
  inline-size: 1em;
}

.game-word-image__asset {
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
</style>
