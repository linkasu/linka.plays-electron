<script setup lang="ts">
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSession } from "../../core/session";

type Ring = { id: string; size: number; color: string; placed: boolean };

const router = useRouter();
const { session, durationMs, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("pyramid", {
  maxSteps: 4,
  dwellMs: 1200,
  sessionSeconds: 120
});

const rings = reactive<Ring[]>([]);
const resultVisible = computed(() => session.status === "finished");
const nextRing = computed(() => rings.filter((ring) => !ring.placed).sort((a, b) => b.size - a.size)[0]);

function resetRings() {
  rings.splice(0, rings.length,
    { id: "ring-1", size: 240, color: "#ff8a65", placed: false },
    { id: "ring-2", size: 200, color: "#ffd54f", placed: false },
    { id: "ring-3", size: 160, color: "#4fc3f7", placed: false },
    { id: "ring-4", size: 120, color: "#9575cd", placed: false }
  );
}

function chooseRing(ring: Ring) {
  if (session.status !== "running" || ring.placed) return;
  if (ring.id === nextRing.value?.id) {
    ring.placed = true;
    recordSuccess({ targetId: ring.id });
  } else {
    recordMistake({ expected: nextRing.value?.id, actual: ring.id });
  }
}

function restart() {
  startSession();
  resetRings();
}

resetRings();
</script>

<template>
  <div class="pyramid-shell">
    <GameHud title="Пирамидка" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10">
          <v-card class="pa-6 pa-md-8" rounded="xl" elevation="8">
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-8">Собери пирамидку от большого кольца к маленькому</h1>
            <div class="play-area">
              <div class="stack">
                <div class="pole" />
                <div v-for="ring in rings.filter((item) => item.placed).sort((a, b) => b.size - a.size)" :key="`placed-${ring.id}`" class="stack-ring" :style="{ inlineSize: `${ring.size}px`, background: ring.color }" />
              </div>
              <div class="rings">
                <GameDwellButton v-for="ring in rings" :key="ring.id" :disabled="session.status !== 'running' || ring.placed" :dwell-ms="session.settings.dwellMs" :min-height="130" @select="chooseRing(ring)">
                  <template #default>
                    <div class="loose-ring" :style="{ inlineSize: `${ring.size}px`, background: ring.color, opacity: ring.placed ? 0.25 : 1 }" />
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Пирамидка" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :recommendation="recommendation" @menu="router.push('/')" @restart="restart" />
  </div>
</template>

<style scoped>
.pyramid-shell {
  background: linear-gradient(135deg, #fff8e1 0%, #f1f0ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.play-area {
  align-items: center;
  display: grid;
  gap: 32px;
  grid-template-columns: 1fr 1.4fr;
}

.stack {
  align-items: center;
  border-radius: 32px;
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-start;
  min-block-size: 360px;
  position: relative;
}

.pole {
  background: #8d6e63;
  block-size: 300px;
  border-radius: 999px;
  inline-size: 18px;
  position: absolute;
}

.stack-ring,
.loose-ring {
  block-size: 54px;
  border-radius: 999px;
  box-shadow: inset 0 -8px 14px rgb(0 0 0 / 16%);
  margin-block: 4px;
  margin-inline: auto;
  max-inline-size: 100%;
}

.rings {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
</style>
