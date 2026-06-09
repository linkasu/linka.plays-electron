<script setup lang="ts">
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
</script>

<template>
  <v-container class="py-10" fluid>
    <v-row justify="center">
      <v-col cols="12" lg="10" xl="8">
        <v-card class="pa-6 pa-md-10" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-start justify-space-between ga-6 mb-10">
            <div>
              <div class="text-overline text-secondary mb-2">LINKa plays</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-4">Тихие игры для взгляда</h1>
              <p class="text-h6 text-medium-emphasis mb-0">
                Спокойные задания помогают тренировать фиксацию, выбор, внимание, слова и счёт. Выберите режим,
                проверьте взгляд и откройте подходящую игру без спешки.
              </p>
            </div>
            <TobiiStatusBadge />
          </div>

          <v-row class="mb-8" align="stretch">
            <v-col cols="12" md="6">
              <v-card class="h-100 pa-5" color="surface" rounded="xl" variant="tonal">
                <v-avatar class="mb-5" color="primary" size="72">
                  <v-icon icon="mdi-clipboard-heart-outline" size="40" />
                </v-avatar>
                <h2 class="text-h4 font-weight-bold mb-3">Специалист</h2>
                <p class="text-body-1 text-medium-emphasis mb-6">
                  Подробный каталог: навыки, длительность, статус готовности и параметры занятия для взрослого.
                </p>
                <v-btn block color="primary" size="x-large" to="/menu/specialist" variant="flat">
                  Открыть режим специалиста
                </v-btn>
              </v-card>
            </v-col>

            <v-col cols="12" md="6">
              <v-card class="h-100 pa-5" color="secondary" rounded="xl" variant="tonal">
                <v-avatar class="mb-5" color="secondary" size="72" variant="flat">
                  <v-icon icon="mdi-eye-heart-outline" size="40" />
                </v-avatar>
                <h2 class="text-h4 font-weight-bold mb-3">Самостоятельно</h2>
                <p class="text-body-1 text-medium-emphasis mb-6">
                  Крупные спокойные карточки, меньше текста и больше пространства для выбора взглядом.
                </p>
                <v-btn block color="secondary" size="x-large" to="/menu/self" variant="flat">
                  Играть самостоятельно
                </v-btn>
              </v-card>
            </v-col>
          </v-row>

          <div class="d-flex flex-wrap align-center ga-3">
            <v-btn color="secondary" prepend-icon="mdi-eye-settings" size="large" to="/tobii-calibration" variant="tonal">
              Проверить Tobii
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
