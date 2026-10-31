<script setup lang="ts">
import GameDwellButton from "../game/GameDwellButton.vue";
import { useAppearanceTheme, themeBackgroundUrl } from "../../core/themeSettings";
import { useDwellSettings } from "../../core/dwellSettings";
import { appearanceThemes, themeIds } from "../../themes";

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const { themeId, setTheme } = useAppearanceTheme();
const { dwellMs } = useDwellSettings();
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="58rem"
    persistent
    scrollable
    aria-labelledby="theme-heading"
  >
    <v-card class="theme-chooser pa-4 pa-md-6">
      <v-card-title id="theme-heading" class="text-h4 font-weight-bold text-wrap"
        >Оформление</v-card-title
      >
      <v-card-subtitle class="text-wrap"
        >Выбери тему. Она сохранится для следующего запуска.</v-card-subtitle
      >
      <v-card-text class="px-0 pt-5">
        <v-row dense class="ma-0">
          <v-col v-for="id in themeIds" :key="id" cols="12" sm="4">
            <GameDwellButton
              class="theme-option h-100"
              :class="{ 'theme-option--selected': themeId === id }"
              :target-id="`theme-${id}`"
              :dwell-ms="dwellMs"
              :disabled="!modelValue"
              :priority="50"
              :hit-padding="0"
              min-height="clamp(12rem, 32dvh, 18rem)"
              :pressed="themeId === id"
              @select="setTheme(id)"
            >
              <img :src="themeBackgroundUrl(id)" alt="" class="theme-preview" draggable="false" />
              <div class="theme-option-title">{{ appearanceThemes[id].title }}</div>
              <div class="text-body-2 mt-1">{{ appearanceThemes[id].description }}</div>
              <v-chip
                class="mt-3"
                :color="themeId === id ? 'primary' : 'secondary'"
                variant="tonal"
              >
                <v-icon v-if="themeId === id" icon="mdi-check" start />
                {{ themeId === id ? "Выбрана" : "Выбрать" }}
              </v-chip>
            </GameDwellButton>
          </v-col>
        </v-row>
      </v-card-text>
      <GameDwellButton
        target-id="theme-close"
        :dwell-ms="dwellMs"
        :disabled="!modelValue"
        :priority="50"
        :hit-padding="0"
        min-height="7.5rem"
        color="primary"
        @select="emit('update:modelValue', false)"
      >
        <span class="text-h6 font-weight-bold"><v-icon icon="mdi-check" class="mr-2" />Готово</span>
      </GameDwellButton>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.theme-chooser {
  border: 0.15rem solid var(--linka-outline);
  border-radius: var(--linka-radius) !important;
}
.theme-option :deep(.dwell-button) {
  padding: clamp(0.7rem, 2dvh, 1.25rem) !important;
}
.theme-option--selected :deep(.dwell-button) {
  outline: 0.2rem solid var(--linka-focus);
  outline-offset: -0.2rem;
}
.theme-preview {
  inline-size: 100%;
  block-size: clamp(4.5rem, 13dvh, 8rem);
  object-fit: cover;
  border-radius: 1rem;
}
.theme-option-title {
  font-size: clamp(1.05rem, 2.5dvh, 1.35rem);
  font-weight: 800;
  margin-block-start: 0.75rem;
}
@media (max-width: 37.5rem) {
  .theme-option :deep(.dwell-button) {
    min-block-size: 8rem !important;
  }
  .theme-preview {
    inline-size: 30%;
    block-size: 4rem;
    align-self: center;
  }
}
</style>
