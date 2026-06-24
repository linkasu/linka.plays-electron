<script setup lang="ts">
import { computed } from "vue";
import { games, resolveGameStabilityStatus } from "./data/games";

const reviewCounter = computed(() => {
  const visibleGames = games.filter((game) => resolveGameStabilityStatus(game) !== "archived");
  const readyGames = visibleGames.filter((game) => resolveGameStabilityStatus(game) === "publish");
  return {
    ready: readyGames.length,
    total: visibleGames.length
  };
});
</script>

<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>

    <div class="review-counter" aria-label="Временный счётчик проверки игр">
      Игры: {{ reviewCounter.ready }} / {{ reviewCounter.total }}
    </div>
  </v-app>
</template>

<style scoped>
.review-counter {
  background: rgb(var(--v-theme-primary));
  border-radius: 999rem;
  box-shadow: 0 0.25rem 1rem rgb(0 0 0 / 18%);
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.8125rem;
  font-weight: 700;
  inset-block-end: max(0.75rem, env(safe-area-inset-bottom));
  inset-inline-end: max(0.75rem, env(safe-area-inset-right));
  letter-spacing: 0.02em;
  opacity: 0.82;
  padding: 0.375rem 0.75rem;
  pointer-events: none;
  position: fixed;
  z-index: 10000;
}
</style>
