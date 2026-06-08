<script setup lang="ts">
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { games } from "../data/games";
</script>

<template>
  <v-container class="py-10" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="8">
        <v-card class="pa-6 pa-md-10" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-6 mb-8">
            <div>
              <div class="text-overline text-secondary mb-2">LINKa plays MVP</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">Игры взглядом</h1>
              <p class="text-h6 text-medium-emphasis mb-0">
                Первый Electron/Vue старт: меню, Tobii-ready input и canvas-игра.
              </p>
            </div>
            <TobiiStatusBadge />
          </div>

          <div class="d-flex flex-wrap ga-3 mb-8">
            <v-btn color="secondary" prepend-icon="mdi-eye-settings" size="large" to="/tobii-calibration" variant="flat">
              Калибровка Tobii
            </v-btn>
          </div>

          <v-row>
            <v-col v-for="game in games" :key="game.id" cols="12" md="6" lg="4">
              <v-card class="h-100" color="surface" rounded="xl" variant="outlined">
                <v-card-item>
                  <template #prepend>
                    <v-avatar color="primary" size="56">
                      <v-icon :icon="game.icon" size="32" />
                    </v-avatar>
                  </template>
                  <v-card-title>{{ game.title }}</v-card-title>
                  <v-card-subtitle>{{ game.category }}</v-card-subtitle>
                </v-card-item>
                <v-card-text class="text-body-1">{{ game.description }}</v-card-text>
                <v-card-actions>
                  <v-btn :to="game.route" color="primary" size="large" variant="flat">
                    Играть
                    <v-icon end icon="mdi-arrow-right" />
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
