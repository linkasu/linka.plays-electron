<script setup lang="ts" generic="T extends { id: string }">
import { computed } from "vue";
import GameDwellButton from "./GameDwellButton.vue";

const props = withDefaults(defineProps<{
  choices: T[];
  disabled?: boolean;
  dwellMs?: number;
  targetId: (choice: T) => string;
  highlightChoice?: (choice: T) => boolean;
  mistakeChoice?: (choice: T) => boolean;
  minHeight?: number | string;
  color?: (choice: T) => string | undefined;
}>(), {
  disabled: false,
  dwellMs: 1300
});

const emit = defineEmits<{
  select: [choice: T];
}>();

const totalCols = 12;

const breakpoints = computed(() => {
  const count = props.choices.length;
  if (count <= 2) {
    return { cols: 6, sm: 6, md: 5, lg: 5 };
  }
  if (count === 3) {
    return { cols: 4, sm: 4, md: 4, lg: 4 };
  }
  if (count === 4) {
    return { cols: 6, sm: 6, md: 3, lg: 3 };
  }
  if (count === 5) {
    return { cols: 4, sm: 4, md: 3, lg: Math.floor(totalCols / 5) || 2 };
  }
  return { cols: 4, sm: 4, md: 3, lg: 3 };
});

const computedMinHeight = computed(() => {
  if (props.minHeight !== undefined) return props.minHeight;
  const count = props.choices.length;
  if (count <= 3) return "clamp(180px, 28vh, 300px)";
  return "clamp(168px, 25vh, 260px)";
});

function choiceColor(choice: T) {
  return props.color?.(choice) ?? (props.highlightChoice?.(choice) ? "primary" : "surface");
}
</script>

<template>
  <v-row class="game-choice-grid" justify="center" dense>
    <v-col
      v-for="choice in choices"
      :key="choice.id"
      :cols="breakpoints.cols"
      :sm="breakpoints.sm"
      :md="breakpoints.md"
      :lg="breakpoints.lg"
    >
      <GameDwellButton
        :class="{ 'game-choice-grid__cell--hinted': highlightChoice?.(choice), 'game-choice-grid__cell--mistake': mistakeChoice?.(choice) }"
        :target-id="targetId(choice)"
        :disabled="disabled"
        :dwell-ms="dwellMs"
        :min-height="computedMinHeight"
        :color="choiceColor(choice)"
        @select="emit('select', choice)"
      >
        <template #default="dwellSlot">
          <slot
            :choice="choice"
            :active="dwellSlot.active"
            :progress="dwellSlot.progress"
            :hinted="highlightChoice?.(choice) ?? false"
            :mistake="mistakeChoice?.(choice) ?? false"
          />
        </template>
      </GameDwellButton>
    </v-col>
  </v-row>
</template>

<style scoped>
.game-choice-grid {
  row-gap: 0.75rem;
}

.game-choice-grid__cell--hinted {
  filter: drop-shadow(0 0 1.15rem rgb(var(--v-theme-primary) / 38%));
  transform: scale(1.03);
}

.game-choice-grid__cell--mistake :deep(.dwell-button) {
  filter: saturate(0.75) opacity(0.78);
}
</style>
