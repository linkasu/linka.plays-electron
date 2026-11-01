<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import GameDwellButton from "../components/game/GameDwellButton.vue";
import GazePointerOverlay from "../components/game/GazePointerOverlay.vue";
import MenuCover from "../components/MenuCover.vue";
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { useDwellSettings } from "../core/dwellSettings";
import {
  firstMenuCategory,
  menuReturnPage,
  readMenuReturn,
  rememberMenuCategory,
  rememberMenuMode,
  rememberMenuReturn,
} from "../core/menuMode";
import {
  games,
  groupGamesByCategory,
  resolveGameStabilityStatus,
  type GameCategoryId,
  type GameInfo,
} from "../data/games";

const router = useRouter();
const route = useRoute();
const { dwellMs } = useDwellSettings();
const releaseGames = games.filter((game) => resolveGameStabilityStatus(game) === "publish");
const gameGroups = groupGamesByCategory(releaseGames, { excludeArchived: true });
const returnContext = readMenuReturn("self", route.query.restore);
const selectedCategory = ref<GameCategoryId | null>(
  (returnContext?.category as GameCategoryId) ?? null,
);
const pageIndex = ref(returnContext?.pageIndex ?? 0);
const { xs } = useDisplay();
const pageSize = computed(() => (xs.value ? 1 : 4));
const selectedGroup = computed(() =>
  gameGroups.find((group) => group.category === selectedCategory.value),
);
const activeItems = computed(() => selectedGroup.value?.games ?? gameGroups);
const pageCount = computed(() => Math.max(1, Math.ceil(activeItems.value.length / pageSize.value)));
const visibleGroups = computed(() =>
  gameGroups.slice(
    pageIndex.value * pageSize.value,
    pageIndex.value * pageSize.value + pageSize.value,
  ),
);
const visibleGames = computed(
  () =>
    selectedGroup.value?.games.slice(
      pageIndex.value * pageSize.value,
      pageIndex.value * pageSize.value + pageSize.value,
    ) ?? [],
);
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
  rememberMenuReturn({
    mode: "self",
    category: selectedCategory.value ?? undefined,
    pageIndex: pageIndex.value,
    gameId: game.id,
    scrollTop: window.scrollY,
  });
  rememberMenuMode("self");
  rememberMenuCategory(game.category);
  router.push({ path: game.route, query: { from: "self", category: game.category } });
}

onMounted(async () => {
  rememberMenuMode("self");
  if (!returnContext) syncCategoryFromRoute();
  else {
    pageIndex.value = menuReturnPage(
      returnContext,
      selectedGroup.value?.games.map((game) => game.id) ?? [],
      pageSize.value,
    );
    await nextTick();
    requestAnimationFrame(() => window.scrollTo(0, returnContext.scrollTop));
  }
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
watch(pageSize, () => {
  pageIndex.value = 0;
});
</script>

<template>
  <v-container class="gallery-menu self-menu" fluid>
    <GazePointerOverlay />
    <div class="self-frame">
      <header class="self-header">
        <div class="self-heading">
          <h1>{{ selectedGroup ? selectedGroup.selfLabel : "Выбери папку" }}</h1>
          <p>
            {{
              selectedGroup ? selectedGroup.selfDescription : "Смотри на карточку, чтобы выбрать"
            }}
          </p>
        </div>
        <div class="self-adult-tools">
          <TobiiStatusBadge />
          <div class="d-flex flex-wrap justify-end ga-2">
            <v-btn
              color="surface"
              prepend-icon="mdi-eye-settings"
              to="/tobii-calibration"
              variant="flat"
              >Проверить взгляд</v-btn
            >
            <v-btn
              color="surface"
              prepend-icon="mdi-clipboard-text-outline"
              to="/menu/specialist"
              variant="flat"
              @click="rememberMenuMode('specialist')"
              >Специалист</v-btn
            >
            <v-btn color="surface" prepend-icon="mdi-home-heart" to="/" variant="flat"
              >На старт</v-btn
            >
          </div>
        </div>
      </header>

      <div class="self-grid" :aria-label="selectedGroup ? 'Игры в папке' : 'Папки игр'">
        <template v-if="!selectedGroup">
          <GameDwellButton
            v-for="group in visibleGroups"
            :key="group.category"
            class="self-choice"
            :target-id="`self-folder-${group.category}`"
            :dwell-ms="dwellMs"
            min-height="7.5rem"
            @select="selectCategory(group.category)"
          >
            <div class="self-choice-content">
              <div class="self-cover"><MenuCover :category-id="group.category" /></div>
              <div class="self-choice-label">
                <h2>{{ group.selfLabel }}</h2>
                <p>{{ group.selfDescription }}</p>
                <span class="self-choice-meta">{{ group.games.length }} игр</span>
              </div>
            </div>
          </GameDwellButton>
        </template>
        <template v-else>
          <GameDwellButton
            v-for="game in visibleGames"
            :key="game.id"
            class="self-choice"
            :target-id="`self-game-${game.id}`"
            :dwell-ms="dwellMs"
            min-height="7.5rem"
            @select="openGame(game)"
          >
            <div class="self-choice-content">
              <div class="self-cover"><MenuCover :game-id="game.id" /></div>
              <div class="self-choice-label">
                <h2>{{ game.title }}</h2>
                <p>{{ game.selfDescription }}</p>
                <span class="self-choice-meta">Играть <v-icon icon="mdi-arrow-right" /></span>
              </div>
            </div>
          </GameDwellButton>
        </template>
      </div>

      <div class="self-pagination" aria-live="polite">{{ pageLabel }}</div>
      <nav class="self-navigation" aria-label="Навигация по меню">
        <GameDwellButton
          target-id="self-back"
          :dwell-ms="dwellMs"
          min-height="7.5rem"
          color="secondary"
          @select="router.push('/')"
        >
          <v-icon icon="mdi-arrow-left" /><span>Назад</span>
        </GameDwellButton>
        <GameDwellButton
          target-id="self-folders"
          :disabled="!selectedGroup"
          :dwell-ms="dwellMs"
          min-height="7.5rem"
          @select="showCategories"
        >
          <v-icon icon="mdi-folder-multiple-outline" /><span>Папки</span>
        </GameDwellButton>
        <GameDwellButton
          target-id="self-prev"
          :disabled="pageIndex === 0"
          :dwell-ms="dwellMs"
          min-height="7.5rem"
          @select="previousPage"
        >
          <v-icon icon="mdi-chevron-left" /><span>Предыдущая</span>
        </GameDwellButton>
        <GameDwellButton
          target-id="self-next"
          :disabled="pageIndex >= pageCount - 1"
          :dwell-ms="dwellMs"
          min-height="7.5rem"
          color="primary"
          @select="nextPage"
        >
          <v-icon icon="mdi-arrow-right" /><span>Дальше</span>
        </GameDwellButton>
      </nav>
    </div>
  </v-container>
</template>

<style scoped>
.self-menu {
  min-block-size: 100dvh;
  padding: clamp(0.75rem, 2dvh, 1.5rem);
}
.self-frame {
  inline-size: min(100%, 80rem);
  min-block-size: calc(100dvh - 4dvh);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(0.75rem, 1.6dvh, 1.2rem);
}
.self-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  background: var(--linka-panel);
  border: 0.1rem solid var(--linka-outline);
  border-radius: var(--linka-radius);
  padding: clamp(0.6rem, 1.2dvh, 1rem) 1.2rem;
}
.self-heading {
  min-inline-size: 0;
}
.self-heading h1 {
  font-size: clamp(1.7rem, 4.5dvh, 3rem);
  line-height: 1.1;
  font-weight: 900;
}
.self-heading p {
  margin-block-start: 0.35rem;
  font-size: clamp(0.85rem, 1.8dvh, 1.1rem);
}
.self-adult-tools {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.4rem;
  flex-shrink: 0;
}
.self-adult-tools .v-btn {
  font-size: 0.85rem;
}
.self-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
}
.self-choice :deep(.dwell-button) {
  min-block-size: clamp(7.5rem, 22dvh, 15rem) !important;
  padding: clamp(0.9rem, 2dvh, 1.7rem) !important;
}
.self-choice-content {
  display: grid;
  grid-template-columns: minmax(4.5rem, 28%) 1fr;
  align-items: center;
  gap: clamp(0.75rem, 2vw, 1.8rem);
  block-size: 100%;
  text-align: left;
  color: rgb(var(--v-theme-on-surface));
}
.self-cover {
  block-size: clamp(4.8rem, 13dvh, 10rem);
  min-inline-size: 0;
}
.self-choice-label {
  min-inline-size: 0;
}
.self-choice-label h2 {
  font-size: clamp(1.35rem, 3.1dvh, 2.3rem);
  font-weight: 900;
  line-height: 1.1;
}
.self-choice-label p {
  font-size: clamp(0.85rem, 1.7dvh, 1.1rem);
  margin-block: 0.5rem;
  line-height: 1.25;
}
.self-choice-meta {
  font-size: clamp(0.8rem, 1.6dvh, 1rem);
  font-weight: 700;
}
.self-pagination {
  text-align: center;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.2;
}
.self-navigation {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.5rem;
  margin-block-end: 1.5rem;
}
.self-navigation :deep(.dwell-button) {
  padding: 0.6rem !important;
  gap: 0.4rem;
  font-size: clamp(1rem, 2.1dvh, 1.35rem);
  font-weight: 800;
}
.self-navigation .v-icon {
  font-size: 2rem;
  align-self: center;
}
@media (max-width: 37.5rem) {
  .self-header {
    flex-wrap: wrap;
  }
  .self-adult-tools {
    inline-size: 100%;
    flex-direction: row;
    justify-content: space-between;
  }
  .self-adult-tools :deep(.v-chip) {
    max-inline-size: 45%;
  }
  .self-choice-label p {
    display: none;
  }
}
@media (max-height: 42rem) {
  .self-header {
    gap: 0.5rem;
  }
  .self-heading h1 {
    font-size: 1.7rem;
  }
  .self-choice-label p {
    display: none;
  }
  .self-choice :deep(.dwell-button) {
    min-block-size: 7.5rem !important;
  }
  .self-cover {
    block-size: 4.8rem;
  }
  .self-frame {
    justify-content: flex-start;
  }
}
@media (max-width: 37.5rem) {
  .self-grid {
    grid-template-columns: 1fr;
  }
  .self-navigation {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .self-adult-tools {
    flex-wrap: wrap;
  }
  .self-adult-tools :deep(.v-chip) {
    max-inline-size: 100%;
  }
}
</style>
