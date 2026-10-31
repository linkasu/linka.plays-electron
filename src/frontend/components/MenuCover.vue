<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import type { GameCategoryId } from "../data/games";
import { resolvePublicAssetUrl } from "../core/publicAsset";
import { menuCoverFor, type MenuCoverLayer, type MenuCoverPath } from "../data/menuCovers";

const props = defineProps<{
  gameId?: string;
  categoryId?: GameCategoryId;
  mode?: "specialist" | "self";
}>();
const cover = computed(() => menuCoverFor(props));
const coverAspect = computed(() =>
  cover.value.kind === "layered" ? cover.value.aspectRatio : 0.8,
);
const compositionStyle = computed(() => ({ "--cover-aspect": String(coverAspect.value) }));
const rowStyle = computed(() => ({
  "--cover-count": String(cover.value.kind === "images" ? cover.value.paths.length : 1),
}));
const asset = (path: MenuCoverPath) => resolvePublicAssetUrl(`images/${path}`);
function layerStyle(layer: MenuCoverLayer): CSSProperties {
  return {
    left: `${layer.left}%`,
    top: `${layer.top}%`,
    width: `${layer.width}%`,
    height: `${layer.height}%`,
    transform: layer.mirror ? "scaleX(-1)" : undefined,
  };
}
</script>

<template>
  <div class="menu-cover" :data-cover-id="gameId ?? categoryId ?? mode" aria-hidden="true">
    <div v-if="cover.kind === 'images'" class="cover-row" :style="rowStyle">
      <img
        v-for="(path, index) in cover.paths"
        :key="`${index}:${path}`"
        :src="asset(path)"
        alt=""
        decoding="async"
        draggable="false"
      />
    </div>
    <div v-else-if="cover.kind === 'layered'" class="cover-composition" :style="compositionStyle">
      <img
        v-for="(layer, index) in cover.layers"
        :key="`${index}:${layer.path}`"
        class="cover-layer"
        :src="asset(layer.path)"
        :style="layerStyle(layer)"
        alt=""
        decoding="async"
        draggable="false"
      />
    </div>
    <!-- Same semantic assembly as BuildRobotGame: head+antenna, arms/body row, legs.
         The game has independent flex/grid slots, not unified sprite coordinates. -->
    <div v-else class="cover-composition cover-robot" :style="compositionStyle">
      <div class="robot-head">
        <img
          class="robot-antenna"
          :src="asset('build-robot/antenna.png')"
          alt=""
          draggable="false"
        />
        <img class="robot-face" :src="asset('build-robot/head.png')" alt="" draggable="false" />
      </div>
      <img class="robot-left" :src="asset('build-robot/arm-left.png')" alt="" draggable="false" />
      <img class="robot-body" :src="asset('build-robot/body.png')" alt="" draggable="false" />
      <img class="robot-right" :src="asset('build-robot/arm-right.png')" alt="" draggable="false" />
      <img class="robot-legs" :src="asset('build-robot/legs.png')" alt="" draggable="false" />
    </div>
  </div>
</template>

<style scoped>
/* The parent retains its existing button/card sizing. Only decorative content changes. */
.menu-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  pointer-events: none;
  container-type: size;
}
.menu-cover img {
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}
.cover-row {
  display: grid;
  grid-template-columns: repeat(var(--cover-count), minmax(0, 1fr));
  align-items: center;
  justify-items: center;
  inline-size: 90%;
  block-size: 100%;
  min-block-size: 0;
}
.cover-row > img {
  inline-size: 100%;
  block-size: 100%;
  min-inline-size: 0;
  min-block-size: 0;
}
.cover-composition {
  position: relative;
  flex: 0 0 auto;
  inline-size: min(100cqw, calc(100cqh * var(--cover-aspect)));
  block-size: min(100cqh, calc(100cqw / var(--cover-aspect)));
  aspect-ratio: var(--cover-aspect);
}
.cover-layer {
  position: absolute;
}
.cover-robot {
  display: grid;
  grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.45fr) minmax(0, 0.72fr);
  grid-template-rows: 34% 39% 27%;
  align-items: center;
  justify-items: center;
}
.cover-robot > img {
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  min-inline-size: 0;
}
.robot-head {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  block-size: 100%;
  inline-size: 100%;
}
.robot-head .robot-antenna {
  block-size: 34%;
  inline-size: auto;
  max-inline-size: 100%;
  margin-block-end: -6%;
}
.robot-head .robot-face {
  block-size: 72%;
  inline-size: 100%;
}
.robot-left {
  grid-column: 1;
  grid-row: 2;
}
.robot-body {
  grid-column: 2;
  grid-row: 2;
}
.robot-right {
  grid-column: 3;
  grid-row: 2;
}
.robot-legs {
  grid-column: 2;
  grid-row: 3;
}
</style>
