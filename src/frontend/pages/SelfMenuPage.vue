<script setup lang="ts">
import { games } from "../data/games";
</script>

<template>
  <v-container class="py-10" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="8">
        <v-card class="pa-6 pa-md-10" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-6 mb-8">
            <div>
              <div class="text-overline text-secondary mb-2">Самостоятельный режим</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">Выбери игру</h1>
              <p class="text-h6 text-medium-emphasis mb-0">
                Посмотри на карточку. Можно играть спокойно, без спешки.
              </p>
            </div>
            <v-btn color="secondary" prepend-icon="mdi-arrow-left" size="large" to="/" variant="tonal">
              На старт
            </v-btn>
          </div>

          <v-row>
            <v-col v-for="game in games" :key="game.id" cols="12" sm="6" lg="4">
              <v-card class="h-100 pa-4" color="surface" rounded="xl" :to="game.route" variant="outlined">
                <v-avatar class="mb-4" color="primary" size="72">
                  <v-icon :icon="game.icon" size="42" />
                </v-avatar>
                <h2 class="text-h5 font-weight-bold mb-2">{{ game.title }}</h2>
                <p class="text-body-1 text-medium-emphasis mb-0">{{ game.selfDescription }}</p>
              </v-card>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
