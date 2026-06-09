<script setup lang="ts">
defineProps<{
  label: string;
  emoji?: string;
  subtitle?: string;
  progress?: number;
  active?: boolean;
}>();
</script>

<template>
  <v-card :color="active ? 'primary' : 'surface'" rounded="xl" variant="elevated" class="answer-card pa-5 text-center">
    <div v-if="emoji" class="answer-emoji emoji-glyph mb-2">{{ emoji }}</div>
    <div class="text-h5 font-weight-bold">{{ label }}</div>
    <div v-if="subtitle" class="text-body-1 text-medium-emphasis mt-1">{{ subtitle }}</div>
    <v-progress-linear class="mt-4" :model-value="(progress ?? 0) * 100" color="secondary" height="8" rounded />
  </v-card>
</template>

<style scoped>
.answer-card {
  min-block-size: 180px;
}

.answer-emoji {
  font-size: clamp(3rem, 8vw, 5rem);
  line-height: 1;
}
</style>
