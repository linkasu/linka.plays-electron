<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import GameDwellButton from "./game/GameDwellButton.vue";

const version = ref("");
const available = ref(false);
const downloaded = ref(false);
const errorMessage = ref("");
const percent = ref(0);
const dismissed = ref(false);
let disposers: Dispose[] = [];
let disposed = false;
let receivedEvent = false;
let receivedProgress = false;

const visible = computed(
  () => !dismissed.value && (available.value || downloaded.value || !!errorMessage.value),
);
const progressLabel = computed(() => `${percent.value.toFixed(0)}%`);

function showError(message: string) {
  dismissed.value = false;
  available.value = false;
  downloaded.value = false;
  percent.value = 0;
  errorMessage.value = message;
}

onMounted(() => {
  const updater = window.linkaUpdater;
  if (!updater) return;
  disposers = [
    updater.onInfo((info) => {
      receivedProgress = true;
      percent.value = info.percent;
    }),
    updater.onAvailable(() => {
      receivedEvent = true;
      dismissed.value = false;
      available.value = true;
      downloaded.value = false;
      errorMessage.value = "";
      percent.value = 0;
    }),
    updater.onDownloaded(() => {
      receivedEvent = true;
      dismissed.value = false;
      available.value = false;
      downloaded.value = true;
      errorMessage.value = "";
      percent.value = 100;
    }),
    updater.onError((message) => {
      receivedEvent = true;
      showError(message);
    }),
  ];
  void updater
    .getAppVersion()
    .then((appVersion) => {
      if (!disposed) version.value = appVersion.version;
    })
    .catch(() => {
      // Version metadata is optional; a rejected IPC must not disable update notifications.
    });
  void updater
    .getState()
    .then((state) => {
      if (disposed || receivedEvent) return;
      available.value = state.available;
      downloaded.value = state.downloaded;
      errorMessage.value = state.error;
      if (!receivedProgress) percent.value = state.percent;
    })
    .catch(() => {
      if (!disposed && !receivedEvent) showError("IPC_ERROR");
    });
});

onUnmounted(() => {
  disposed = true;
  for (const dispose of disposers) dispose();
  disposers = [];
});
</script>

<template>
  <v-snackbar
    :model-value="visible"
    location="bottom"
    color="surface"
    variant="elevated"
    :timeout="-1"
  >
    <div class="d-flex flex-column ga-3">
      <div v-if="available" class="d-flex align-center ga-3">
        <v-icon color="primary" icon="mdi-download" />
        <div class="flex-grow-1">
          <div class="font-weight-bold">Загружается обновление Линка играй</div>
          <div class="text-body-2 text-medium-emphasis">Текущая версия: {{ version }}</div>
          <v-progress-linear
            class="mt-2"
            color="primary"
            height="0.5rem"
            rounded
            :model-value="percent"
          />
        </div>
        <v-chip color="primary" variant="tonal">{{ progressLabel }}</v-chip>
      </div>

      <div v-else-if="downloaded" class="d-flex flex-column flex-sm-row align-sm-center ga-3">
        <div class="flex-grow-1">
          <div class="font-weight-bold">Обновление готово</div>
          <div class="text-body-2 text-medium-emphasis">
            Новая версия установится после завершения работы. При следующем запуске она будет
            готова.
          </div>
        </div>
      </div>

      <div v-else-if="errorMessage" class="d-flex align-center ga-3">
        <v-icon color="error" icon="mdi-alert-circle-outline" />
        <div>
          <div class="font-weight-bold">Не удалось обновить приложение</div>
          <div class="text-body-2 text-medium-emphasis">Можно продолжать играть.</div>
        </div>
      </div>
    </div>
    <template #actions>
      <GameDwellButton
        v-if="visible"
        target-id="update-status-close"
        min-height="5.5rem"
        :priority="100"
        color="primary"
        @select="dismissed = true"
      >
        Закрыть
      </GameDwellButton>
    </template>
  </v-snackbar>
</template>
