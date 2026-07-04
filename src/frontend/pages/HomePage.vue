<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { rememberMenuMode } from "../core/menuMode";
import { gameSkillLabels, gameStatusLabels, groupGamesByCategory, type GameCategoryId, type GameInfo } from "../data/games";

const gameGroups = groupGamesByCategory();
const selectedCategory = ref<GameCategoryId | null>(null);
const selectedGroup = computed(() => gameGroups.find((group) => group.category === selectedCategory.value));

function gameRoute(game: GameInfo) {
  return { path: game.route, query: { from: "specialist" } };
}

onMounted(() => {
  rememberMenuMode("specialist");
});
</script>

<template>
  <v-container class="gallery-menu py-10" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="8">
        <v-card class="gallery-card pa-6 pa-md-10" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-6 mb-8">
            <div>
              <div class="text-overline text-secondary mb-2">Режим специалиста</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">Игры для занятия</h1>
              <p class="text-h6 text-medium-emphasis mb-0">
                Сначала откройте папку по цели занятия, затем выберите игру. Навыки, длительность и параметры показаны в карточке.
              </p>
            </div>
            <TobiiStatusBadge />
          </div>

          <div class="d-flex flex-wrap ga-3 mb-8">
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
            <h2 class="text-h4 font-weight-bold mb-4">Папки игр</h2>
            <v-row>
              <v-col v-for="group in gameGroups" :key="group.category" cols="12" md="6" lg="4">
                <v-card
                  class="gallery-folder-card h-100 bg-surface text-on-surface"
                  rounded="xl"
                  variant="outlined"
                  @click="selectedCategory = group.category"
                >
                  <v-card-item>
                    <template #prepend>
                      <v-avatar color="primary" size="56">
                        <v-icon icon="mdi-folder-heart-outline" size="32" />
                      </v-avatar>
                    </template>
                    <v-card-title class="text-high-emphasis">{{ group.label }}</v-card-title>
                    <v-card-subtitle class="text-medium-emphasis">{{ group.games.length }} игр</v-card-subtitle>
                  </v-card-item>
                  <v-card-text>
                    <p class="text-body-1 text-medium-emphasis mb-0">{{ group.description }}</p>
                  </v-card-text>
                  <v-card-actions>
                    <v-btn color="primary" size="large" variant="flat" @click.stop="selectedCategory = group.category">
                      Открыть папку
                      <v-icon end icon="mdi-folder-open-outline" />
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
          </section>

          <section v-else aria-label="Игры в папке">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-6">
              <div>
                <div class="text-overline text-secondary mb-1">Папка</div>
                <h2 class="text-h4 font-weight-bold mb-2">{{ selectedGroup.label }}</h2>
                <p class="text-body-1 text-medium-emphasis mb-0">{{ selectedGroup.description }}</p>
              </div>
              <v-btn color="secondary" prepend-icon="mdi-folder-multiple-outline" size="large" variant="tonal" @click="selectedCategory = null">
                Все папки
              </v-btn>
            </div>

            <v-row>
              <v-col v-for="game in selectedGroup.games" :key="game.id" cols="12" md="6" lg="4">
                <v-card class="gallery-game-card h-100 bg-surface text-on-surface" rounded="xl" variant="outlined">
                  <v-card-item>
                    <template #prepend>
                      <v-avatar color="primary" size="56">
                        <v-icon :icon="game.icon" size="32" />
                      </v-avatar>
                    </template>
                    <v-card-title class="text-high-emphasis">{{ game.title }}</v-card-title>
                    <v-card-subtitle class="text-medium-emphasis">{{ selectedGroup.label }}</v-card-subtitle>
                  </v-card-item>
                  <v-card-text>
                    <p class="text-body-1 text-medium-emphasis mb-4">{{ game.description }}</p>
                    <div class="d-flex flex-wrap ga-2">
                      <v-chip :color="game.status === 'planned' ? 'default' : 'primary'" size="small" variant="tonal">
                        {{ gameStatusLabels[game.status] }}
                      </v-chip>
                      <v-chip v-for="skill in game.skills" :key="skill" color="secondary" size="small" variant="tonal">
                        {{ gameSkillLabels[skill] }}
                      </v-chip>
                      <v-chip color="info" prepend-icon="mdi-timer-outline" size="small" variant="tonal">
                        {{ game.recommendedSessionSeconds }} сек
                      </v-chip>
                      <v-chip color="info" prepend-icon="mdi-target" size="small" variant="tonal">
                        цель {{ game.minTargetSizePx }} px
                      </v-chip>
                      <v-chip color="info" prepend-icon="mdi-clock-outline" size="small" variant="tonal">
                        dwell {{ game.defaultDwellMs }} мс
                      </v-chip>
                    </div>
                  </v-card-text>
                  <v-card-actions>
                    <v-btn
                      :to="gameRoute(game)"
                      :color="game.status === 'planned' ? 'secondary' : 'primary'"
                      size="large"
                      variant="flat"
                    >
                      {{ game.status === "planned" ? "Открыть план" : "Играть" }}
                      <v-icon end icon="mdi-arrow-right" />
                    </v-btn>
                  </v-card-actions>
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
    radial-gradient(circle at 10% 10%, rgb(216 154 114 / 18%), transparent 28rem),
    radial-gradient(circle at 90% 18%, rgb(111 143 168 / 18%), transparent 28rem),
    rgb(var(--v-theme-background));
  min-block-size: 100vh;
}

.gallery-card,
.gallery-folder-card,
.gallery-game-card {
  border: 1px solid rgb(93 127 120 / 15%);
}

.gallery-folder-card {
  cursor: pointer;
}
</style>
