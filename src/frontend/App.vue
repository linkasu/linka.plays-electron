<script setup lang="ts">
import { ref } from "vue";
import AudioUnlockGate from "./components/AudioUnlockGate.vue";
import UpdateStatusBar from "./components/UpdateStatusBar.vue";

// Страницы монтируются только после экрана звука, см. AudioUnlockGate.vue.
const audioReady = ref(false);
</script>

<template>
  <v-app>
    <v-main>
      <router-view v-if="audioReady" />
    </v-main>
    <UpdateStatusBar />
    <AudioUnlockGate @ready="audioReady = true" />
  </v-app>
</template>
