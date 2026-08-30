<script setup lang="ts">
import { onMounted, ref } from "vue";
import { probeAudioUnlock, unlockAudio, type AudioContextLike } from "../core/audioUnlock";

const visible = ref(false);
let context: AudioContextLike | undefined;

function createAudioContext(): AudioContextLike | undefined {
  const Constructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Constructor ? new Constructor() : undefined;
}

onMounted(() => {
  const probe = probeAudioUnlock(createAudioContext);
  visible.value = probe.blocked;
  context = probe.context;
});

async function start() {
  await unlockAudio(context);
  context = undefined;
  visible.value = false;
}
</script>

<template>
  <div v-if="visible" class="audio-gate">
    <div class="audio-gate-card">
      <h1 class="audio-gate-title">Нажмите, чтобы включить звук</h1>
      <p class="audio-gate-text">
        В браузере звук не включается сам. Задания в играх проговариваются вслух, поэтому без этого
        будет тихо.
      </p>
      <button class="audio-gate-button" type="button" autofocus @click="start">
        Включить звук
      </button>
      <button class="audio-gate-skip" type="button" @click="visible = false">
        Продолжить без звука
      </button>
    </div>
  </div>
</template>

<style scoped>
.audio-gate {
  align-items: center;
  background: rgb(var(--v-theme-surface));
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 2rem;
  position: fixed;
  z-index: 2400;
}

.audio-gate-card {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-inline-size: 46rem;
  text-align: center;
}

.audio-gate-title {
  font-size: clamp(1.8rem, 4.5vh, 2.8rem);
  font-weight: 700;
  line-height: 1.15;
  margin: 0;
}

.audio-gate-text {
  color: rgb(var(--v-theme-on-surface) / 72%);
  font-size: clamp(1.05rem, 2.4vh, 1.4rem);
  line-height: 1.45;
  margin: 0;
}

/* Цель для взгляда: правило §1 из principles/accessibility.md требует не
   меньше 120 × 120 px, поэтому нижняя граница clamp взята с запасом. */
.audio-gate-button {
  align-self: center;
  background: rgb(var(--v-theme-primary));
  border-radius: 1.5rem;
  color: rgb(var(--v-theme-on-primary));
  cursor: pointer;
  font-size: clamp(1.3rem, 3vh, 1.9rem);
  font-weight: 600;
  min-block-size: clamp(8.5rem, 18vh, 12rem);
  min-inline-size: clamp(18rem, 42vw, 30rem);
  padding: 1.5rem 2.5rem;
}

.audio-gate-button:focus-visible {
  outline: 0.25rem solid rgb(var(--v-theme-secondary));
  outline-offset: 0.25rem;
}

.audio-gate-skip {
  align-self: center;
  background: transparent;
  border-radius: 1rem;
  color: rgb(var(--v-theme-on-surface) / 62%);
  cursor: pointer;
  font-size: clamp(0.95rem, 2vh, 1.15rem);
  min-block-size: 3rem;
  padding: 0.5rem 1.5rem;
  text-decoration: underline;
}

.audio-gate-skip:focus-visible {
  outline: 0.2rem solid rgb(var(--v-theme-secondary));
  outline-offset: 0.2rem;
}
</style>
