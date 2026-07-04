<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { rememberMenuMode } from "../core/menuMode";
import { gameSkillLabels, gameStatusLabels, groupGamesByCategory, type GameCategoryId, type GameInfo } from "../data/games";

type SpecialistGameItem = {
  game: GameInfo;
  category: GameCategoryId;
  categoryLabel: string;
  searchableText: string;
};

const router = useRouter();
const gameGroups = groupGamesByCategory();
const selectedCategory = ref<GameCategoryId | null>(null);
const pageIndex = ref(0);
const searchQuery = ref("");
const pageSize = 4;
const selectedGroup = computed(() => gameGroups.find((group) => group.category === selectedCategory.value));
const selectedGroupLabel = computed(() => selectedGroup.value?.label ?? "Папка");
const selectedGroupDescription = computed(() => selectedGroup.value?.description ?? "");
const normalizedSearchQuery = computed(() => normalizeSearch(searchQuery.value));
const isSearchActive = computed(() => normalizedSearchQuery.value.length > 0);
const allGameItems: SpecialistGameItem[] = gameGroups.flatMap((group) => group.games.map((game) => ({
  game,
  category: group.category,
  categoryLabel: group.label,
  searchableText: normalizeSearch([
    game.title,
    game.description,
    game.selfDescription,
    group.label,
    gameStatusLabels[game.status],
    ...game.skills.map((skill) => gameSkillLabels[skill])
  ].join(" "))
})));
const selectedGameItems = computed(() => selectedGroup.value ? allGameItems.filter((item) => item.category === selectedGroup.value?.category) : []);
const searchResults = computed(() => {
  const terms = normalizedSearchQuery.value.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return allGameItems.filter((item) => terms.every((term) => item.searchableText.includes(term)));
});
const activeItems = computed(() => {
  if (isSearchActive.value) return searchResults.value;
  return selectedGroup.value ? selectedGameItems.value : gameGroups;
});
const pageCount = computed(() => Math.max(1, Math.ceil(activeItems.value.length / pageSize)));
const visibleGroups = computed(() => gameGroups.slice(pageIndex.value * pageSize, pageIndex.value * pageSize + pageSize));
const visibleGameItems = computed(() => {
  const source = isSearchActive.value ? searchResults.value : selectedGameItems.value;
  return source.slice(pageIndex.value * pageSize, pageIndex.value * pageSize + pageSize);
});
const pageLabel = computed(() => `Страница ${pageIndex.value + 1} / ${pageCount.value}`);

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").trim();
}

function gameRoute(game: GameInfo) {
  return { path: game.route, query: { from: "specialist" } };
}

function selectCategory(category: GameCategoryId) {
  searchQuery.value = "";
  selectedCategory.value = category;
  pageIndex.value = 0;
}

function showCategories() {
  searchQuery.value = "";
  selectedCategory.value = null;
  pageIndex.value = 0;
}

function setSearchQuery(value: string | null) {
  searchQuery.value = value ?? "";
}

function clearSearch() {
  searchQuery.value = "";
  pageIndex.value = 0;
}

function previousPage() {
  pageIndex.value = Math.max(0, pageIndex.value - 1);
}

function nextPage() {
  pageIndex.value = Math.min(pageCount.value - 1, pageIndex.value + 1);
}

function openGame(game: GameInfo) {
  rememberMenuMode("specialist");
  router.push(gameRoute(game));
}

onMounted(() => {
  rememberMenuMode("specialist");
});

watch(searchQuery, () => {
  pageIndex.value = 0;
  if (isSearchActive.value) selectedCategory.value = null;
});
</script>

<template>
  <v-container class="gallery-menu pa-4 pa-md-6" fluid>
    <v-row class="h-100" justify="center" align="center">
      <v-col cols="12" lg="11" xl="10">
        <v-card class="gallery-card pa-5 pa-md-7" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-start justify-space-between ga-4 mb-4">
            <div>
              <div class="text-overline text-secondary mb-2">Режим специалиста</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">Игры для занятия</h1>
              <p class="text-body-1 text-medium-emphasis mb-0">Каталог разбит на страницы: крупные цели, без скролла, с ключевыми параметрами занятия.</p>
            </div>
            <TobiiStatusBadge />
          </div>

          <div class="d-flex flex-wrap align-center ga-3 mb-5">
            <v-text-field
              class="search-field"
              clearable
              density="comfortable"
              hide-details
              label="Поиск игры"
              :model-value="searchQuery"
              prepend-inner-icon="mdi-magnify"
              variant="solo-filled"
              @click:clear="clearSearch"
              @update:model-value="setSearchQuery"
            />
            <v-btn color="secondary" prepend-icon="mdi-eye-settings" size="large" to="/tobii-calibration" variant="flat">
              Калибровка Tobii
            </v-btn>
            <v-btn color="primary" prepend-icon="mdi-eye-outline" size="large" to="/menu/self" variant="tonal" @click="rememberMenuMode('self')">
              Самостоятельный режим
            </v-btn>
            <v-btn color="secondary" prepend-icon="mdi-home-heart" size="large" to="/" variant="text">
              На старт
            </v-btn>
          </div>

          <section v-if="!selectedGroup && !isSearchActive" aria-label="Папки игр">
            <div class="d-flex align-center justify-space-between ga-4 mb-4">
              <h2 class="text-h4 font-weight-bold mb-0">Папки игр</h2>
              <v-chip color="info" size="large" variant="tonal">{{ pageLabel }}</v-chip>
            </div>
            <v-row align="stretch" dense>
              <v-col v-for="group in visibleGroups" :key="group.category" cols="12" sm="6">
                <v-card
                  class="menu-card h-100 pa-5 d-flex bg-surface text-on-surface"
                  min-height="clamp(9rem, 20dvh, 12rem)"
                  rounded="xl"
                  variant="outlined"
                  @click="selectCategory(group.category)"
                >
                  <div class="d-flex h-100 ga-4 text-left text-on-surface">
                    <v-avatar color="primary" size="64">
                      <v-icon icon="mdi-folder-heart-outline" size="32" />
                    </v-avatar>
                    <div class="d-flex flex-column min-w-0">
                      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">{{ group.label }}</h3>
                      <p class="text-body-1 text-medium-emphasis mb-3">{{ group.description }}</p>
                      <v-spacer />
                      <v-chip class="align-self-start" color="secondary" size="small" variant="tonal">{{ group.games.length }} игр</v-chip>
                    </div>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </section>

          <section v-else :aria-label="isSearchActive ? 'Результаты поиска' : 'Игры в папке'">
            <div v-if="isSearchActive" class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-4">
              <div>
                <div class="text-overline text-secondary mb-1">Поиск</div>
                <h2 class="text-h4 font-weight-bold mb-2">{{ searchResults.length ? "Найденные игры" : "Ничего не найдено" }}</h2>
                <p class="text-body-1 text-medium-emphasis mb-0">Запрос: {{ searchQuery.trim() }}</p>
              </div>
              <v-chip color="info" size="large" variant="tonal">{{ searchResults.length }} игр · {{ pageLabel }}</v-chip>
            </div>
            <div v-else class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-4">
              <div>
                <div class="text-overline text-secondary mb-1">Папка</div>
                <h2 class="text-h4 font-weight-bold mb-2">{{ selectedGroupLabel }}</h2>
                <p class="text-body-1 text-medium-emphasis mb-0">{{ selectedGroupDescription }}</p>
              </div>
              <v-chip color="info" size="large" variant="tonal">{{ pageLabel }}</v-chip>
            </div>

            <v-row v-if="visibleGameItems.length" align="stretch" dense>
              <v-col v-for="item in visibleGameItems" :key="item.game.id" cols="12" sm="6">
                <v-card
                  class="menu-card h-100 pa-5 d-flex bg-surface text-on-surface"
                  min-height="clamp(9rem, 20dvh, 12rem)"
                  rounded="xl"
                  variant="outlined"
                  @click="openGame(item.game)"
                >
                  <div class="d-flex h-100 ga-4 text-left text-on-surface">
                    <v-avatar color="primary" size="64">
                      <v-icon :icon="item.game.icon" size="32" />
                    </v-avatar>
                    <div class="d-flex flex-column min-w-0">
                      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">{{ item.game.title }}</h3>
                      <p class="text-body-2 text-medium-emphasis mb-3">{{ item.game.description }}</p>
                      <v-spacer />
                      <div class="d-flex flex-wrap ga-2">
                        <v-chip :color="item.game.status === 'planned' ? 'default' : 'primary'" size="small" variant="tonal">{{ gameStatusLabels[item.game.status] }}</v-chip>
                        <v-chip v-if="isSearchActive" color="secondary" size="small" variant="tonal">{{ item.categoryLabel }}</v-chip>
                        <v-chip color="info" prepend-icon="mdi-timer-outline" size="small" variant="tonal">{{ item.game.recommendedSessionSeconds }} сек</v-chip>
                        <v-chip color="info" prepend-icon="mdi-clock-outline" size="small" variant="tonal">{{ item.game.defaultDwellMs }} мс</v-chip>
                      </div>
                    </div>
                  </div>
                </v-card>
              </v-col>
            </v-row>
            <v-card v-else class="pa-5" min-height="clamp(9rem, 20dvh, 12rem)" rounded="xl" variant="tonal">
              <div class="d-flex flex-column justify-center h-100 ga-3">
                <h3 class="text-h5 font-weight-bold mb-0">Игр по запросу нет</h3>
                <p class="text-body-1 text-medium-emphasis mb-0">Попробуйте другое слово: название, навык, категорию или статус.</p>
                <v-btn class="align-self-start" color="primary" prepend-icon="mdi-close" variant="flat" @click="clearSearch">Очистить поиск</v-btn>
              </div>
            </v-card>
          </section>

          <v-row class="mt-4" align="stretch" dense>
            <v-col cols="4">
              <v-btn block class="nav-action" color="secondary" :disabled="pageIndex === 0" prepend-icon="mdi-arrow-left" size="large" variant="flat" @click="previousPage">
                Назад
              </v-btn>
            </v-col>
            <v-col cols="4">
              <v-btn block class="nav-action" color="surface" :disabled="!selectedGroup && !isSearchActive" prepend-icon="mdi-folder-multiple-outline" size="large" variant="flat" @click="showCategories">
                Папки
              </v-btn>
            </v-col>
            <v-col cols="4">
              <v-btn block append-icon="mdi-arrow-right" class="nav-action" color="primary" :disabled="pageIndex >= pageCount - 1" size="large" variant="flat" @click="nextPage">
                Дальше
              </v-btn>
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
    radial-gradient(circle at 10% 10%, rgb(216 154 114 / 18%), transparent 28rem),
    radial-gradient(circle at 90% 18%, rgb(111 143 168 / 18%), transparent 28rem),
    rgb(var(--v-theme-background));
  block-size: 100dvh;
  overflow: hidden;
}

.gallery-card,
.menu-card {
  border: 0.0625rem solid rgb(93 127 120 / 15%);
}

.menu-card {
  block-size: 100%;
  cursor: pointer;
}

.nav-action {
  min-block-size: clamp(4.75rem, 10dvh, 6rem);
}

.search-field {
  flex: 1 1 18rem;
  max-inline-size: 30rem;
  min-inline-size: min(100%, 18rem);
}
</style>
