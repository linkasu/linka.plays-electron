<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import GameDwellButton from "../components/game/GameDwellButton.vue";
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { useDwellSettings } from "../core/dwellSettings";
import { firstMenuCategory, rememberMenuCategory, rememberMenuMode } from "../core/menuMode";
import { games, groupGamesByCategory, resolveGameStabilityStatus, type GameCategoryId, type GameInfo } from "../data/games";

const router = useRouter();
const route = useRoute();
const { dwellMs } = useDwellSettings();
const releaseGames = games.filter((game) => resolveGameStabilityStatus(game) === "publish");
const gameGroups = groupGamesByCategory(releaseGames, { excludeArchived: true });
const selectedCategory = ref<GameCategoryId | null>(null);
const pageIndex = ref(0);
const pageSize = 4;
const selectedGroup = computed(() => gameGroups.find((group) => group.category === selectedCategory.value));
const activeItems = computed(() => selectedGroup.value?.games ?? gameGroups);
const pageCount = computed(() => Math.max(1, Math.ceil(activeItems.value.length / pageSize)));
const visibleGroups = computed(() => gameGroups.slice(pageIndex.value * pageSize, pageIndex.value * pageSize + pageSize));
const visibleGames = computed(() => selectedGroup.value?.games.slice(pageIndex.value * pageSize, pageIndex.value * pageSize + pageSize) ?? []);
const pageLabel = computed(() => `Страница ${pageIndex.value + 1} / ${pageCount.value}`);

function selectCategory(category: GameCategoryId) {
  selectedCategory.value = category;
  rememberMenuCategory(category);
  pageIndex.value = 0;
}

function showCategories() {
  selectedCategory.value = null;
  rememberMenuCategory(undefined);
  pageIndex.value = 0;
}

function previousPage() {
  pageIndex.value = Math.max(0, pageIndex.value - 1);
}

function nextPage() {
  pageIndex.value = Math.min(pageCount.value - 1, pageIndex.value + 1);
}

function openGame(game: GameInfo) {
  rememberMenuMode("self");
  rememberMenuCategory(game.category);
  router.push({ path: game.route, query: { from: "self", category: game.category } });
}

onMounted(() => {
  rememberMenuMode("self");
  syncCategoryFromRoute();
});

function syncCategoryFromRoute() {
  const category = firstMenuCategory(route.query.category);
  const group = category ? gameGroups.find((item) => item.category === category) : undefined;
  if (!group) {
    selectedCategory.value = null;
    return;
  }

  selectedCategory.value = group.category;
  pageIndex.value = 0;
}

watch(() => route.query.category, syncCategoryFromRoute);
</script>

<template>
  <v-container class="gallery-menu pa-4 pa-md-6" fluid>
    <v-row class="h-100" justify="center" align="center">
      <v-col cols="12" lg="11" xl="10">
        <v-card class="gallery-card pa-5 pa-md-7" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-start justify-space-between ga-4 mb-4">
            <div>
              <div class="text-overline text-secondary mb-2">Самостоятельный режим</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ selectedGroup ? selectedGroup.selfLabel : "Выбери папку" }}</h1>
              <p class="text-body-1 text-medium-emphasis mb-0">{{ selectedGroup ? selectedGroup.selfDescription : "Большие карточки, выбор взглядом и страницы без скролла." }}</p>
            </div>
            <TobiiStatusBadge />
          </div>

          <div class="d-flex flex-wrap ga-3 mb-4" aria-label="Действия взрослого">
            <v-btn color="secondary" prepend-icon="mdi-eye-settings" size="large" to="/tobii-calibration" variant="tonal">
              Проверить взгляд
            </v-btn>
            <v-btn color="primary" prepend-icon="mdi-clipboard-text-outline" size="large" to="/menu/specialist" variant="text" @click="rememberMenuMode('specialist')">
              Режим специалиста
            </v-btn>
            <v-btn color="secondary" prepend-icon="mdi-home-heart" size="large" to="/" variant="text">
              На старт
            </v-btn>
          </div>

          <v-row v-if="!selectedGroup" align="stretch">
            <v-col v-for="group in visibleGroups" :key="group.category" cols="12" sm="6">
              <GameDwellButton
                class="self-folder-card h-100"
                :target-id="`self-folder-${group.category}`"
                :dwell-ms="dwellMs"
                min-height="clamp(7.5rem, 17dvh, 10rem)"
                color="surface"
                @select="selectCategory(group.category)"
              >
                <template #default>
                  <div class="d-flex align-center h-100 ga-4 text-left text-on-surface">
                    <v-avatar color="primary" size="72">
                      <v-icon icon="mdi-folder-heart-outline" size="40" />
                    </v-avatar>
                    <div class="d-flex flex-column min-w-0">
                      <h3 class="text-h4 font-weight-bold text-high-emphasis mb-2">{{ group.selfLabel }}</h3>
                      <p class="text-body-1 text-medium-emphasis mb-2">{{ group.selfDescription }}</p>
                      <v-chip class="align-self-start" color="secondary" size="small" variant="tonal">{{ group.games.length }} игр</v-chip>
                    </div>
                  </div>
                </template>
              </GameDwellButton>
            </v-col>
          </v-row>

          <section v-else aria-label="Игры в папке">
            <div class="d-flex align-center justify-space-between ga-4 mb-3">
              <div class="text-overline text-secondary">Игры в папке</div>
              <v-chip color="info" size="large" variant="tonal">{{ pageLabel }}</v-chip>
            </div>

            <v-row align="stretch" dense>
              <v-col v-for="game in visibleGames" :key="game.id" cols="12" sm="6">
                <GameDwellButton
                  class="self-game-card h-100"
                  :target-id="`self-game-${game.id}`"
                  :dwell-ms="dwellMs"
                  min-height="clamp(7.5rem, 17dvh, 10rem)"
                  color="surface"
                  @select="openGame(game)"
                >
                  <template #default>
                    <div class="d-flex align-center h-100 ga-4 text-left text-on-surface">
                      <v-avatar color="primary" size="72">
                        <v-icon :icon="game.icon" size="40" />
                      </v-avatar>
                      <div class="d-flex flex-column min-w-0">
                        <h3 class="text-h4 font-weight-bold text-high-emphasis mb-2">{{ game.title }}</h3>
                        <p class="text-body-1 text-medium-emphasis mb-2">{{ game.selfDescription }}</p>
                        <div class="d-flex align-center ga-2 text-primary font-weight-bold text-body-1">
                          <span>Играть</span>
                          <v-icon icon="mdi-arrow-right" />
                        </div>
                      </div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </section>

          <div class="d-flex align-center justify-space-between ga-4 mt-3 mb-2">
            <v-chip v-if="!selectedGroup" color="info" size="large" variant="tonal">{{ pageLabel }}</v-chip>
            <v-spacer v-else />
          </div>

          <v-row align="stretch" dense>
            <v-col cols="4">
              <GameDwellButton target-id="self-prev" :disabled="pageIndex === 0" :dwell-ms="dwellMs" min-height="clamp(4rem, 8dvh, 5rem)" color="secondary" @select="previousPage">
                <template #default>
                  <div class="d-flex align-center justify-center ga-2 text-white text-h6 font-weight-bold">
                    <v-icon icon="mdi-arrow-left" />
                    <span>Назад</span>
                  </div>
                </template>
              </GameDwellButton>
            </v-col>
            <v-col cols="4">
              <GameDwellButton target-id="self-folders" :disabled="!selectedGroup" :dwell-ms="dwellMs" min-height="clamp(4rem, 8dvh, 5rem)" color="surface" @select="showCategories">
                <template #default>
                  <div class="d-flex align-center justify-center ga-2 text-primary text-h6 font-weight-bold">
                    <v-icon icon="mdi-folder-multiple-outline" />
                    <span>Папки</span>
                  </div>
                </template>
              </GameDwellButton>
            </v-col>
            <v-col cols="4">
              <GameDwellButton target-id="self-next" :disabled="pageIndex >= pageCount - 1" :dwell-ms="dwellMs" min-height="clamp(4rem, 8dvh, 5rem)" color="primary" @select="nextPage">
                <template #default>
                  <div class="d-flex align-center justify-center ga-2 text-white text-h6 font-weight-bold">
                    <span>Дальше</span>
                    <v-icon icon="mdi-arrow-right" />
                  </div>
                </template>
              </GameDwellButton>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.gallery-menu {
  background:
    radial-gradient(circle at 12% 12%, rgb(216 154 114 / 20%), transparent 30rem),
    radial-gradient(circle at 88% 22%, rgb(139 123 184 / 17%), transparent 28rem),
    rgb(var(--v-theme-background));
  block-size: 100dvh;
  overflow: hidden;
}

.gallery-card,
.self-folder-card :deep(.dwell-button),
.self-game-card :deep(.dwell-button) {
  border: 0.0625rem solid rgb(93 127 120 / 16%);
}

.self-folder-card,
.self-game-card {
  block-size: 100%;
  display: block;
}
</style>
