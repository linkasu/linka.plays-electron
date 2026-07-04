<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { rememberMenuMode } from "../core/menuMode";
import { gameStatusLabels, groupGamesByCategory, type GameCategoryId, type GameInfo } from "../data/games";

const router = useRouter();
const gameGroups = groupGamesByCategory();
const selectedCategory = ref<GameCategoryId | null>(null);
const pageIndex = ref(0);
const pageSize = 4;
const selectedGroup = computed(() => gameGroups.find((group) => group.category === selectedCategory.value));
const activeItems = computed(() => selectedGroup.value?.games ?? gameGroups);
const pageCount = computed(() => Math.max(1, Math.ceil(activeItems.value.length / pageSize)));
const visibleGroups = computed(() => gameGroups.slice(pageIndex.value * pageSize, pageIndex.value * pageSize + pageSize));
const visibleGames = computed(() => selectedGroup.value?.games.slice(pageIndex.value * pageSize, pageIndex.value * pageSize + pageSize) ?? []);
const pageLabel = computed(() => `Страница ${pageIndex.value + 1} / ${pageCount.value}`);

function gameRoute(game: GameInfo) {
  return { path: game.route, query: { from: "specialist" } };
}

function selectCategory(category: GameCategoryId) {
  selectedCategory.value = category;
  pageIndex.value = 0;
}

function showCategories() {
  selectedCategory.value = null;
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

          <div class="d-flex flex-wrap ga-3 mb-5">
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

          <section v-if="!selectedGroup" aria-label="Папки игр">
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

          <section v-else aria-label="Игры в папке">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-4">
              <div>
                <div class="text-overline text-secondary mb-1">Папка</div>
                <h2 class="text-h4 font-weight-bold mb-2">{{ selectedGroup.label }}</h2>
                <p class="text-body-1 text-medium-emphasis mb-0">{{ selectedGroup.description }}</p>
              </div>
              <v-chip color="info" size="large" variant="tonal">{{ pageLabel }}</v-chip>
            </div>

            <v-row align="stretch" dense>
              <v-col v-for="game in visibleGames" :key="game.id" cols="12" sm="6">
                <v-card
                  class="menu-card h-100 pa-5 d-flex bg-surface text-on-surface"
                  min-height="clamp(9rem, 20dvh, 12rem)"
                  rounded="xl"
                  variant="outlined"
                  @click="openGame(game)"
                >
                  <div class="d-flex h-100 ga-4 text-left text-on-surface">
                    <v-avatar color="primary" size="64">
                      <v-icon :icon="game.icon" size="32" />
                    </v-avatar>
                    <div class="d-flex flex-column min-w-0">
                      <h3 class="text-h5 font-weight-bold text-high-emphasis mb-2">{{ game.title }}</h3>
                      <p class="text-body-2 text-medium-emphasis mb-3">{{ game.description }}</p>
                      <v-spacer />
                      <div class="d-flex flex-wrap ga-2">
                        <v-chip :color="game.status === 'planned' ? 'default' : 'primary'" size="small" variant="tonal">{{ gameStatusLabels[game.status] }}</v-chip>
                        <v-chip color="info" prepend-icon="mdi-timer-outline" size="small" variant="tonal">{{ game.recommendedSessionSeconds }} сек</v-chip>
                        <v-chip color="info" prepend-icon="mdi-clock-outline" size="small" variant="tonal">{{ game.defaultDwellMs }} мс</v-chip>
                      </div>
                    </div>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </section>

          <v-row class="mt-4" align="stretch" dense>
            <v-col cols="4">
              <v-btn block class="nav-action" color="secondary" :disabled="pageIndex === 0" prepend-icon="mdi-arrow-left" size="large" variant="flat" @click="previousPage">
                Назад
              </v-btn>
            </v-col>
            <v-col cols="4">
              <v-btn block class="nav-action" color="surface" :disabled="!selectedGroup" prepend-icon="mdi-folder-multiple-outline" size="large" variant="flat" @click="showCategories">
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
</style>
