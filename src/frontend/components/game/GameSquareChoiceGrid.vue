<script setup lang="ts">
import { computed } from "vue";
import GameDwellButton from "./GameDwellButton.vue";

export type GameSquareChoice = string | number;

const props = withDefaults(defineProps<{
  items: GameSquareChoice[];
  disabled?: boolean;
  dwellMs?: number;
  columns?: number;
  gridOffset?: string;
  minSize?: string;
  maxSize?: string;
  compactSize?: string;
  widthFactor?: string;
  targetId: (choice: GameSquareChoice) => string;
}>(), {
  disabled: false,
  dwellMs: 1000,
  gridOffset: "17.75rem",
  minSize: "9.375rem",
  maxSize: "15.625rem",
  compactSize: "9.75rem",
  widthFactor: "20vw"
});

const emit = defineEmits<{
  select: [choice: GameSquareChoice];
}>();

const rows = computed(() => {
  if (props.columns && props.columns > 0) {
    const nextRows: GameSquareChoice[][] = [];
    for (let index = 0; index < props.items.length; index += props.columns) {
      nextRows.push(props.items.slice(index, index + props.columns));
    }
    return nextRows;
  }

  const splitAt = Math.ceil(props.items.length / 2);
  return [props.items.slice(0, splitAt), props.items.slice(splitAt)].filter((row) => row.length > 0);
});

const gridStyle = computed(() => ({
  "--choice-grid-min-size": props.minSize,
  "--choice-grid-max-size": props.maxSize,
  "--choice-grid-compact-size": props.compactSize,
  "--choice-grid-offset": props.gridOffset,
  "--choice-grid-width-factor": props.widthFactor,
  "--choice-grid-height-size": `calc((100vh - ${props.gridOffset} - ${(rows.value.length - 1) * 0.625}rem) / ${rows.value.length})`
}));
</script>

<template>
  <div class="square-choice-grid" :style="gridStyle">
    <div v-for="(row, rowIndex) in rows" :key="rowIndex" :class="['square-choice-row', row.length <= 3 ? 'square-choice-row--short' : 'square-choice-row--wide']" :style="{ '--choice-count': row.length.toString() }">
      <GameDwellButton v-for="choice in row" :key="choice" class="square-choice-key" :target-id="targetId(choice)" :disabled="disabled" :dwell-ms="dwellMs" min-height="0" @select="emit('select', choice)">
        <template #default>
          <slot :choice="choice">
            <div class="text-h2 font-weight-bold">{{ choice }}</div>
          </slot>
        </template>
      </GameDwellButton>
    </div>
  </div>
</template>

<style scoped>
.square-choice-grid {
  display: grid;
  gap: 0.625rem;
  justify-content: center;
  inline-size: 100%;
}

.square-choice-row {
  --choice-size: clamp(var(--choice-grid-min-size), min(var(--choice-grid-width-factor), var(--choice-grid-height-size)), var(--choice-grid-max-size));

  display: grid;
  gap: 0.625rem;
  grid-template-columns: repeat(var(--choice-count), var(--choice-size));
  justify-content: center;
}

.square-choice-key {
  aspect-ratio: 1;
}

.square-choice-key :deep(.dwell-hitbox) {
  block-size: 100%;
}

@media (max-height: 40rem) {
  .square-choice-row {
    --choice-size: var(--choice-grid-compact-size);
  }
}
</style>
