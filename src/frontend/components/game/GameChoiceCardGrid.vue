<script setup lang="ts" generic="T extends { id: string }">
import { computed } from "vue";
import { DEFAULT_DWELL_MS } from "../../core/dwellSettings";
import GameDwellButton from "./GameDwellButton.vue";

const props = withDefaults(
  defineProps<{
    choices: T[];
    disabled?: boolean;
    dwellMs?: number;
    targetId: (choice: T) => string;
    highlightChoice?: (choice: T) => boolean;
    mistakeChoice?: (choice: T) => boolean;
    minHeight?: number | string;
    color?: (choice: T) => string | undefined;
    cols?: number;
    sm?: number;
    md?: number;
    lg?: number;
  }>(),
  {
    disabled: false,
    dwellMs: DEFAULT_DWELL_MS,
  },
);

const emit = defineEmits<{
  select: [choice: T];
}>();

const totalCols = 12;

const breakpoints = computed(() => {
  const count = props.choices.length;
  let fallback: { cols: number; sm: number; md: number; lg: number };
  if (count <= 2) {
    fallback = { cols: 6, sm: 6, md: 5, lg: 5 };
  } else if (count === 3) {
    fallback = { cols: 4, sm: 4, md: 4, lg: 4 };
  } else if (count === 4) {
    fallback = { cols: 6, sm: 6, md: 3, lg: 3 };
  } else if (count === 5) {
    fallback = { cols: 4, sm: 4, md: 3, lg: Math.floor(totalCols / 5) || 2 };
  } else {
    fallback = { cols: 4, sm: 4, md: 3, lg: 3 };
  }

  return {
    cols: props.cols ?? fallback.cols,
    sm: props.sm ?? fallback.sm,
    md: props.md ?? fallback.md,
    lg: props.lg ?? fallback.lg,
  };
});

// Testers: «сделать карточки для ответа крупнее». The cards take most of the
// height left under the task, so a gaze lands on them without aiming.
const computedMinHeight = computed(() => {
  if (props.minHeight !== undefined) return props.minHeight;
  const count = props.choices.length;
  if (count <= 3) return "clamp(11.25rem, 36dvh, 28rem)";
  if (count === 4) return "clamp(10.5rem, 36dvh, 26rem)";
  return "clamp(9.5rem, 27dvh, 22rem)";
});

function choiceColor(choice: T) {
  return props.color?.(choice) ?? (props.highlightChoice?.(choice) ? "primary" : "surface");
}
</script>

<template>
  <v-row
    :class="['game-choice-grid', { 'game-choice-grid--five': choices.length === 5 }]"
    justify="center"
    no-gutters
  >
    <v-col
      v-for="choice in choices"
      :key="choice.id"
      :cols="breakpoints.cols"
      :sm="breakpoints.sm"
      :md="breakpoints.md"
      :lg="breakpoints.lg"
    >
      <GameDwellButton
        :class="{
          'game-choice-grid__cell--hinted': highlightChoice?.(choice),
          'game-choice-grid__cell--mistake': mistakeChoice?.(choice),
        }"
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
/* Gap between neighbouring gaze targets. Eye-tracking noise makes a gaze dot
   drift into the next card when cards sit a few pixels apart (gaze audit: 8px). */
.v-row.game-choice-grid {
  --choice-gap: clamp(2rem, 3vw, 3.5rem);

  row-gap: var(--choice-gap);
  margin-inline: calc(var(--choice-gap) / -2);
}

.v-row.game-choice-grid > [class*="v-col"] {
  padding-inline: calc(var(--choice-gap) / 2);
}

/* Five cards share one row equally: a twelve-column grid gives each only a sixth
   of the row, and pictures did not fit (testers: «животные не помещаются»). */
@media (min-width: 60rem) {
  .v-row.game-choice-grid--five > [class*="v-col"] {
    flex: 0 0 20%;
    max-inline-size: 20%;
  }
}

.game-choice-grid__cell--hinted {
  filter: drop-shadow(0 0 1.15rem rgb(var(--v-theme-primary) / 38%));
  transform: scale(1.03);
}

.game-choice-grid__cell--mistake :deep(.dwell-button) {
  filter: saturate(0.75) opacity(0.78);
}
</style>
