<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../components/game/GameDwellButton.vue";
import GazePointerOverlay from "../components/game/GazePointerOverlay.vue";
import MenuCover from "../components/MenuCover.vue";
import TobiiStatusBadge from "../components/TobiiStatusBadge.vue";
import { useDwellSettings } from "../core/dwellSettings";
import { rememberMenuMode, type MenuMode } from "../core/menuMode";

const router = useRouter();
const { dwellMs } = useDwellSettings();
const telemetryPreference = ref<TelemetryPrivacyPreference>("unknown");
const privacyDialog = ref(true);
const privacyLoading = ref(true);
const privacySaving = ref(false);
const privacyError = ref("");
const buildLabel = ref("");
const privacyRequired = computed(
  () => privacyLoading.value || telemetryPreference.value === "unknown",
);
const privacyStatusLabel = computed(() =>
  telemetryPreference.value === "enabled"
    ? "Аналитика включена"
    : telemetryPreference.value === "disabled"
      ? "Аналитика отключена"
      : "Настроить аналитику",
);

onMounted(async () => {
  void window.linkaUpdater
    ?.getAppVersion()
    .then(({ version, buildSha }) => {
      buildLabel.value = `${version}${buildSha ? ` · ${buildSha.slice(0, 7)}` : ""}`;
    })
    .catch(() => undefined);
  if (!window.linkaPrivacy) {
    telemetryPreference.value = "disabled";
    privacyLoading.value = false;
    privacyDialog.value = false;
    return;
  }
  try {
    telemetryPreference.value = await window.linkaPrivacy.getTelemetryPreference();
    privacyDialog.value = telemetryPreference.value === "unknown";
  } catch {
    privacyError.value =
      "Не удалось прочитать настройку. Аналитика не будет включена без вашего выбора.";
  } finally {
    privacyLoading.value = false;
  }
});

async function chooseTelemetryPreference(preference: TelemetryPrivacyDecision) {
  if (!window.linkaPrivacy || privacySaving.value) return;
  privacySaving.value = true;
  privacyError.value = "";
  try {
    telemetryPreference.value = await window.linkaPrivacy.setTelemetryPreference(preference);
    privacyDialog.value = false;
  } catch {
    privacyError.value = "Не удалось сохранить настройку. Попробуйте ещё раз.";
  } finally {
    privacySaving.value = false;
  }
}

function openMode(mode: MenuMode) {
  if (privacyRequired.value) return;
  rememberMenuMode(mode);
  router.push(mode === "self" ? "/menu/self" : "/menu/specialist");
}
</script>

<template>
  <v-container class="gallery-menu start-page" fluid>
    <GazePointerOverlay />
    <div class="start-frame">
      <header class="start-header">
        <div class="app-wordmark">Линка.<br /><span>Играй</span><v-icon icon="mdi-leaf" /></div>
        <div class="start-heading">
          <h1>Игры для взгляда</h1>
          <p>Выбери, как играть</p>
        </div>
        <TobiiStatusBadge />
      </header>

      <div class="start-modes">
        <v-card
          class="mode-card"
          color="surface"
          tag="button"
          type="button"
          :disabled="privacyRequired"
          @click="openMode('specialist')"
        >
          <div class="start-mode">
            <div class="mode-illustration"><MenuCover mode="specialist" /></div>
            <h2>Специалист</h2>
            <p>Настройте занятие и выберите игры</p>
            <span class="start-action">Настроить игру <v-icon icon="mdi-arrow-right" /></span>
          </div>
        </v-card>
        <GameDwellButton
          class="self-mode"
          target-id="start-self"
          :disabled="privacyRequired || privacyDialog"
          :dwell-ms="dwellMs"
          min-height="0"
          color="surface"
          @select="openMode('self')"
        >
          <div class="start-mode">
            <div class="mode-illustration"><MenuCover mode="self" /></div>
            <h2>Самостоятельно</h2>
            <p>Крупные карточки и выбор взглядом</p>
            <span class="start-action">Играть <v-icon icon="mdi-arrow-right" /></span>
          </div>
        </GameDwellButton>
      </div>

      <footer class="start-tools">
        <v-btn
          color="surface"
          prepend-icon="mdi-eye-settings"
          to="/tobii-calibration"
          variant="flat"
          >Проверить Tobii</v-btn
        >
        <v-btn color="surface" prepend-icon="mdi-crosshairs-gps" to="/gaze-debug" variant="flat"
          >Debug взгляда</v-btn
        >
        <v-btn
          color="surface"
          prepend-icon="mdi-shield-check-outline"
          variant="flat"
          @click="privacyDialog = true"
          >{{ privacyStatusLabel }}</v-btn
        >
        <v-btn
          color="surface"
          prepend-icon="mdi-file-document-outline"
          href="https://plays-metric.nkolinka.ru/privacy"
          rel="noopener noreferrer"
          target="_blank"
          variant="flat"
          >Политика аналитики</v-btn
        >
      </footer>
      <div v-if="buildLabel" class="build-label">Версия {{ buildLabel }}</div>
    </div>

    <v-dialog
      v-model="privacyDialog"
      max-width="min(44rem, 94vw)"
      :persistent="privacyRequired"
      scrollable
    >
      <v-card class="pa-2 pa-sm-4" rounded="xl">
        <v-card-title class="text-h5 text-sm-h4 font-weight-bold text-wrap"
          >Помогите улучшать LINKa plays</v-card-title
        >
        <v-card-text class="text-body-1">
          <p class="mb-4">
            Выберите, разрешаете ли вы обезличенную аналитику. До выбора приложение ничего не
            собирает и не отправляет. Настройку можно изменить здесь позже.
          </p>
          <v-list bg-color="transparent" density="compact">
            <v-list-item
              lines="two"
              prepend-icon="mdi-chart-box-outline"
              title="Что передаётся"
              subtitle="Версия приложения и ОС, экраны и режим, настройки dwell, состояния Tobii и обновления, агрегированные результаты и длительность сессий."
            />
            <v-list-item
              lines="three"
              prepend-icon="mdi-shield-lock-outline"
              title="Что не передаётся"
              subtitle="Имена и контакты, тексты и фразы, ответы, координаты взгляда или указателя, идентификаторы целей, игровые доски, пути файлов, сообщения и стеки ошибок."
            />
            <v-list-item
              lines="two"
              prepend-icon="mdi-database-clock-outline"
              title="Хранение"
              subtitle="До отключения принятые обезличенные данные хранятся без автоматического срока удаления."
            />
            <v-list-item
              lines="three"
              prepend-icon="mdi-delete-sweep-outline"
              title="Если отключить"
              subtitle="Сбор и отправка прекратятся, локальная очередь будет удалена, а сервер заблокирует новые события и поставит ранее принятые данные на удаление."
            />
          </v-list>
          <a
            href="https://plays-metric.nkolinka.ru/privacy"
            rel="noopener noreferrer"
            target="_blank"
            >Полная политика аналитики</a
          >
          <v-alert v-if="privacyError" class="mt-4" type="error" variant="tonal">{{
            privacyError
          }}</v-alert>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0 flex-wrap ga-2">
          <v-btn
            v-if="!privacyRequired"
            :disabled="privacySaving"
            size="large"
            variant="text"
            @click="privacyDialog = false"
            >Отмена</v-btn
          >
          <v-spacer />
          <v-btn
            :disabled="privacyLoading"
            :loading="privacySaving"
            size="large"
            variant="tonal"
            @click="chooseTelemetryPreference('disabled')"
            >Не отправлять</v-btn
          >
          <v-btn
            color="primary"
            :disabled="privacyLoading"
            :loading="privacySaving"
            size="large"
            @click="chooseTelemetryPreference('enabled')"
            >Включить аналитику</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.start-page {
  min-block-size: 100dvh;
  padding: clamp(0.8rem, 2.5dvh, 2rem) clamp(1rem, 4vw, 5rem);
  overflow: auto;
}
.start-frame {
  max-inline-size: 86rem;
  margin-inline: auto;
  min-block-size: calc(100dvh - 5dvh);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: clamp(0.75rem, 2.2dvh, 1.6rem);
}
.start-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
}
.start-header > :last-child {
  justify-self: end;
}
.app-wordmark {
  color: rgb(var(--v-theme-primary));
  font-size: clamp(1.35rem, 3.4dvh, 2.5rem);
  font-weight: 900;
  line-height: 0.95;
  inline-size: max-content;
  background: var(--linka-panel);
  border-radius: 40%;
  padding: 0.8rem 1.1rem;
}
.app-wordmark span {
  font-size: 0.8em;
}
.app-wordmark .v-icon {
  font-size: 0.6em;
  margin-inline-start: 0.2rem;
}
.start-heading {
  text-align: center;
  padding: 0.6rem 1.4rem;
  border-radius: 3rem;
  background: var(--linka-panel);
}
.start-heading h1 {
  font-size: clamp(1.8rem, 5.8dvh, 4rem);
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: -0.04em;
}
.start-heading p {
  font-size: clamp(1rem, 2.6dvh, 1.6rem);
  margin-block-start: 0.4rem;
  font-weight: 600;
}
.start-modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(1.2rem, 2.5vw, 2rem);
  inline-size: min(100%, 70rem);
  align-self: center;
}
.start-mode {
  padding: clamp(0.9rem, 2dvh, 1.5rem);
  padding-block-end: 2.1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  inline-size: 100%;
  block-size: 100%;
  color: rgb(var(--v-theme-on-surface));
}
.mode-card {
  cursor: pointer;
  padding: 0;
}
.mode-illustration {
  inline-size: 100%;
  block-size: clamp(7rem, 29dvh, 20rem);
  margin-block-end: 0.75rem;
}
.start-mode h2 {
  font-size: clamp(1.35rem, 3.7dvh, 2.7rem);
  line-height: 1.1;
  font-weight: 900;
}
.start-mode p {
  font-size: clamp(0.9rem, 2dvh, 1.25rem);
  line-height: 1.3;
  margin-block: 0.6rem 1rem;
}
.start-action {
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
  border-radius: 2rem;
  padding: 0.7rem 1rem;
  inline-size: 100%;
  font-size: clamp(1.15rem, 3dvh, 2rem);
  font-weight: 800;
  margin-block-start: auto;
}
.self-mode :deep(.dwell-button) {
  padding: 0 !important;
  block-size: 100%;
}
.start-tools {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: clamp(0.5rem, 1vw, 1rem);
  margin-block-start: 0.35rem;
}
.start-tools .v-btn {
  min-block-size: clamp(2.8rem, 6.5dvh, 4rem);
  border: 0.1rem solid var(--linka-outline);
  box-shadow: var(--linka-shadow);
  font-size: clamp(0.8rem, 1.6dvh, 1rem);
}
.build-label {
  text-align: center;
  font-size: 0.75rem;
}
@media (max-width: 40rem) {
  .start-header {
    grid-template-columns: auto 1fr;
  }
  .start-heading {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .start-modes {
    grid-template-columns: 1fr;
  }
}
@media (max-height: 43rem) and (min-width: 40rem) {
  .mode-illustration {
    block-size: 22dvh;
  }
  .start-frame {
    gap: 0.7rem;
  }
}
</style>
