<script setup lang="ts">
import AudioUnlockGate from "./components/AudioUnlockGate.vue";
import UpdateStatusBar from "./components/UpdateStatusBar.vue";
</script>

<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>
    <UpdateStatusBar />
    <AudioUnlockGate />
  </v-app>
</template>
