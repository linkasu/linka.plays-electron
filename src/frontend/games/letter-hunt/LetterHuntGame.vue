<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useGazePointer } from "../../composables/useGazePointer";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";
import { disposeLetterHuntAudio, playLetterHuntMistakeMelody, playLetterHuntSuccessMelody, warmLetterHuntAudio } from "./audio";

type Point = { x: number; y: number };
type LetterFeedback = "idle" | "correct" | "mistake";
type FloatingLetter = Point & {
  id: string;
  letter: string;
  radius: number;
  vx: number;
  vy: number;
  age: number;
  phase: number;
  dwellProgress: number;
  enteredAt?: number;
  feedback: LetterFeedback;
  feedbackAge: number;
  hue: number;
};
type Cloud = Point & {
  width: number;
  alpha: number;
  drift: number;
  phase: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, recordMistake, startSession } = useGameSessionFor("letter-hunt", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.55, motionSpeed: 0.44, distractors: "low", hints: "high", sound: true },
  finishOnMistakes: false
});

const activeLetters = reactive<FloatingLetter[]>([]);
const clouds = reactive<Cloud[]>([]);
const targetLetter = ref("А");
const isSpeaking = ref(false);
const resultVisible = computed(() => session.status === "finished");
const promptText = computed(() => `Поймай букву ${targetLetter.value}`);
const promptAudio = useGamePromptAudio({ gameId: "letter-hunt", soundEnabled: toRef(session.settings, "sound") });

const roundLetters = ["А", "О", "М", "С", "К", "Р", "Т", "Л"];
const distractorLetters = ["А", "О", "М", "С", "К", "Р", "Т", "Л", "Н", "П", "В", "Е", "И", "Б", "Д", "З"];
const letterHues = [205, 176, 36, 288, 12, 146, 224, 326];
const mistakeGlowSeconds = 1.05;
const correctGlowSeconds = 0.85;
const letterPromptIds: Record<string, string> = {
  А: "a",
  О: "o",
  М: "m",
  С: "s",
  К: "k",
  Р: "r",
  Т: "t",
  Л: "l"
};

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let spawnSerial = 0;
let nextRoundAt = 0;

function promptAssetId() {
  return `letter-hunt.prompt.${letterPromptIds[targetLetter.value] ?? "a"}`;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isSpeaking.value = false;
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

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
  initClouds();
}

function letterRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.125;
  return Math.min(112, Math.max(70, Math.min(viewportLimit, 60 * session.settings.targetScale)));
}

function desiredLetterCount() {
  if (window.innerWidth < 980) return 3;
  if (window.innerWidth < 1280) return 4;
  return 5;
}

function targetForStep() {
  return roundLetters[session.step % roundLetters.length];
}

function pointIsFarEnough(point: Point, placed: Point[], radius: number) {
  const pixelPoint = percentToPixels(point);
  return placed.every((placedPoint) => distance(pixelPoint, percentToPixels(placedPoint)) >= radius * 2.2);
}

function chooseLetterPoint(radius: number, placed: Point[]) {
  if (window.innerWidth < 980) {
    const slots = [
      { x: 20, y: 64 },
      { x: 50, y: 56 },
      { x: 80, y: 64 }
    ];
    return slots[placed.length % slots.length];
  }

  if (window.innerWidth < 1280) {
    const slots = [
      { x: 20, y: 64 },
      { x: 40, y: 56 },
      { x: 60, y: 56 },
      { x: 80, y: 64 }
    ];
    return slots[placed.length % slots.length];
  }

  let best = randomTargetCenterPercent({
    targetWidth: radius * 2,
    targetHeight: radius * 2,
    hudHeight: Math.max(190, window.innerHeight * 0.24),
    sidePadding: Math.max(58, window.innerWidth * 0.08),
    bottomPadding: Math.max(72, window.innerHeight * 0.09),
    attempts: 18
  });

  for (let attempt = 0; attempt < 26; attempt++) {
    const point = randomTargetCenterPercent({
      targetWidth: radius * 2,
      targetHeight: radius * 2,
      hudHeight: Math.max(190, window.innerHeight * 0.24),
      sidePadding: Math.max(58, window.innerWidth * 0.08),
      bottomPadding: Math.max(72, window.innerHeight * 0.09),
      previous: placed[placed.length - 1],
      minDistance: Math.min(310, Math.max(170, radius * 1.9)),
      attempts: 12
    });
    best = point;
    if (pointIsFarEnough(point, placed, radius)) return point;
  }

  return best;
}

function makeLetter(letter: string, point: Point, isTarget: boolean): FloatingLetter {
  const radius = letterRadius() * randomRange(0.94, 1.06);
  const hue = letterHues[spawnSerial % letterHues.length];
  spawnSerial += 1;

  return {
    id: `letter-hunt-${Date.now()}-${spawnSerial}`,
    letter,
    x: point.x,
    y: point.y,
    radius,
    vx: 0,
    vy: 0,
    age: randomRange(0, 6),
    phase: randomRange(0, Math.PI * 2),
    dwellProgress: 0,
    feedback: "idle",
    feedbackAge: 0,
    hue
  };
}

function roundChoices() {
  const target = targetForStep();
  const count = desiredLetterCount();
  const distractors = shuffle(distractorLetters.filter((letter) => letter !== target)).slice(0, count - 1);
  return shuffle([target, ...distractors]);
}

function placeRoundLetters() {
  const placed: Point[] = [];
  const choices = roundChoices();
  activeLetters.splice(0);
  targetLetter.value = targetForStep();

  for (const letter of choices) {
    const radius = letterRadius();
    const point = chooseLetterPoint(radius, placed);
    placed.push(point);
    activeLetters.push(makeLetter(letter, point, letter === targetLetter.value));
  }

  recordEvent("level-start", { targetLetter: targetLetter.value, choices });
}

function startNextRound() {
  nextRoundAt = 0;
  placeRoundLetters();
  void playPrompt(180);
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

function targetPayload(letter: FloatingLetter, now: number, progress: number, reason?: "left" | "invalid-gaze" | "new-round") {
  return {
    targetId: letter.id,
    selectedLetter: letter.letter,
    targetLetter: targetLetter.value,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: letter.enteredAt === undefined ? 0 : now - letter.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function letterPoint(letter: FloatingLetter) {
  const point = percentToPixels(letter);
  return {
    x: point.x + Math.sin(letter.age * 0.62 + letter.phase) * letter.radius * 0.08,
    y: point.y + Math.cos(letter.age * 0.47 + letter.phase) * letter.radius * 0.06
  };
}

function cancelLetter(letter: FloatingLetter, now: number, reason: "left" | "invalid-gaze" | "new-round") {
  recordEvent("target-cancel", targetPayload(letter, now, letter.dwellProgress, reason));
  letter.enteredAt = undefined;
  letter.dwellProgress = 0;
}

async function finishCorrectLetter(letter: FloatingLetter) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["letter-hunt.correct"], 80);
  if (session.status === "running") startNextRound();
  else isSpeaking.value = false;
}

async function finishMistakeLetter(letter: FloatingLetter) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["letter-hunt.mistake", promptAssetId()], 80, 170);
  if (letter.feedback === "mistake") refreshMistakeLetter(letter);
  isSpeaking.value = false;
}

function selectLetter(letter: FloatingLetter, now: number) {
  if (isSpeaking.value) return;
  recordEvent("target-click", targetPayload(letter, now, 1));
  letter.enteredAt = undefined;
  letter.dwellProgress = 1;

  if (letter.letter === targetLetter.value) {
    void playLetterHuntSuccessMelody(session.settings.sound);
    recordSuccess({ targetId: letter.id, letter: letter.letter });
    letter.feedback = "correct";
    letter.feedbackAge = 0;
    void finishCorrectLetter(letter);
    return;
  }

  void playLetterHuntMistakeMelody(session.settings.sound);
  recordMistake({ targetId: letter.id, selectedLetter: letter.letter, targetLetter: targetLetter.value });
  letter.feedback = "mistake";
  letter.feedbackAge = 0;
  letter.dwellProgress = 0;
  void finishMistakeLetter(letter);
}

function closestLetter() {
  if (nextRoundAt > 0) return undefined;
  if (isSpeaking.value) return undefined;
  if (!pointer.value.valid || session.status !== "running") return undefined;

  let closest: FloatingLetter | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const letter of activeLetters) {
    if (letter.feedback !== "idle") continue;
    const point = letterPoint(letter);
    const hitRadius = letter.radius * 1.18;
    const nextDistance = distance(point, pointer.value);
    if (nextDistance <= hitRadius && nextDistance < closestDistance) {
      closest = letter;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function keepLetterInBounds(letter: FloatingLetter) {
  const sidePadding = Math.max(50, window.innerWidth * 0.06);
  const topPadding = Math.max(188, window.innerHeight * 0.24);
  const bottomPadding = Math.max(64, window.innerHeight * 0.08);
  const minX = (sidePadding + letter.radius) / window.innerWidth * 100;
  const maxX = (window.innerWidth - sidePadding - letter.radius) / window.innerWidth * 100;
  const minY = (topPadding + letter.radius) / window.innerHeight * 100;
  const maxY = (window.innerHeight - bottomPadding - letter.radius) / window.innerHeight * 100;

  if (letter.x < minX || letter.x > maxX) {
    letter.x = Math.min(maxX, Math.max(minX, letter.x));
    letter.vx *= -1;
  }
  if (letter.y < minY || letter.y > maxY) {
    letter.y = Math.min(maxY, Math.max(minY, letter.y));
    letter.vy *= -1;
  }
}

function refreshMistakeLetter(letter: FloatingLetter) {
  const used = activeLetters.map((item) => item.letter);
  const candidates = distractorLetters.filter((item) => item !== targetLetter.value && !used.includes(item));
  letter.letter = candidates[Math.floor(Math.random() * candidates.length)] ?? letter.letter;
  letter.feedback = "idle";
  letter.feedbackAge = 0;
  letter.dwellProgress = 0;
  letter.enteredAt = undefined;
  letter.hue = letterHues[spawnSerial % letterHues.length];
  spawnSerial += 1;
}

function updateLetters(delta: number, now: number) {
  if (nextRoundAt > 0 && now >= nextRoundAt && session.status === "running") {
    nextRoundAt = 0;
    for (const letter of activeLetters) {
      if (letter.enteredAt !== undefined) cancelLetter(letter, now, "new-round");
    }
    startNextRound();
  }

  const gazeLetter = closestLetter();
  for (const letter of activeLetters) {
    letter.age += delta;
    letter.x += letter.vx * delta * session.settings.motionSpeed;
    letter.y += letter.vy * delta * session.settings.motionSpeed;
    keepLetterInBounds(letter);

    if (letter.feedback !== "idle") {
      letter.feedbackAge += delta;
      if (letter.feedback === "mistake" && letter.feedbackAge >= mistakeGlowSeconds) refreshMistakeLetter(letter);
      continue;
    }

    if (session.status !== "running") continue;
    const inside = gazeLetter === letter;
    if (!inside) {
      if (letter.enteredAt !== undefined) cancelLetter(letter, now, pointer.value.valid ? "left" : "invalid-gaze");
      continue;
    }

    if (letter.enteredAt === undefined) {
      letter.enteredAt = now;
      recordEvent("target-enter", targetPayload(letter, now, 0));
    }

    letter.dwellProgress = Math.min(1, (now - letter.enteredAt) / session.settings.dwellMs);
    if (letter.dwellProgress >= 1) selectLetter(letter, now);
  }
}

function initClouds() {
  clouds.splice(0);
  const count = Math.min(9, Math.max(5, Math.round(window.innerWidth / 180)));
  for (let index = 0; index < count; index++) {
    clouds.push({
      x: randomRange(-8, 102),
      y: randomRange(12, 48),
      width: randomRange(120, 260),
      alpha: randomRange(0.12, 0.28),
      drift: randomRange(0.35, 0.75),
      phase: randomRange(0, Math.PI * 2)
    });
  }
}

function updateClouds(delta: number) {
  for (const cloud of clouds) {
    cloud.x += cloud.drift * delta * session.settings.motionSpeed;
    if (cloud.x > 112) cloud.x = -18;
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#cdefff");
  sky.addColorStop(0.55, "#e7f7e8");
  sky.addColorStop(1, "#f8edcf");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  for (const cloud of clouds) {
    const point = percentToPixels(cloud);
    const bob = Math.sin(now * 0.00028 + cloud.phase) * 5;
    context.globalAlpha = cloud.alpha;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.ellipse(point.x, point.y + bob, cloud.width * 0.36, cloud.width * 0.13, 0, 0, Math.PI * 2);
    context.ellipse(point.x - cloud.width * 0.22, point.y + bob + 3, cloud.width * 0.24, cloud.width * 0.1, 0, 0, Math.PI * 2);
    context.ellipse(point.x + cloud.width * 0.24, point.y + bob + 1, cloud.width * 0.26, cloud.width * 0.11, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.fillStyle = "rgb(113 174 119 / 22%)";
  context.beginPath();
  context.ellipse(window.innerWidth * 0.28, window.innerHeight * 0.94, window.innerWidth * 0.5, window.innerHeight * 0.2, 0, 0, Math.PI * 2);
  context.ellipse(window.innerWidth * 0.76, window.innerHeight * 0.93, window.innerWidth * 0.54, window.innerHeight * 0.22, 0, 0, Math.PI * 2);
  context.fill();
}

function drawLetter(context: CanvasRenderingContext2D, letter: FloatingLetter) {
  const point = letterPoint(letter);
  const feedbackProgress = letter.feedback === "idle" ? 0 : Math.max(0, 1 - letter.feedbackAge / (letter.feedback === "correct" ? correctGlowSeconds : mistakeGlowSeconds));
  const glowHue = letter.feedback === "correct" ? 142 : letter.feedback === "mistake" ? 38 : letter.hue;
  const radius = letter.radius * (1 + letter.dwellProgress * 0.04 + feedbackProgress * 0.08);

  context.save();
  context.translate(point.x, point.y);
  context.rotate(Math.sin(letter.age * 0.32 + letter.phase) * 0.035);
  context.translate(-point.x, -point.y);

  const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * (1.35 + letter.dwellProgress * 0.7 + feedbackProgress));
  halo.addColorStop(0, `hsla(${glowHue}, 96%, 82%, ${0.16 + letter.dwellProgress * 0.18 + feedbackProgress * 0.18})`);
  halo.addColorStop(1, `hsla(${glowHue}, 90%, 70%, 0)`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(point.x, point.y, radius * (1.45 + feedbackProgress), 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgb(255 255 255 / 86%)";
  context.strokeStyle = letter.feedback === "correct" ? "rgb(86 166 111 / 64%)" : letter.feedback === "mistake" ? "rgb(221 154 69 / 64%)" : "rgb(92 126 151 / 34%)";
  context.lineWidth = Math.max(3, radius * 0.035);
  context.beginPath();
  context.roundRect(point.x - radius, point.y - radius, radius * 2, radius * 2, radius * 0.38);
  context.fill();
  context.stroke();

  context.fillStyle = "rgb(48 66 82 / 92%)";
  context.font = `700 ${Math.round(radius * 1.08)}px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(letter.letter, point.x, point.y + radius * 0.04);

  if (letter.dwellProgress > 0.01 && letter.feedback === "idle") {
    context.strokeStyle = `hsla(${letter.hue}, 92%, 48%, 0.62)`;
    context.lineWidth = Math.max(4, radius * 0.045);
    context.lineCap = "round";
    context.beginPath();
    context.arc(point.x, point.y, radius * 1.12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * letter.dwellProgress);
    context.stroke();
  }

  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const letter of activeLetters) drawLetter(context, letter);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status !== "paused") updateClouds(delta);
  if (session.status === "running") updateLetters(delta, now);

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  nextRoundAt = 0;
  promptAudio.cancelPending();
  isSpeaking.value = false;
  startSession();
  placeRoundLetters();
  void playPrompt(450);
}

onMounted(async () => {
  await nextTick();
  promptAudio.warm();
  warmLetterHuntAudio(session.settings.sound);
  resizeCanvas();
  placeRoundLetters();
  void playPrompt(450);
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

watch(() => session.settings.sound, (enabled) => {
  warmLetterHuntAudio(enabled);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  promptAudio.cancelPending();
  disposeLetterHuntAudio();
});
</script>

<template>
  <div class="letter-hunt-shell">
    <canvas ref="canvasRef" class="letter-hunt-canvas" />

    <v-card class="letter-hunt-prompt mx-auto px-5 py-3" color="surface" elevation="6" rounded="xl">
      <div class="text-caption text-medium-emphasis">Охота на буквы</div>
      <div class="text-h5 font-weight-bold">{{ promptText }}</div>
    </v-card>

    <GameHud
      title="Охота на буквы"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <GameResultDialog
      :model-value="resultVisible"
      title="Охота на буквы"
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
.letter-hunt-shell {
  background: #cdefff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.letter-hunt-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.letter-hunt-prompt {
  left: 50%;
  max-inline-size: min(520px, calc(100vw - 32px));
  pointer-events: none;
  position: fixed;
  text-align: center;
  top: 104px;
  transform: translateX(-50%);
  z-index: 8;
}

@media (max-width: 700px) {
 .letter-hunt-prompt {
    top: 152px;
  }
}
</style>
