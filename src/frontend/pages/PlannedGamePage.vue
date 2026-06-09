<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { resolveMenuRoute } from "../core/menuMode";
import { findGame, gameCategories, gameSkillLabels } from "../data/games";

const route = useRoute();
const game = computed(() => findGame(route.params.gameId));
const menuRoute = computed(() => resolveMenuRoute());
</script>

<template>
  <v-container class="py-10" fluid>
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <v-card class="pa-6 pa-md-10" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-6 mb-8">
            <div>
              <div class="text-overline text-secondary mb-2">Игра в разработке</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">
                {{ game?.title ?? "Неизвестная игра" }}
              </h1>
              <p class="text-h6 text-medium-emphasis mb-0">
                {{ game?.description ?? "Такой игры нет в текущем каталоге." }}
              </p>
            </div>
            <TobiiStatusBadge />
          </div>

          <template v-if="game">
            <div class="d-flex flex-wrap ga-2 mb-8">
              <v-chip color="primary" variant="flat">
                {{ gameCategories[game.category] ?? game.category }}
              </v-chip>
              <v-chip v-for="skill in game.skills" :key="skill" color="secondary" variant="tonal">
                {{ gameSkillLabels[skill] }}
              </v-chip>
              <v-chip color="info" variant="tonal">
                {{ game.recommendedSessionSeconds }} сек
              </v-chip>
            </div>

            <v-alert class="mb-8" color="info" icon="mdi-hammer-wrench" variant="tonal">
              Игра уже описана в документации и добавлена в каталог. Реализация будет подключена отдельной игровой веткой.
            </v-alert>
          </template>

          <div class="d-flex flex-wrap ga-3">
            <v-btn color="primary" prepend-icon="mdi-arrow-left" size="large" :to="menuRoute" variant="flat">
              В меню
            </v-btn>
            <v-btn color="secondary" prepend-icon="mdi-eye-settings" size="large" to="/tobii-calibration" variant="tonal">
              Проверить Tobii
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
