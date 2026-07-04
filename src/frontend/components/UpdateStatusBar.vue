<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const version = ref("");
const available = ref(false);
const downloaded = ref(false);
const errorMessage = ref("");
const percent = ref(0);
let disposers: Dispose[] = [];

const visible = computed(() => available.value || downloaded.value || !!errorMessage.value);
const progressLabel = computed(() => `${percent.value.toFixed(0)}%`);

onMounted(async () => {
  if (!window.linkaUpdater) return;
  const appVersion = await window.linkaUpdater.getAppVersion();
  version.value = appVersion.version;
  const state = await window.linkaUpdater.getState();
  available.value = state.available;
  downloaded.value = state.downloaded;
  errorMessage.value = state.error;
  percent.value = state.percent;

  disposers = [
    window.linkaUpdater.onInfo((info) => {
      percent.value = info.percent;
    }),
    window.linkaUpdater.onAvailable(() => {
      available.value = true;
      downloaded.value = false;
      errorMessage.value = "";
      percent.value = 0;
    }),
    window.linkaUpdater.onDownloaded(() => {
      available.value = false;
      downloaded.value = true;
      errorMessage.value = "";
      percent.value = 100;
    }),
    window.linkaUpdater.onError((message) => {
      available.value = false;
      downloaded.value = false;
      errorMessage.value = message;
    })
  ];
});

onUnmounted(() => {
  for (const dispose of disposers) dispose();
  disposers = [];
});

function restartApp() {
  window.linkaUpdater?.restartApp();
}
</script>

<template>
  <v-snackbar :model-value="visible" location="bottom" color="surface" variant="elevated" :timeout="-1">
    <div class="d-flex flex-column ga-3">
      <div v-if="available" class="d-flex align-center ga-3">
        <v-icon color="primary" icon="mdi-download" />
        <div class="flex-grow-1">
          <div class="font-weight-bold">Загружается обновление Линка играй</div>
          <div class="text-body-2 text-medium-emphasis">Текущая версия: {{ version }}</div>
          <v-progress-linear class="mt-2" color="primary" height="0.5rem" rounded :model-value="percent" />
        </div>
        <v-chip color="primary" variant="tonal">{{ progressLabel }}</v-chip>
      </div>

      <div v-else-if="downloaded" class="d-flex flex-column flex-sm-row align-sm-center ga-3">
        <div class="flex-grow-1">
          <div class="font-weight-bold">Обновление готово</div>
          <div class="text-body-2 text-medium-emphasis">Перезапустите приложение, чтобы установить новую версию.</div>
        </div>
        <v-btn color="primary" prepend-icon="mdi-restart" variant="flat" @click="restartApp">
          Перезапустить
        </v-btn>
      </div>

      <div v-else-if="errorMessage" class="d-flex align-center ga-3">
        <v-icon color="error" icon="mdi-alert-circle-outline" />
        <div>
          <div class="font-weight-bold">Не удалось проверить обновление</div>
          <div class="text-body-2 text-medium-emphasis">{{ errorMessage }}</div>
        </div>
      </div>
    </div>
  </v-snackbar>
</template>
