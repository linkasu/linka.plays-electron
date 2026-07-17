<script setup lang="ts">
import MatchSameGame from "../match-same/MatchSameGame.vue";
import { WHO_IS_THIS_CHILD_TITLE } from "./model";
</script>

<template>
  <MatchSameGame game-id="who-is-this" :title="WHO_IS_THIS_CHILD_TITLE" />
</template>
