<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import GameDwellButton from "../game/GameDwellButton.vue";
import { useAppearanceTheme, themeBackgroundUrl } from "../../core/themeSettings";
import { useDwellSettings } from "../../core/dwellSettings";
import { appearanceThemes, themeIds } from "../../themes";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const { themeId, setTheme } = useAppearanceTheme();
const { dwellMs } = useDwellSettings();
const { xs } = useDisplay();
const previewIndex = ref(0);
const visibleThemes = computed(() => (xs.value ? [themeIds[previewIndex.value]] : themeIds));
watch(
  () => props.modelValue,
  (open) => {
    if (open) previewIndex.value = themeIds.indexOf(themeId.value);
  },
);
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    :fullscreen="xs"
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
          <v-col v-for="id in visibleThemes" :key="id" cols="12" sm="4">
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
      <div v-if="xs" class="theme-navigation">
        <GameDwellButton
          target-id="theme-prev"
          :disabled="!modelValue || previewIndex === 0"
          :priority="50"
          :hit-padding="0"
          :dwell-ms="dwellMs"
          min-height="7.5rem"
          @select="previewIndex -= 1"
          ><v-icon icon="mdi-arrow-left" />Предыдущая</GameDwellButton
        >
        <GameDwellButton
          target-id="theme-next"
          :disabled="!modelValue || previewIndex === themeIds.length - 1"
          :priority="50"
          :hit-padding="0"
          :dwell-ms="dwellMs"
          min-height="7.5rem"
          @select="previewIndex += 1"
          ><v-icon icon="mdi-arrow-right" />Следующая</GameDwellButton
        >
      </div>
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
  .theme-chooser {
    padding: 0.75rem !important;
  }
  .theme-chooser :deep(.v-card-title) {
    font-size: 1.5rem !important;
    padding: 0.25rem 0.5rem;
  }
  .theme-chooser :deep(.v-card-subtitle) {
    display: none;
  }
  .theme-chooser :deep(.v-card-text) {
    padding-block: 0.5rem !important;
    flex: 0 0 auto;
  }
  .theme-option :deep(.dwell-button) {
    min-block-size: 8rem !important;
  }
  .theme-preview {
    inline-size: 30%;
    block-size: 3rem;
    align-self: center;
  }
  .theme-option .text-body-2 {
    display: none;
  }
  .theme-navigation {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
    margin-block: 0 0.75rem;
  }
  .theme-navigation :deep(.dwell-button) {
    padding: 0.5rem !important;
    font-weight: 700;
  }
}
</style>
