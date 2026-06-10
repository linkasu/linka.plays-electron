<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { rememberMenuMode } from "../core/menuMode";
import { groupGamesByCategory, type GameCategoryId } from "../data/games";

const gameGroups = groupGamesByCategory();
const selectedCategory = ref<GameCategoryId | null>(null);
const selectedGroup = computed(() => gameGroups.find((group) => group.category === selectedCategory.value));

onMounted(() => {
  rememberMenuMode("self");
});
</script>

<template>
  <v-container class="gallery-menu py-10" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="8">
        <v-card class="gallery-card pa-6 pa-md-10" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-start justify-space-between ga-6 mb-8">
            <div>
              <div class="text-overline text-secondary mb-2">Самостоятельный режим</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">Выбери папку</h1>
              <p class="text-h6 text-medium-emphasis mb-0">
                Сначала выбери большую папку, потом игру. Можно играть спокойно, без спешки.
              </p>
            </div>
            <TobiiStatusBadge />
          </div>

          <div class="d-flex flex-wrap ga-3 mb-8">
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
            <v-col v-for="group in gameGroups" :key="group.category" cols="12" md="6" xl="4">
              <v-card
                class="self-folder-card h-100 pa-5 d-flex flex-column bg-surface text-on-surface"
                min-height="260"
                rounded="xl"
                variant="outlined"
                @click="selectedCategory = group.category"
              >
                <v-avatar class="mb-5" color="primary" size="88">
                  <v-icon icon="mdi-folder-heart-outline" size="52" />
                </v-avatar>
                <h3 class="text-h4 font-weight-bold text-high-emphasis mb-3">{{ group.selfLabel }}</h3>
                <p class="text-h6 text-medium-emphasis mb-4">{{ group.selfDescription }}</p>
                <v-chip class="mb-6 align-self-start" color="secondary" size="large" variant="tonal">
                  {{ group.games.length }} игр
                </v-chip>
                <v-spacer />
                <v-btn color="primary" size="x-large" variant="flat" @click.stop="selectedCategory = group.category">
                  Открыть
                  <v-icon end icon="mdi-folder-open-outline" />
                </v-btn>
              </v-card>
            </v-col>
          </v-row>

          <section v-else aria-label="Игры в папке">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-6">
              <div>
                <div class="text-overline text-secondary mb-1">Папка</div>
                <h2 class="text-h3 font-weight-bold mb-2">{{ selectedGroup.selfLabel }}</h2>
                <p class="text-h6 text-medium-emphasis mb-0">{{ selectedGroup.selfDescription }}</p>
              </div>
              <v-btn color="secondary" prepend-icon="mdi-folder-multiple-outline" size="x-large" variant="tonal" @click="selectedCategory = null">
                Все папки
              </v-btn>
            </div>

            <v-row align="stretch">
              <v-col v-for="game in selectedGroup.games" :key="game.id" cols="12" md="6" xl="4">
                <v-card
                  class="self-game-card h-100 pa-5 d-flex flex-column bg-surface text-on-surface"
                  min-height="240"
                  rounded="xl"
                  :to="game.route"
                  variant="outlined"
                >
                  <v-avatar class="mb-5" color="primary" size="88">
                    <v-icon :icon="game.icon" size="52" />
                  </v-avatar>
                  <h3 class="text-h4 font-weight-bold text-high-emphasis mb-3">{{ game.title }}</h3>
                  <p class="text-h6 text-medium-emphasis mb-6">{{ game.selfDescription }}</p>
                  <v-spacer />
                  <v-btn color="primary" size="x-large" variant="flat">
                    Играть
                    <v-icon end icon="mdi-arrow-right" />
                  </v-btn>
                </v-card>
              </v-col>
            </v-row>
          </section>
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
  min-block-size: 100vh;
}

.gallery-card,
.self-folder-card,
.self-game-card {
  border: 1px solid rgb(93 127 120 / 16%);
}

.self-folder-card {
  cursor: pointer;
}
</style>
