<script setup lang="ts">
import { computed } from "vue";
import { gameArtSrc } from "../core/gameArt";
import type { GameCategoryId } from "../data/games";

const props = defineProps<{
  gameId?: string;
  categoryId?: GameCategoryId;
  mode?: "specialist" | "self";
  icon?: string;
}>();
const categoryArt: Record<GameCategoryId, string> = {
  "gaze-basics": "clouds/cloud-1",
  "visual-search": "who-hiding/cat",
  "sequencing": "train-sequence/locomotive",
  "language-aac": "mini-dialog/mira",
  "numeracy": "light-gallery/flower",
  "strategy": "sokoban-large/crate",
  "continuous-control": "road-car/player-car",
};
const gameArt: Record<string, string[]> = {
  "feed-animal": ["feed-animal/bunny", "feed-animal/carrot"],
  "clouds": ["clouds/cloud-1"],
  "flowers": ["flowers/pink-open", "flowers/yellow-open"],
  "wake-owl": ["wake-owl/owl-awake"],
  "train-sequence": ["train-sequence/locomotive"],
  "robot-vacuum": ["robot-vacuum/robot-vacuum"],
  "who-hiding": ["who-hiding/cat"],
  "mini-dialog": ["mini-dialog/mira"],
  "road-car": ["road-car/player-car"],
};
const pictures = computed(() => {
  if (props.mode) return [props.mode === "specialist" ? "wake-owl/owl-awake" : "feed-animal/bunny"];
  if (props.categoryId) return [categoryArt[props.categoryId]];
  return props.gameId ? (gameArt[props.gameId] ?? []) : [];
});
</script>

<template>
  <div class="menu-cover" :class="{ 'menu-cover--pair': pictures.length > 1 }" aria-hidden="true">
    <div v-if="gameId === 'butterfly'" class="cover-butterfly">
      <img
        :src="gameArtSrc('butterfly/orange-wing-left')"
        class="cover-wing cover-wing--left"
        alt=""
        draggable="false"
      />
      <img
        :src="gameArtSrc('butterfly/orange-wing-left')"
        class="cover-wing cover-wing--right"
        alt=""
        draggable="false"
      />
      <img :src="gameArtSrc('butterfly/body')" class="cover-body" alt="" draggable="false" />
    </div>
    <img
      v-for="picture in pictures"
      :key="picture"
      :src="gameArtSrc(picture)"
      alt=""
      draggable="false"
    />
    <v-icon
      v-if="!pictures.length && gameId !== 'butterfly'"
      :icon="icon ?? 'mdi-puzzle-heart-outline'"
      class="cover-icon"
    />
  </div>
</template>

<style scoped>
.menu-cover {
  display: flex;
  justify-content: center;
  align-items: center;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  pointer-events: none;
}
.menu-cover > img {
  max-block-size: 100%;
  max-inline-size: 90%;
  object-fit: contain;
}
.menu-cover--pair > img {
  max-inline-size: 48%;
}
.cover-icon {
  font-size: clamp(3rem, 8dvh, 5rem);
  color: rgb(var(--v-theme-primary));
}
.cover-butterfly {
  position: relative;
  block-size: 100%;
  aspect-ratio: 1.2;
}
.cover-wing {
  position: absolute;
  block-size: 100%;
  inline-size: 50%;
  object-fit: contain;
}
.cover-wing--left {
  inset-inline-end: 50%;
}
.cover-wing--right {
  inset-inline-start: 50%;
  transform: scaleX(-1);
}
.cover-body {
  position: absolute;
  block-size: 71%;
  inline-size: 25%;
  object-fit: contain;
  inset-block-start: 15%;
  inset-inline-start: 37.5%;
}
</style>
