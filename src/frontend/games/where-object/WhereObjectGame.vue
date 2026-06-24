<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateWhereObjectRound, type WhereObjectPreposition } from "./model";
import { buildWhereObjectTargets, containsTarget, drawWhereObjectScene, type WhereObjectCanvasTarget, type Point } from "./scene";

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("where-object", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 120, targetScale: 1.2 },
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "where-object",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["where-object.mistake"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const hintedRoundId = ref<string>();
const hintedChoiceId = ref<string>();
const lastMistakeId = ref<string>();
const isChangingRound = ref(false);
const canvasTargets = ref<WhereObjectCanvasTarget[]>([]);
const resultVisible = computed(() => session.status === "finished");

const { round, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: generateWhereObjectRound
});

const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) {
    return "Посмотри на сцену и выбери слово: на, под или в.";
  }

  return `Подсказка: правильное слово — «${round.value.targetPreposition.label}».`;
});

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx = canvas.getContext("2d") ?? undefined;
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  resetCanvasTargets();
}

function prepositionTargetId(prepositionId: string) {
  return `where-object:preposition:${prepositionId}`;
}

function targetTelemetryId(target: WhereObjectCanvasTarget) {
  return prepositionTargetId(target.id);
}

function resetCanvasTargets() {
  canvasTargets.value = buildWhereObjectTargets(round.value);
}

function promptAssetId() {
  return `where-object.prompt.${round.value.targetObject.id}`;
}

function answerAssetId() {
  return `where-object.answer.${round.value.targetObject.id}.${round.value.targetPlace.id}.${round.value.targetPreposition.id}`;
}

async function playRoundPrompt(delayMs = 0) {
  isChangingRound.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isChangingRound.value = false;
}

function copyPointer() {
  return {
    x: pointer.value.x,
    y: pointer.value.y,
    valid: pointer.value.valid,
    source: pointer.value.source,
    timestamp: pointer.value.timestamp
  };
}

function targetPayload(target: WhereObjectCanvasTarget, now: number, progress: number, reason?: "left" | "invalid-gaze" | "disabled") {
  return {
    targetId: targetTelemetryId(target),
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: target.enteredAt === undefined ? 0 : now - target.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function clearTargetDwell(target: WhereObjectCanvasTarget) {
  target.dwellProgress = 0;
  target.enteredAt = undefined;
}

function cancelTarget(target: WhereObjectCanvasTarget, now: number, reason: "left" | "invalid-gaze" | "disabled") {
  if (target.enteredAt !== undefined) recordEvent("target-cancel", targetPayload(target, now, target.dwellProgress, reason));
  clearTargetDwell(target);
}

function resetFeedback() {
  hintedRoundId.value = undefined;
  hintedChoiceId.value = undefined;
  lastMistakeId.value = undefined;
}

function answerPreposition(preposition: WhereObjectPreposition, target: WhereObjectCanvasTarget) {
  const targetId = prepositionTargetId(preposition.id);
  const expectedTargetId = prepositionTargetId(round.value.targetPreposition.id);
  if (preposition.id === round.value.targetPreposition.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: preposition.id, expected: round.value.targetPreposition.label, actual: preposition.label, isCorrect: true });
    resetFeedback();
    return true;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: preposition.id, expected: round.value.targetPreposition.label, actual: preposition.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-preposition-selected" });
  hintedRoundId.value = round.value.roundId;
  hintedChoiceId.value = round.value.targetPreposition.id;
  lastMistakeId.value = target.id;
  return false;
}

async function advanceAfterCorrect() {
  if (session.status !== "running" || session.step >= session.maxSteps) {
    isChangingRound.value = false;
    return;
  }

  nextRound();
  resetCanvasTargets();
  await playRoundPrompt(180);
}

async function selectTarget(target: WhereObjectCanvasTarget, now: number) {
  if (isChangingRound.value) return;
  recordEvent("target-click", targetPayload(target, now, 1));
  isChangingRound.value = true;
  const correct = answerPreposition(target.preposition, target);

  for (const item of canvasTargets.value) clearTargetDwell(item);
  if (!correct) {
    void pianoFeedback.playMistake();
    await promptAudio.playSequenceAndWait(["where-object.mistake", answerAssetId()], 80);
    isChangingRound.value = false;
    return;
  }

  void pianoFeedback.playSuccess();
  await promptAudio.playSequenceAndWait([answerAssetId()], 80);
  await advanceAfterCorrect();
}

function updateCanvasDwell(now: number) {
  if (session.status !== "running" || isChangingRound.value) {
    for (const target of canvasTargets.value) cancelTarget(target, now, "disabled");
    return;
  }

  const currentPointer: Point = { x: pointer.value.x, y: pointer.value.y };
  const activeTarget = pointer.value.valid ? canvasTargets.value.find((target) => containsTarget(target, currentPointer)) : undefined;

  for (const target of canvasTargets.value) {
    if (target !== activeTarget) {
      cancelTarget(target, now, pointer.value.valid ? "left" : "invalid-gaze");
      continue;
    }

    if (target.enteredAt === undefined) {
      target.enteredAt = now;
      target.dwellProgress = 0;
      recordEvent("target-enter", targetPayload(target, now, 0));
    }

    target.dwellProgress = Math.min(1, (now - target.enteredAt) / session.settings.dwellMs);
    if (target.dwellProgress >= 1) selectTarget(target, now);
  }
}

function draw(now: number) {
  if (!ctx) return;
  drawWhereObjectScene(ctx, {
    round: round.value,
    targets: canvasTargets.value,
    pointer: pointer.value,
    running: session.status === "running" && !isChangingRound.value,
    hintedId: hintedRoundId.value === round.value.roundId ? hintedChoiceId.value : undefined,
    mistakeId: lastMistakeId.value,
    now
  });
}

function tick(now: number) {
  updateCanvasDwell(now);
  draw(now);
  frame = window.requestAnimationFrame(tick);
}

function restart() {
  resetFeedback();
  isChangingRound.value = false;
  promptAudio.cancelPending();
  restartRoundGame();
  resetCanvasTargets();
  void playRoundPrompt(220);
}

watch(() => round.value.roundId, () => {
  resetCanvasTargets();
});

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  frame = window.requestAnimationFrame(tick);
  void playRoundPrompt(420);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  window.cancelAnimationFrame(frame);
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="where-object-shell">
    <canvas ref="canvasRef" class="where-object-canvas" />

    <div class="quiet-controls d-flex align-center ga-1 pa-1">
      <v-btn aria-label="В меню" color="primary" density="comfortable" icon="mdi-arrow-left" size="small" variant="text" @click="router.push(resolveMenuRoute())" />
      <v-btn
        :aria-label="session.status === 'paused' ? 'Продолжить' : 'Пауза'"
        color="primary"
        density="comfortable"
        :icon="session.status === 'paused' ? 'mdi-play' : 'mdi-pause'"
        size="small"
        variant="text"
        @click="session.status === 'paused' ? resumeSession() : pauseSession()"
      />
    </div>

    <section class="prompt-panel" aria-live="polite">
      <div class="text-overline text-secondary">AAC и предлоги</div>
      <h1>{{ round.prompt }}</h1>
      <p>{{ hintText }}</p>
    </section>

    <div
      v-for="target in canvasTargets"
      :key="`${round.roundId}:${target.id}`"
      :id="targetTelemetryId(target)"
      class="dwell-hitbox canvas-hitbox"
      :data-correct="target.id === round.correctId ? 'true' : undefined"
      :style="{ left: `${target.x}px`, top: `${target.y}px`, width: `${target.width}px`, height: `${target.height}px` }"
      aria-hidden="true"
    />

    <GameResultDialog
      :model-value="resultVisible"
      title="Где предмет?"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.where-object-shell {
  background: #f5efff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.where-object-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.quiet-controls {
  background: rgb(255 255 255 / 72%);
  border-radius: 1.125rem;
  box-shadow: 0 0.5rem 1.4rem rgb(76 58 112 / 12%);
  inset-block-start: 1rem;
  inset-inline-start: 1rem;
  opacity: 0.82;
  position: absolute;
  transition: opacity 160ms ease;
  z-index: 4;
}

.quiet-controls:focus-within,
.quiet-controls:hover {
  opacity: 0.96;
}

.prompt-panel {
  background: rgb(255 252 246 / 84%);
  border: 0.0625rem solid rgb(38 50 56 / 10%);
  border-radius: 1.75rem;
  box-shadow: 0 0.8rem 2rem rgb(76 58 112 / 10%);
  inline-size: min(68rem, calc(100vw - 2rem));
  inset-block-start: 5rem;
  inset-inline-start: 50%;
  padding: 1rem 1.25rem;
  position: absolute;
  text-align: center;
  transform: translateX(-50%);
  z-index: 3;
}

.prompt-panel h1 {
  color: #263238;
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 800;
  line-height: 1.05;
  margin: 0.1rem 0 0.35rem;
}

.prompt-panel p {
  color: #54615f;
  font-size: clamp(1rem, 2vw, 1.35rem);
  font-weight: 600;
  margin: 0;
}

.canvas-hitbox {
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

@media (max-height: 42rem) {
  .prompt-panel {
    inset-block-start: 4.1rem;
    padding: 0.7rem 1rem;
  }

  .prompt-panel .text-overline {
    display: none;
  }

  .prompt-panel h1 {
    font-size: clamp(1.6rem, 3.2vw, 2.2rem);
  }

  .prompt-panel p {
    font-size: 0.95rem;
  }
}
</style>
