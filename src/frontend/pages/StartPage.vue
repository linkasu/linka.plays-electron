<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../components/game/GameDwellButton.vue";
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { useDwellSettings } from "../core/dwellSettings";
import { rememberMenuMode, type MenuMode } from "../core/menuMode";

const router = useRouter();
const { dwellMs } = useDwellSettings();
const privacyPolicyVersion = "2026-07-18-v1";
const privacyStorageKey = "linka-metrics-privacy-version";
const privacyDialog = ref(readAcceptedPolicyVersion() !== privacyPolicyVersion);

function readAcceptedPolicyVersion() {
  try {
    return window.localStorage.getItem(privacyStorageKey);
  } catch {
    return null;
  }
}

function continueWithMetrics() {
  try {
    window.localStorage.setItem(privacyStorageKey, privacyPolicyVersion);
  } catch {
    // The notice will be shown again if local storage is unavailable.
  }
  privacyDialog.value = false;
}

function openMode(mode: MenuMode) {
  if (privacyDialog.value) return;
  rememberMenuMode(mode);
  router.push(mode === "self" ? "/menu/self" : "/menu/specialist");
}
</script>

<template>
  <v-container class="gallery-menu pa-4 pa-md-6" fluid>
    <v-row class="h-100" justify="center" align="center">
      <v-col cols="12" lg="11" xl="10">
        <v-card class="gallery-card pa-5 pa-md-8" rounded="xl" elevation="8">
          <div class="d-flex flex-column flex-md-row align-md-start justify-space-between ga-4 mb-6">
            <div>
              <div class="text-overline text-secondary mb-2">LINKa plays</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">Игры для взгляда</h1>
              <p class="text-h6 text-medium-emphasis mb-0">Специалист выбирает рукой. Самостоятельный режим выбирается взглядом.</p>
            </div>
            <TobiiStatusBadge />
          </div>

          <v-row class="mb-5" align="stretch">
            <v-col cols="12" sm="6">
              <v-card class="mode-card h-100 pa-5 d-flex flex-column" color="surface" :disabled="privacyDialog" min-height="clamp(14rem, 36dvh, 22rem)" rounded="xl" variant="tonal" @click="openMode('specialist')">
                <v-avatar class="mb-5" color="primary" size="72">
                  <v-icon icon="mdi-clipboard-text-outline" size="40" />
                </v-avatar>
                <h2 class="text-h4 font-weight-bold mb-3">Специалист</h2>
                <p class="text-h6 text-medium-emphasis mb-4">Каталог по целям занятия, параметрам и готовности игр. Открывается рукой.</p>
                <v-spacer />
                <div class="d-flex align-center ga-2 text-primary font-weight-bold text-h6">
                  <span>Открыть каталог</span>
                  <v-icon icon="mdi-arrow-right" />
                </div>
              </v-card>
            </v-col>

            <v-col cols="12" sm="6">
              <GameDwellButton target-id="start-self" :disabled="privacyDialog" :dwell-ms="dwellMs" min-height="clamp(14rem, 36dvh, 22rem)" color="secondary" @select="openMode('self')">
                <template #default>
                  <div class="d-flex flex-column align-start h-100 text-white">
                    <v-avatar class="mb-5" color="secondary" size="72" variant="flat">
                      <v-icon icon="mdi-eye-outline" size="40" />
                    </v-avatar>
                    <h2 class="text-h4 font-weight-bold mb-3">Самостоятельно</h2>
                    <p class="text-h6 mb-4">Большие карточки, меньше текста, выбор взглядом без скролла.</p>
                    <v-spacer />
                    <div class="d-flex align-center ga-2 font-weight-bold text-h6">
                      <span>Играть</span>
                      <v-icon icon="mdi-arrow-right" />
                    </div>
                  </div>
                </template>
              </GameDwellButton>
            </v-col>
          </v-row>

          <div class="d-flex flex-wrap align-center ga-3">
            <v-btn color="secondary" prepend-icon="mdi-eye-settings" size="large" to="/tobii-calibration" variant="tonal">
              Проверить Tobii
            </v-btn>
            <v-btn color="primary" prepend-icon="mdi-crosshairs-gps" size="large" to="/gaze-debug" variant="tonal">
              Debug взгляда
            </v-btn>
            <v-btn href="https://plays-metric.nkolinka.ru/privacy" rel="noopener noreferrer" target="_blank" variant="text">
              Политика аналитики
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog :model-value="privacyDialog" max-width="min(44rem, 94vw)" persistent>
      <v-card class="pa-2 pa-sm-4" rounded="xl">
        <v-card-title class="text-h5 text-sm-h4 font-weight-bold text-wrap">Обезличенная аналитика</v-card-title>
        <v-card-text class="text-body-1">
          <p class="mb-4">В LINKa plays всегда включена обезличенная аналитика. Она помогает оценивать стабильность приложения и игровых сессий.</p>
          <v-list bg-color="transparent" density="compact">
            <v-list-item lines="two" prepend-icon="mdi-chart-box-outline" title="Что передаётся" subtitle="Версия приложения и ОС, экраны и режим, настройки dwell, состояния Tobii и обновления, агрегированные результаты и длительность сессий." />
            <v-list-item lines="three" prepend-icon="mdi-shield-lock-outline" title="Что не передаётся" subtitle="Имена и контакты, тексты и фразы, ответы, координаты взгляда или указателя, идентификаторы целей, игровые доски, пути файлов, сообщения и стеки ошибок." />
            <v-list-item lines="two" prepend-icon="mdi-database-clock-outline" title="Хранение" subtitle="Данные хранятся бессрочно, автоматическое удаление и удаление по запросу не предусмотрены." />
          </v-list>
          <a href="https://plays-metric.nkolinka.ru/privacy" rel="noopener noreferrer" target="_blank">Полная политика аналитики</a>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn color="primary" size="large" @click="continueWithMetrics">Продолжить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.gallery-menu {
  background:
    radial-gradient(circle at 12% 8%, rgb(216 154 114 / 22%), transparent 28rem),
    radial-gradient(circle at 88% 14%, rgb(139 123 184 / 18%), transparent 26rem),
    rgb(var(--v-theme-background));
  min-block-size: 100dvh;
  overflow: auto;
}

.gallery-card,
.mode-card,
:deep(.dwell-button) {
  border: 0.0625rem solid rgb(93 127 120 / 16%);
}

.mode-card {
  cursor: pointer;
}
</style>
