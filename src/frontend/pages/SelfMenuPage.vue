<script setup lang="ts">
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { groupGamesByCategory } from "../data/games";

const gameGroups = groupGamesByCategory();
</script>

<template>
  <v-container class="py-10" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="8">
        <v-card class="pa-6 pa-md-10" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-start justify-space-between ga-6 mb-8">
            <div>
              <div class="text-overline text-secondary mb-2">Самостоятельный режим</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">Выбери игру</h1>
              <p class="text-h6 text-medium-emphasis mb-0">
                Посмотри на большую карточку. Можно играть спокойно, без спешки.
              </p>
            </div>
            <TobiiStatusBadge />
          </div>

          <div class="d-flex flex-wrap ga-3 mb-8">
            <v-btn color="secondary" prepend-icon="mdi-eye-settings" size="large" to="/tobii-calibration" variant="tonal">
              Проверить взгляд
            </v-btn>
            <v-btn color="primary" prepend-icon="mdi-clipboard-heart-outline" size="large" to="/menu/specialist" variant="text">
              Режим специалиста
            </v-btn>
            <v-btn color="secondary" prepend-icon="mdi-home-heart" size="large" to="/" variant="text">
              На старт
            </v-btn>
          </div>

          <section v-for="group in gameGroups" :key="group.category" class="mb-10">
            <div class="mb-4">
              <div class="text-overline text-primary mb-1">Папка</div>
              <h2 class="text-h4 text-md-h3 font-weight-bold mb-2">{{ group.selfLabel }}</h2>
              <p class="text-h6 text-medium-emphasis mb-0">{{ group.selfDescription }}</p>
            </div>

            <v-row align="stretch">
              <v-col v-for="game in group.games" :key="game.id" cols="12" md="6" xl="4">
                <v-card
                  class="h-100 pa-5 d-flex flex-column"
                  color="surface"
                  min-height="240"
                  rounded="xl"
                  :to="game.route"
                  variant="outlined"
                >
                  <v-avatar class="mb-5" color="primary" size="88">
                    <v-icon :icon="game.icon" size="52" />
                  </v-avatar>
                  <h3 class="text-h4 font-weight-bold mb-3">{{ game.title }}</h3>
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
