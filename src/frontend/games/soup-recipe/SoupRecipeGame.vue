<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { createSoupIngredientSlots, createSoupRecipeLayout, createSoupRecipeRound, type SoupIngredient, type SoupRect } from "./model";

type Rect = SoupRect;
type Point = { x: number; y: number };
type Rgb = { r: number; g: number; b: number };
type FlyingIngredient = {
  ingredient: SoupIngredient;
  from: Point;
  to: Point;
  startedAt: number;
  durationMs: number;
};

const soupFeedback = createStandardGameFeedback();
const router = useRouter();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("soup-recipe", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const round = createSoupRecipeRound(session.maxSteps);
const placedIngredientIds = ref<string[]>([]);
const lastMistakeId = ref<string>();
const resultVisible = ref(false);
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const feedbackMessage = ref("Добавляй ингредиенты по порядку. Если ошибёшься, попробуй ещё раз.");
const promptAudio = useGamePromptAudio({ gameId: "soup-recipe", soundEnabled: toRef(session.settings, "sound") });
const currentRoundId = computed(() => `soup-recipe:step:${session.step + 1}`);
const placedIngredients = computed(() => placedIngredientIds.value
 .map((id) => round.ingredients.find((ingredient) => ingredient.id === id))
 .filter((ingredient): ingredient is SoupIngredient => Boolean(ingredient)));
const nextIngredient = computed(() => round.ingredients.find((ingredient) => !placedIngredientIds.value.includes(ingredient.id)));
const recipeComplete = computed(() => placedIngredientIds.value.length >= round.ingredients.length);
const layout = computed(() => createSoupRecipeLayout(width.value, height.value));
const ingredientSlots = computed(() => createSoupIngredientSlots(round.ingredients, width.value, height.value));

const flyingIngredients: FlyingIngredient[] = [];
const bubbles = Array.from({ length: 18 }, (_, index) => ({
  x: ((index * 37) % 100) / 100,
  y: ((index * 53) % 100) / 100,
  size: 0.45 + ((index * 17) % 11) / 12,
  phase: index * 0.7
}));
let resultTimer = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function ingredientTargetId(ingredient: SoupIngredient) {
  return `soup-recipe:ingredient:${ingredient.id}`;
}

function targetStyle(rect: Rect) {
  return {
    insetBlockStart: `${rect.y}px`,
    insetInlineStart: `${rect.x}px`,
    inlineSize: `${rect.width}px`,
    blockSize: `${rect.height}px`
  };
}

function clearResultTimer() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
}

function scheduleResultDialog() {
  clearResultTimer();
  resultTimer = window.setTimeout(() => {
    resultVisible.value = true;
  }, 1400);
}

function potCenter() {
  const currentLayout = createSoupRecipeLayout(width.value, height.value);
  return {
    x: currentLayout.potRect.x + currentLayout.potRect.width * 0.5,
    y: currentLayout.potRect.y + currentLayout.potRect.height * 0.56
  };
}

function ingredientColor(ingredient: SoupIngredient) {
  if (lastMistakeId.value === ingredient.id) return "orange-lighten-4";
  if (placedIngredientIds.value.includes(ingredient.id)) return "green-lighten-5";
  return "surface";
}

function addFlyingIngredient(ingredient: SoupIngredient) {
  const slot = ingredientSlots.value.find((item) => item.ingredient.id === ingredient.id);
  if (!slot) return;
  flyingIngredients.push({
    ingredient,
    from: slot.center,
    to: potCenter(),
    startedAt: performance.now(),
    durationMs: ingredient.id === "water" ? 1600 : 900
  });
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["soup-recipe.prompt"], delayMs);
  isSpeaking.value = false;
}

async function chooseIngredient(ingredient: SoupIngredient) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value || placedIngredientIds.value.includes(ingredient.id) || recipeComplete.value) return;

  const expectedIngredient = nextIngredient.value;
  const targetId = ingredientTargetId(ingredient);
  const expectedTargetId = expectedIngredient ? ingredientTargetId(expectedIngredient) : undefined;

  if (ingredient.id !== expectedIngredient?.id) {
    pendingSelection.value = true;
    recordMistake({ roundId: currentRoundId.value, targetId, expectedTargetId, expected: expectedIngredient?.id, actual: ingredient.id, isCorrect: false });
    lastMistakeId.value = ingredient.id;
    feedbackMessage.value = "Посмотри на порядок рецепта и попробуй другой ингредиент.";
    void soupFeedback.playMistake(session.settings.sound);
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(["soup-recipe.mistake"], 80);
    isSpeaking.value = false;
    pendingSelection.value = false;
    return;
  }

  pendingSelection.value = true;
  addFlyingIngredient(ingredient);
  placedIngredientIds.value = [...placedIngredientIds.value, ingredient.id];
  lastMistakeId.value = undefined;
  recordSuccess({ roundId: currentRoundId.value, targetId, expected: ingredient.id, actual: ingredient.id, isCorrect: true });
  void soupFeedback.playSuccess(session.settings.sound);

  if (recipeComplete.value && session.status === "running") {
    feedbackMessage.value = "Суп готов. Все ингредиенты добавлены по рецепту.";
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(["soup-recipe.correct", "soup-recipe.complete"], 80, 170);
    isSpeaking.value = false;
    finishSession("game-complete");
    return;
  }

  feedbackMessage.value = "Верно. Продолжай по рецепту.";
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["soup-recipe.correct"], 80);
  isSpeaking.value = false;
  pendingSelection.value = false;
}

function restart() {
  clearResultTimer();
  promptAudio.cancelPending();
  resultVisible.value = false;
  placedIngredientIds.value = [];
  lastMistakeId.value = undefined;
  pendingSelection.value = false;
  isSpeaking.value = false;
  flyingIngredients.splice(0);
  feedbackMessage.value = "Добавляй ингредиенты по порядку. Если ошибёшься, попробуй ещё раз.";
  startSession();
  void playPrompt(450);
}

function updateFlights(now: number) {
  for (let index = flyingIngredients.length - 1; index >= 0; index -= 1) {
    if (now - flyingIngredients[index].startedAt > flyingIngredients[index].durationMs) flyingIngredients.splice(index, 1);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number) {
  const r = Math.min(radius, rect.width * 0.5, rect.height * 0.5);
  ctx.beginPath();
  ctx.moveTo(rect.x + r, rect.y);
  ctx.lineTo(rect.x + rect.width - r, rect.y);
  ctx.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + r);
  ctx.lineTo(rect.x + rect.width, rect.y + rect.height - r);
  ctx.quadraticCurveTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - r, rect.y + rect.height);
  ctx.lineTo(rect.x + r, rect.y + rect.height);
  ctx.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - r);
  ctx.lineTo(rect.x, rect.y + r);
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y);
  ctx.closePath();
}

function fillRoundRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, fill: string | CanvasGradient | CanvasPattern) {
  roundRect(ctx, rect, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, stroke: string, lineWidth = 2) {
  roundRect(ctx, rect, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawCenteredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = "#263d39", weight = 700) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height.value);
  gradient.addColorStop(0, "#dff6f1");
  gradient.addColorStop(0.5, "#fff7dd");
  gradient.addColorStop(1, "#f0c993");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width.value, height.value);

  const windowRect = {
    x: width.value * 0.05,
    y: height.value * 0.16,
    width: width.value * 0.34,
    height: height.value * 0.34
  };
  ctx.save();
  ctx.globalAlpha = 0.78;
  fillRoundRect(ctx, windowRect, 32, "rgba(255, 255, 255, 0.5)");
  const sky = ctx.createLinearGradient(0, windowRect.y, 0, windowRect.y + windowRect.height);
  sky.addColorStop(0, "#bfe9ff");
  sky.addColorStop(1, "#e8f8d7");
  fillRoundRect(ctx, { x: windowRect.x + 16, y: windowRect.y + 16, width: windowRect.width - 32, height: windowRect.height - 32 }, 22, sky);
  ctx.strokeStyle = "rgba(92, 128, 122, 0.16)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(windowRect.x + windowRect.width * 0.5, windowRect.y + 18);
  ctx.lineTo(windowRect.x + windowRect.width * 0.5, windowRect.y + windowRect.height - 18);
  ctx.moveTo(windowRect.x + 18, windowRect.y + windowRect.height * 0.52);
  ctx.lineTo(windowRect.x + windowRect.width - 18, windowRect.y + windowRect.height * 0.52);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.56)";
  for (let index = 0; index < 4; index += 1) {
    const x = windowRect.x + 46 + ((index * 89 + now * 0.004) % Math.max(1, windowRect.width - 92));
    const y = windowRect.y + windowRect.height * (0.34 + (index % 2) * 0.2);
    ctx.beginPath();
    ctx.ellipse(x - 20, y + 5, 28, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 8, y, 38, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 38, y + 6, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#ffffff";
  for (let x = 0; x < width.value; x += 84) ctx.fillRect(x, height.value * 0.53, 2, height.value * 0.18);
  for (let y = height.value * 0.53; y < height.value * 0.72; y += 58) ctx.fillRect(0, y, width.value, 2);
  ctx.restore();

  const counterTop = height.value * 0.68;
  const counter = ctx.createLinearGradient(0, counterTop, 0, height.value);
  counter.addColorStop(0, "#d88d4a");
  counter.addColorStop(1, "#9f5f2d");
  ctx.fillStyle = counter;
  ctx.fillRect(0, counterTop, width.value, height.value - counterTop);
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = "#5b331b";
  ctx.lineWidth = 3;
  for (let y = counterTop + 34; y < height.value; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(y * 0.04) * 4);
    ctx.bezierCurveTo(width.value * 0.3, y - 8, width.value * 0.68, y + 10, width.value, y + Math.cos(y * 0.03) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeader(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof createSoupRecipeLayout>) {
  const cx = layout.panel.x + layout.panel.width * 0.5;
  const titleY = layout.panel.y + 26;
  ctx.save();
  ctx.shadowBlur = 24;
  ctx.shadowColor = "rgba(92, 64, 51, 0.16)";
  fillRoundRect(ctx, { x: cx - layout.panel.width * 0.31, y: layout.panel.y + 4, width: layout.panel.width * 0.62, height: 56 }, 28, "rgba(255, 252, 238, 0.78)");
  ctx.restore();
  drawCenteredText(ctx, "Свари суп по рецепту", cx, titleY, clamp(width.value * 0.021, 24, 40));
  drawCenteredText(ctx, feedbackMessage.value, cx, layout.panel.y + 56, clamp(width.value * 0.011, 13, 18), "#566d67", 600);
}

function drawGasFlame(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, now: number) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2;
    const flicker = 0.82 + Math.sin(now * 0.006 + index * 1.7) * 0.16;
    const flameX = x + Math.cos(angle) * radius * 0.54;
    const flameY = y + Math.sin(angle) * radius * 0.24;
    const flame = ctx.createRadialGradient(flameX, flameY, 0, flameX, flameY, radius * 0.34 * flicker);
    flame.addColorStop(0, "rgba(184, 231, 255, 0.95)");
    flame.addColorStop(0.46, "rgba(72, 169, 255, 0.76)");
    flame.addColorStop(1, "rgba(0, 85, 214, 0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.ellipse(flameX, flameY, radius * 0.22 * flicker, radius * 0.42 * flicker, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBurner(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, lit: boolean, now: number) {
  ctx.save();
  ctx.fillStyle = "rgba(28, 35, 38, 0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.22, radius * 1.16, radius * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(35, 42, 46, 0.72)";
  ctx.lineWidth = Math.max(3, radius * 0.08);
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI * 0.5 + Math.PI * 0.25;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * radius * 0.16, y + Math.sin(angle) * radius * 0.08);
    ctx.lineTo(x + Math.cos(angle) * radius * 1.08, y + Math.sin(angle) * radius * 0.42);
    ctx.stroke();
  }
  if (lit) drawGasFlame(ctx, x, y - radius * 0.1, radius * 0.9, now);
  ctx.restore();
}

function drawStove(ctx: CanvasRenderingContext2D, x: number, y: number, widthPx: number, heightPx: number, now: number) {
  const top = ctx.createLinearGradient(0, y, 0, y + heightPx);
  top.addColorStop(0, "#f6faf8");
  top.addColorStop(0.52, "#d9e0df");
  top.addColorStop(1, "#aeb9b8");
  ctx.save();
  ctx.shadowBlur = 28;
  ctx.shadowColor = "rgba(38, 24, 12, 0.28)";
  fillRoundRect(ctx, { x, y, width: widthPx, height: heightPx }, heightPx * 0.22, top);
  ctx.restore();
  strokeRoundRect(ctx, { x, y, width: widthPx, height: heightPx }, heightPx * 0.22, "rgba(65, 81, 84, 0.28)", Math.max(2, heightPx * 0.025));

  const mainY = y + heightPx * 0.34;
  drawBurner(ctx, x + widthPx * 0.5, mainY, heightPx * 0.24, true, now);
  drawBurner(ctx, x + widthPx * 0.2, y + heightPx * 0.48, heightPx * 0.16, false, now);
  drawBurner(ctx, x + widthPx * 0.8, y + heightPx * 0.48, heightPx * 0.16, false, now);

  ctx.save();
  ctx.fillStyle = "rgba(31, 39, 42, 0.78)";
  for (let index = 0; index < 4; index += 1) {
    const knobX = x + widthPx * (0.34 + index * 0.105);
    const knobY = y + heightPx * 0.82;
    ctx.beginPath();
    ctx.ellipse(knobX, knobY, heightPx * 0.055, heightPx * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(knobX, knobY);
    ctx.lineTo(knobX + heightPx * 0.035, knobY - heightPx * 0.028);
    ctx.stroke();
  }
  ctx.restore();
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: Math.round(lerp(from.r, to.r, amount)),
    g: Math.round(lerp(from.g, to.g, amount)),
    b: Math.round(lerp(from.b, to.b, amount))
  };
}

function rgbCss(color: Rgb) {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

function ingredientSoupTint(ingredientId: string): Rgb {
  if (ingredientId === "potatoes") return { r: 237, g: 207, b: 126 };
  if (ingredientId === "carrot") return { r: 226, g: 137, b: 48 };
  if (ingredientId === "onion") return { r: 204, g: 181, b: 160 };
  if (ingredientId === "peas") return { r: 140, g: 181, b: 92 };
  if (ingredientId === "noodles") return { r: 231, g: 204, b: 103 };
  if (ingredientId === "salt") return { r: 231, g: 224, b: 207 };
  if (ingredientId === "greens") return { r: 95, g: 161, b: 74 };
  return { r: 88, g: 181, b: 235 };
}

function ingredientBlendAmount(ingredient: SoupIngredient, now: number) {
  const flight = flyingIngredients.find((item) => item.ingredient.id === ingredient.id);
  if (!flight) return 1;
  const progress = clamp((now - flight.startedAt) / flight.durationMs, 0, 1);
  if (ingredient.id === "water") return easeOutCubic(clamp((progress - 0.18) / 0.72, 0, 1));
  return easeOutCubic(clamp((progress - 0.58) / 0.42, 0, 1));
}

function soupColors(now: number) {
  let color: Rgb = { r: 210, g: 221, b: 221 };
  const water = placedIngredients.value.find((ingredient) => ingredient.id === "water");
  if (water) color = mixRgb(color, { r: 88, g: 181, b: 235 }, ingredientBlendAmount(water, now));

  for (const ingredient of placedIngredients.value.filter((item) => item.id !== "water")) {
    const amount = ingredientBlendAmount(ingredient, now);
    color = mixRgb(color, ingredientSoupTint(ingredient.id), 0.12 * amount);
  }

  return {
    top: mixRgb(color, { r: 255, g: 243, b: 196 }, 0.24),
    middle: color,
    bottom: mixRgb(color, { r: 128, g: 86, b: 45 }, 0.18)
  };
}

function drawPot(ctx: CanvasRenderingContext2D, rect: Rect, now: number) {
  const centerX = rect.x + rect.width * 0.5;
  const baseY = rect.y + rect.height * 0.67;
  const potWidth = Math.min(rect.width * 0.76, rect.height * 0.84);
  const potHeight = potWidth * 0.62;
  const potX = centerX - potWidth * 0.5;
  const potY = baseY - potHeight * 0.56;
  const stoveWidth = Math.min(rect.width * 0.9, potWidth * 1.42);
  const stoveHeight = potHeight * 0.36;
  const stoveX = centerX - stoveWidth * 0.5;
  const stoveY = potY + potHeight * 0.94;

  drawStove(ctx, stoveX, stoveY, stoveWidth, stoveHeight, now);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#1d160f";
  ctx.beginPath();
  ctx.ellipse(centerX, stoveY + stoveHeight * 0.72, stoveWidth * 0.48, stoveHeight * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.52;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(10, potWidth * 0.045);
  for (const offset of [-0.22, 0.02, 0.24]) {
    ctx.beginPath();
    ctx.moveTo(centerX + potWidth * offset, potY - potHeight * 0.42);
    ctx.quadraticCurveTo(centerX + potWidth * (offset - 0.04), potY - potHeight * 0.16, centerX + potWidth * (offset + 0.04), potY + potHeight * 0.08);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#6f7c7c";
  ctx.lineWidth = Math.max(8, potWidth * 0.045);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(potX + potWidth * 0.02, potY + potHeight * 0.48);
  ctx.quadraticCurveTo(potX - potWidth * 0.18, potY + potHeight * 0.5, potX - potWidth * 0.15, potY + potHeight * 0.74);
  ctx.moveTo(potX + potWidth * 0.98, potY + potHeight * 0.48);
  ctx.quadraticCurveTo(potX + potWidth * 1.18, potY + potHeight * 0.5, potX + potWidth * 1.15, potY + potHeight * 0.74);
  ctx.stroke();
  ctx.restore();

  const bodyGradient = ctx.createLinearGradient(potX, potY + potHeight * 0.22, potX + potWidth, potY + potHeight * 1.06);
  bodyGradient.addColorStop(0, "#f5fbfb");
  bodyGradient.addColorStop(0.26, "#cfdada");
  bodyGradient.addColorStop(0.62, "#8f9f9f");
  bodyGradient.addColorStop(1, "#e8eeee");
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(potX + potWidth * 0.08, potY + potHeight * 0.34);
  ctx.bezierCurveTo(potX + potWidth * 0.08, potY + potHeight * 0.86, potX + potWidth * 0.18, potY + potHeight * 1.04, potX + potWidth * 0.34, potY + potHeight * 1.08);
  ctx.lineTo(potX + potWidth * 0.66, potY + potHeight * 1.08);
  ctx.bezierCurveTo(potX + potWidth * 0.82, potY + potHeight * 1.04, potX + potWidth * 0.92, potY + potHeight * 0.86, potX + potWidth * 0.92, potY + potHeight * 0.34);
  ctx.closePath();
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(67, 82, 82, 0.5)";
  ctx.lineWidth = Math.max(3, potWidth * 0.016);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(potX + potWidth * 0.28, potY + potHeight * 0.62, potWidth * 0.07, potHeight * 0.28, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const soupRect = { x: potX + potWidth * 0.12, y: potY + potHeight * 0.2, width: potWidth * 0.76, height: potHeight * 0.26 };
  const colors = soupColors(now);
  ctx.save();
  ctx.fillStyle = "#5f6f6f";
  ctx.beginPath();
  ctx.ellipse(centerX, soupRect.y + soupRect.height * 0.5, soupRect.width * 0.58, soupRect.height * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  const soupGradient = ctx.createLinearGradient(0, soupRect.y, 0, soupRect.y + soupRect.height);
  soupGradient.addColorStop(0, rgbCss(colors.top));
  soupGradient.addColorStop(0.55, rgbCss(colors.middle));
  soupGradient.addColorStop(1, rgbCss(colors.bottom));
  ctx.fillStyle = soupGradient;
  ctx.beginPath();
  ctx.ellipse(centerX, soupRect.y + soupRect.height * 0.52, soupRect.width * 0.5, soupRect.height * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawSoupBits(ctx, soupRect, now);
}

function drawSoupBits(ctx: CanvasRenderingContext2D, soupRect: Rect, now: number) {
  const ingredients = placedIngredients.value;
  const soupCx = soupRect.x + soupRect.width * 0.5;
  const soupCy = soupRect.y + soupRect.height * 0.52;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(soupCx, soupCy, soupRect.width * 0.5, soupRect.height * 0.48, 0, 0, Math.PI * 2);
  ctx.clip();

  if (ingredients.some((ingredient) => ingredient.id === "water")) {
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = "#64b5f6";
    ctx.lineWidth = Math.max(3, soupRect.height * 0.08);
    ctx.beginPath();
    ctx.ellipse(soupCx + Math.sin(now * 0.002) * soupRect.width * 0.04, soupCy, soupRect.width * 0.36, soupRect.height * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const [index, ingredient] of ingredients.filter((item) => item.id !== "water").entries()) {
    const flight = flyingIngredients.find((item) => item.ingredient.id === ingredient.id);
    const flightProgress = flight ? clamp((now - flight.startedAt) / flight.durationMs, 0, 1) : 1;
    if (flightProgress < 0.58) continue;
    const sink = clamp((flightProgress - 0.58) / 0.42, 0, 1);
    for (let bit = 0; bit < 4; bit += 1) {
      const bubble = bubbles[(index * 4 + bit) % bubbles.length];
      const x = soupRect.x + soupRect.width * (0.18 + ((index * 0.18 + bit * 0.21 + bubble.x * 0.18) % 0.64));
      const y = soupRect.y + soupRect.height * (0.22 + sink * 0.22 + ((index * 0.17 + bit * 0.13 + bubble.y * 0.12) % 0.22)) + Math.sin(now * 0.003 + bubble.phase) * 2;
      const size = clamp(soupRect.height * (0.06 + bubble.size * 0.018), 3, 8);
      ctx.save();
      ctx.globalAlpha = 0.2 + sink * 0.62;
      ctx.fillStyle = ingredient.color;
      ctx.beginPath();
      if (ingredient.id === "noodles" || ingredient.id === "greens") {
        ctx.ellipse(x, y, size * 0.38, size * 1.35, bit * 0.7, 0, Math.PI * 2);
      } else {
        ctx.arc(x, y, size, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawIngredientGlyph(ctx: CanvasRenderingContext2D, ingredient: SoupIngredient, x: number, y: number, size: number, compact = false, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ingredient.color;
  ctx.strokeStyle = "rgba(20, 28, 34, 0.9)";
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#0f1820";
  switch (ingredient.id) {
    case "water":
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.68);
      ctx.bezierCurveTo(x + size * 0.52, y - size * 0.05, x + size * 0.42, y + size * 0.55, x, y + size * 0.6);
      ctx.bezierCurveTo(x - size * 0.42, y + size * 0.55, x - size * 0.52, y - size * 0.05, x, y - size * 0.68);
      ctx.stroke();
      break;
    case "potatoes":
      ctx.strokeRect(x - size * 0.32, y - size * 0.2, size * 0.64, size * 0.56);
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.2);
      ctx.quadraticCurveTo(x - size * 0.28, y - size * 0.44, x - size * 0.05, y - size * 0.58);
      ctx.moveTo(x, y - size * 0.2);
      ctx.quadraticCurveTo(x + size * 0.3, y - size * 0.42, x + size * 0.16, y - size * 0.62);
      ctx.stroke();
      break;
    case "carrot":
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.58);
      ctx.lineTo(x - size * 0.34, y - size * 0.3);
      ctx.lineTo(x + size * 0.34, y - size * 0.3);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.35);
      ctx.lineTo(x - size * 0.16, y - size * 0.7);
      ctx.moveTo(x, y - size * 0.35);
      ctx.lineTo(x + size * 0.16, y - size * 0.7);
      ctx.stroke();
      break;
    case "onion":
      ctx.beginPath();
      ctx.arc(x, y, size * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "peas":
      for (let index = 0; index < 8; index += 1) {
        const angle = index * Math.PI * 0.25;
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * size * 0.45, y + Math.sin(angle) * size * 0.45, size * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = "#0f1820";
        ctx.fill();
      }
      break;
    case "noodles":
      for (let index = -2; index <= 2; index += 1) {
        ctx.beginPath();
        ctx.moveTo(x + index * size * 0.17, y - size * 0.58);
        ctx.lineTo(x + index * size * 0.06, y + size * 0.58);
        ctx.stroke();
      }
      break;
    case "salt":
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.55);
      ctx.strokeRect(-size * 0.18, -size * 0.46, size * 0.36, size * 0.62);
      ctx.beginPath();
      ctx.moveTo(-size * 0.24, -size * 0.46);
      ctx.lineTo(size * 0.24, -size * 0.46);
      ctx.moveTo(size * 0.3, size * 0.28);
      ctx.lineTo(size * 0.44, size * 0.44);
      ctx.moveTo(size * 0.08, size * 0.34);
      ctx.lineTo(size * 0.22, size * 0.5);
      ctx.stroke();
      ctx.restore();
      break;
    case "greens":
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.28, size * 0.68, -0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - size * 0.42, y + size * 0.42);
      ctx.lineTo(x + size * 0.45, y - size * 0.42);
      ctx.stroke();
      break;
  }
  if (!compact) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.58)";
    ctx.lineWidth = Math.max(1.5, size * 0.04);
    ctx.beginPath();
    ctx.arc(x - size * 0.18, y - size * 0.2, size * 0.22, Math.PI * 0.9, Math.PI * 1.4);
    ctx.stroke();
  }
  ctx.restore();
}

function flightPoint(flight: FlyingIngredient, raw: number) {
  const progress = easeOutCubic(raw);
  const arc = Math.sin(raw * Math.PI) * 86;
  return {
    x: lerp(flight.from.x, flight.to.x, progress),
    y: lerp(flight.from.y, flight.to.y, progress) - arc
  };
}

function drawWaterPour(ctx: CanvasRenderingContext2D, flight: FlyingIngredient, raw: number, now: number) {
  const moveEnd = 0.36;
  const moving = clamp(raw / moveEnd, 0, 1);
  const pouring = clamp((raw - moveEnd) / (1 - moveEnd), 0, 1);
  const ended = clamp((raw - 0.92) / 0.08, 0, 1);
  const pourPosition = {
    x: flight.to.x + clamp(width.value * 0.075, 58, 138),
    y: flight.to.y - clamp(height.value * 0.18, 92, 170)
  };
  const pitcher = raw < moveEnd
    ? {
        x: lerp(flight.from.x, pourPosition.x, easeOutCubic(moving)),
        y: lerp(flight.from.y, pourPosition.y, easeOutCubic(moving)) - Math.sin(moving * Math.PI) * clamp(height.value * 0.12, 46, 96)
      }
    : {
        x: pourPosition.x + Math.sin(now * 0.005) * 2,
        y: pourPosition.y + Math.sin(now * 0.004) * 2
      };

  ctx.save();
  ctx.globalAlpha = 1 - ended;
  if (pouring > 0) {
    const spout = { x: pitcher.x - 24, y: pitcher.y + 12 };
    const target = { x: flight.to.x + Math.sin(now * 0.006) * 4, y: flight.to.y - 6 };
    const streamEnd = easeOutCubic(pouring);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass += 1) {
      ctx.strokeStyle = pass === 0 ? "rgba(30, 144, 255, 0.32)" : "rgba(119, 213, 255, 0.92)";
      ctx.lineWidth = pass === 0 ? clamp(Math.min(width.value, height.value) * 0.024, 12, 30) : clamp(Math.min(width.value, height.value) * 0.011, 5, 15);
      ctx.beginPath();
      for (let step = 0; step <= 26; step += 1) {
        const t = streamEnd * step / 26;
        const bend = Math.sin(t * Math.PI) * clamp(width.value * 0.018, 10, 26);
        const x = lerp(spout.x, target.x, t) - bend + Math.sin(now * 0.009 + step) * 2;
        const y = lerp(spout.y, target.y, t) + Math.sin(t * Math.PI) * 18;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  ctx.translate(pitcher.x, pitcher.y);
  ctx.rotate(raw < moveEnd ? -0.18 : -0.72);
  ctx.fillStyle = "rgba(123, 201, 255, 0.9)";
  ctx.strokeStyle = "#16324a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-14, -20);
  ctx.lineTo(-34, -10);
  ctx.lineTo(-14, -2);
  ctx.stroke();
  ctx.restore();
}

function drawFlyingIngredients(ctx: CanvasRenderingContext2D, now: number) {
  for (const flight of flyingIngredients) {
    const raw = clamp((now - flight.startedAt) / flight.durationMs, 0, 1);
    if (flight.ingredient.id === "water") {
      drawWaterPour(ctx, flight, raw, now);
      continue;
    }
    const point = flightPoint(flight, raw);
    const sink = clamp((raw - 0.68) / 0.32, 0, 1);
    const size = clamp(Math.min(width.value, height.value) * 0.035, 22, 42) * (1 - sink * 0.42);
    drawIngredientGlyph(ctx, flight.ingredient, point.x, point.y + sink * 24, size, false, 1 - raw * 0.3);
  }
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  updateFlights(now);
  const currentLayout = createSoupRecipeLayout(width.value, height.value);
  drawBackground(ctx, now);
  drawHeader(ctx, currentLayout);
  drawPot(ctx, currentLayout.potRect, now);
  drawFlyingIngredients(ctx, now);
}

useGameLoop({ context, draw });

onMounted(() => {
  promptAudio.warm();
  soupFeedback.warm(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearResultTimer();
  promptAudio.cancelPending();
  soupFeedback.dispose();
});

watch(() => session.status, (status) => {
  if (status === "finished") {
    if (!isSpeaking.value) scheduleResultDialog();
  }
  else {
    clearResultTimer();
    resultVisible.value = false;
  }
});

watch(isSpeaking, (speaking) => {
  if (!speaking && session.status === "finished" && !resultVisible.value) scheduleResultDialog();
});
</script>

<template>
  <div class="soup-recipe-shell">
    <GameHud title="Рецепт супа" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <canvas ref="canvasRef" class="soup-canvas" aria-label="Рецепт супа" />
    <div class="soup-recipe-layer" aria-label="Рецепт супа по порядку">
      <div class="soup-recipe-strip" :style="targetStyle(layout.recipeRect)">
        <div
          v-for="ingredient in round.ingredients"
          :key="`recipe:${ingredient.id}`"
          :class="['soup-recipe-step', { 'soup-recipe-step--done': placedIngredientIds.includes(ingredient.id), 'soup-recipe-step--current': nextIngredient?.id === ingredient.id }]"
        >
          <div class="soup-recipe-visual">
            <GameWordImage v-if="ingredient.imageId" :word-id="ingredient.imageId" :word="ingredient.label" :emoji="ingredient.emoji" decorative />
            <v-icon v-else-if="ingredient.icon" :icon="ingredient.icon" />
            <span v-else class="emoji-glyph" aria-hidden="true">{{ ingredient.emoji }}</span>
          </div>
          <span class="soup-recipe-label text-caption font-weight-bold">{{ ingredient.label }}</span>
        </div>
      </div>
    </div>
    <div class="soup-target-layer" aria-label="Ингредиенты для супа">
      <GameDwellButton v-for="slot in ingredientSlots" :key="slot.ingredient.id" class="soup-target" :style="targetStyle(slot.rect)" :target-id="ingredientTargetId(slot.ingredient)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking || placedIngredientIds.includes(slot.ingredient.id)" :dwell-ms="session.settings.dwellMs" :hit-padding="0" :min-height="slot.rect.height" :color="ingredientColor(slot.ingredient)" @select="chooseIngredient(slot.ingredient)">
        <div :class="['soup-ingredient-card', { 'soup-ingredient-card--placed': placedIngredientIds.includes(slot.ingredient.id) }]">
          <div class="soup-ingredient-visual" :style="{ backgroundColor: slot.ingredient.color }">
            <GameWordImage v-if="slot.ingredient.imageId" :word-id="slot.ingredient.imageId" :word="slot.ingredient.label" :emoji="slot.ingredient.emoji" />
            <v-icon v-else-if="slot.ingredient.icon" :icon="slot.ingredient.icon" />
            <span v-else class="emoji-glyph" :aria-label="slot.ingredient.label">{{ slot.ingredient.emoji }}</span>
          </div>
          <div class="soup-ingredient-label text-subtitle-2 text-md-subtitle-1 font-weight-bold">{{ slot.ingredient.label }}</div>
        </div>
      </GameDwellButton>
    </div>
    <GameResultDialog :model-value="resultVisible" title="Рецепт супа" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.soup-recipe-shell {
  background: #eef7f0;
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.soup-canvas {
  display: block;
  inset: 0;
  position: fixed;
}

.soup-target-layer,
.soup-recipe-layer {
  inset: 0;
  pointer-events: none;
  position: fixed;
  z-index: 2;
}

.soup-recipe-layer {
  z-index: 3;
}

.soup-recipe-strip {
  display: grid;
  gap: clamp(0.2rem, 0.45vw, 0.5rem);
  grid-template-columns: repeat(8, minmax(0, 1fr));
  position: absolute;
}

.soup-recipe-step {
  align-items: center;
  background: rgb(var(--v-theme-surface) / 94%);
  border: 0.125rem solid rgb(var(--v-theme-primary) / 14%);
  border-radius: 0.75rem;
  display: flex;
  gap: 0.25rem;
  justify-content: center;
  min-inline-size: 0;
  opacity: 0.62;
  overflow: hidden;
  padding: 0.2rem;
  transition: border-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease, transform 180ms ease;
}

.soup-recipe-step--done {
  background: rgb(var(--v-theme-success) / 13%);
  opacity: 0.82;
}

.soup-recipe-step--current {
  background: rgb(var(--v-theme-warning) / 24%);
  border-color: rgb(var(--v-theme-warning-darken-1));
  box-shadow: 0 0 0 0.2rem rgb(var(--v-theme-warning) / 24%);
  opacity: 1;
  transform: translateY(-0.1rem);
}

.soup-recipe-visual {
  align-items: center;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: clamp(1.8rem, 5dvh, 2.8rem);
  justify-content: center;
}

.soup-recipe-label {
  color: #18211d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.soup-target {
  pointer-events: auto;
  position: absolute;
}

.soup-target :deep(.dwell-button) {
  border: 0.125rem solid rgb(var(--v-theme-primary) / 14%);
  padding: clamp(0.35rem, 1.2dvh, 0.75rem) !important;
}

.soup-target :deep(.dwell-button--active) {
  border-color: rgb(var(--v-theme-primary));
}

.soup-ingredient-card {
  align-items: center;
  color: #18211d;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 0;
  transition: opacity 180ms ease;
}

.soup-ingredient-card--placed {
  opacity: 0.38;
}

.soup-ingredient-visual {
  align-items: center;
  border-radius: 1rem;
  display: inline-flex;
  font-size: clamp(2.75rem, min(6.8vw, 10dvh), 5.25rem);
  justify-content: center;
  margin-block-end: clamp(0.15rem, 0.8dvh, 0.5rem);
  min-block-size: clamp(3.25rem, 10dvh, 5.5rem);
  min-inline-size: clamp(3.25rem, 7vw, 5.5rem);
  padding: 0.2rem;
}

.soup-ingredient-label {
  color: #18211d;
}

.sr-only {
  block-size: 1px;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (max-width: 60rem) {
  .soup-recipe-label {
    display: none;
  }
}
</style>
