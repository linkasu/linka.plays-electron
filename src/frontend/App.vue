<script setup lang="ts">
import UpdateStatusBar from "./components/UpdateStatusBar.vue";
</script>

<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>
    <UpdateStatusBar />
  </v-app>
</template>
