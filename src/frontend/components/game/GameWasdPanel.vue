<script lang="ts">
export type GameWasdKey = "w" | "a" | "s" | "d";

export type GameWasdControl = {
  id: string;
  key: GameWasdKey;
  label: string;
  icon: string;
  targetId: string;
  disabled?: boolean;
  color?: string;
  chipText?: string;
  chipColor?: string;
};
</script>

<script setup lang="ts">
import { DEFAULT_DWELL_MS } from "../../core/dwellSettings";
import GameDwellButton from "./GameDwellButton.vue";

withDefaults(defineProps<{
  controls: GameWasdControl[];
  dwellMs?: number;
  disabled?: boolean;
  minHeight?: number | string;
  ariaLabel?: string;
  showKeyCaps?: boolean;
}>(), {
  dwellMs: DEFAULT_DWELL_MS,
  disabled: false,
  minHeight: "0",
  ariaLabel: "Кнопки управления WASD",
  showKeyCaps: true
});

const emit = defineEmits<{
  select: [control: GameWasdControl];
}>();
</script>

<template>
  <div class="wasd-panel" :aria-label="ariaLabel" role="group">
    <div v-for="control in controls" :key="control.id" :class="`wasd-panel__key wasd-panel__key--${control.key}`">
      <GameDwellButton :target-id="control.targetId" :disabled="disabled || control.disabled" :dwell-ms="dwellMs" :min-height="minHeight" :color="control.color ?? 'surface'" @select="emit('select', control)">
        <template #default="{ active, progress }">
          <slot name="control" :control="control" :active="active" :progress="progress">
            <div class="wasd-panel__content">
              <span v-if="showKeyCaps" class="wasd-panel__cap" style="color: #000000">{{ control.key.toUpperCase() }}</span>
              <v-icon :icon="control.icon" class="wasd-panel__icon" size="44" style="color: #000000" />
              <span style="color: #000000">{{ control.label }}</span>
              <v-chip v-if="control.chipText" :color="control.chipColor ?? 'primary'" size="small" variant="flat">{{ control.chipText }}</v-chip>
            </div>
          </slot>
        </template>
      </GameDwellButton>
    </div>
  </div>
</template>

<style scoped>
.wasd-panel {
  aspect-ratio: 3 / 2;
  display: grid;
  gap: clamp(0.75rem, 2.8%, 1.25rem);
  grid-template-areas:
    ". w."
    "a s d";
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  inline-size: min(100%, 56vh);
  margin-inline: auto;
}

.wasd-panel__key--w {
  grid-area: w;
}

.wasd-panel__key--a {
  grid-area: a;
}

.wasd-panel__key--s {
  grid-area: s;
}

.wasd-panel__key--d {
  grid-area: d;
}

.wasd-panel__key,
.wasd-panel__key :deep(.dwell-hitbox) {
  block-size: 100%;
}

.wasd-panel__content {
  align-items: center;
  color: #000000 !important;
  display: flex;
  flex-direction: column;
  font-size: clamp(0.95rem, 2vw, 1.2rem);
  font-weight: 800;
  gap: 0.35rem;
  justify-content: center;
}

.wasd-panel__icon {
  color: #000000 !important;
}

.wasd-panel__cap {
  border: 0.1em solid rgb(var(--v-theme-primary) / 28%);
  border-radius: 0.65em;
  color: #000000 !important;
  font-size: 0.72em;
  line-height: 1;
  min-inline-size: 1.8em;
  padding: 0.32em 0.5em;
}
</style>
