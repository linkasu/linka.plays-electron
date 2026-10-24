import { ref } from "vue";

/**
 * Поправка взгляда по замеру на экране «Debug взгляда».
 *
 * Tobii 5 у нас промахивался на 20–74 px даже после калибровки, и промах был
 * не случайным: рос к правому краю и всегда уходил вверх. Такой промах хорошо
 * описывается аффинным преобразованием, поэтому по девяти точкам замера
 * подбираем x' = a·x + b·y + c и y' = d·x + e·y + f (в долях окна, чтобы
 * поправка пережила изменение размера окна) и применяем её ко всему взгляду
 * Tobii в играх. Мышь не трогаем.
 */

export type GazeCorrection = {
  version: 1;
  /** a, b, c для x' в долях окна. */
  x: [number, number, number];
  /** d, e, f для y' в долях окна. */
  y: [number, number, number];
  createdAt: number;
  /** Средний промах по точкам замера без поправки и с ней, в пикселях окна замера. */
  errorBeforePx: number;
  errorAfterPx: number;
};

export type GazeCorrectionPoint = {
  measured: { x: number; y: number };
  target: { x: number; y: number };
};

export type GazeCorrectionFit =
  { ok: true; correction: GazeCorrection } | { ok: false; reason: string };

type Viewport = { width: number; height: number };

const storageKey = "linka-gaze-correction";
const minPoints = 5;
// Поправка не должна переворачивать экран: только небольшой сдвиг и растяжение.
const maxScaleDeviation = 0.25;
const maxCrossTerm = 0.15;
const maxShift = 0.2;

function solve3(m: number[][], v: number[]) {
  const det = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  if (Math.abs(d) < 1e-12) return undefined;
  return [0, 1, 2].map(
    (column) =>
      det(m.map((row, index) => row.map((value, j) => (j === column ? v[index] : value)))) / d,
  ) as [number, number, number];
}

/** Наименьшие квадраты для out ≈ k0·u + k1·v + k2. */
function fitAxis(samples: { u: number; v: number; out: number }[]) {
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const r = [0, 0, 0];
  for (const { u, v, out } of samples) {
    const row = [u, v, 1];
    for (let i = 0; i < 3; i += 1) {
      r[i] += row[i] * out;
      for (let j = 0; j < 3; j += 1) m[i][j] += row[i] * row[j];
    }
  }
  return solve3(m, r);
}

function applyNormalized(correction: GazeCorrection, u: number, v: number) {
  const [a, b, c] = correction.x;
  const [d, e, f] = correction.y;
  return { u: a * u + b * v + c, v: d * u + e * v + f };
}

export function applyGazeCorrection(
  correction: GazeCorrection | undefined,
  point: { x: number; y: number },
  viewport: Viewport,
) {
  if (!correction || viewport.width <= 0 || viewport.height <= 0) return { x: point.x, y: point.y };
  const next = applyNormalized(correction, point.x / viewport.width, point.y / viewport.height);
  return { x: next.u * viewport.width, y: next.v * viewport.height };
}

export function fitGazeCorrection(
  points: GazeCorrectionPoint[],
  viewport: Viewport,
  now = Date.now(),
): GazeCorrectionFit {
  if (points.length < minPoints)
    return { ok: false, reason: `Мало точек: ${points.length} из ${minPoints}.` };

  const samples = points.map(({ measured, target }) => ({
    u: measured.x / viewport.width,
    v: measured.y / viewport.height,
    tx: target.x / viewport.width,
    ty: target.y / viewport.height,
  }));
  const x = fitAxis(samples.map(({ u, v, tx }) => ({ u, v, out: tx })));
  const y = fitAxis(samples.map(({ u, v, ty }) => ({ u, v, out: ty })));
  if (!x || !y) return { ok: false, reason: "Точки лежат на одной линии." };

  if (
    Math.abs(x[0] - 1) > maxScaleDeviation ||
    Math.abs(y[1] - 1) > maxScaleDeviation ||
    Math.abs(x[1]) > maxCrossTerm ||
    Math.abs(y[0]) > maxCrossTerm ||
    Math.abs(x[2]) > maxShift ||
    Math.abs(y[2]) > maxShift
  )
    return {
      ok: false,
      reason: "Промах слишком большой или странный. Откалибруйте Tobii и повторите замер.",
    };

  const correction: GazeCorrection = {
    version: 1,
    x,
    y,
    createdAt: now,
    errorBeforePx: 0,
    errorAfterPx: 0,
  };
  const error = (fix: (point: GazeCorrectionPoint) => { x: number; y: number }) =>
    points.reduce((sum, point) => {
      const p = fix(point);
      return sum + Math.hypot(p.x - point.target.x, p.y - point.target.y);
    }, 0) / points.length;
  correction.errorBeforePx = error((point) => point.measured);
  correction.errorAfterPx = error((point) =>
    applyGazeCorrection(correction, point.measured, viewport),
  );
  if (correction.errorAfterPx >= correction.errorBeforePx)
    return { ok: false, reason: "Поправка не уменьшает промах." };
  return { ok: true, correction };
}

function isCorrection(value: unknown): value is GazeCorrection {
  const c = value as GazeCorrection | undefined;
  const triple = (t: unknown) =>
    Array.isArray(t) &&
    t.length === 3 &&
    t.every((n) => typeof n === "number" && Number.isFinite(n));
  return c?.version === 1 && triple(c.x) && triple(c.y);
}

function loadGazeCorrection() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    return isCorrection(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Текущая поправка; читается один раз при запуске, дальше живёт здесь. */
export const gazeCorrection = ref<GazeCorrection | undefined>(
  typeof window === "undefined" ? undefined : loadGazeCorrection(),
);

export function setGazeCorrection(correction: GazeCorrection | undefined) {
  gazeCorrection.value = correction;
  try {
    if (correction) window.localStorage.setItem(storageKey, JSON.stringify(correction));
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Без хранилища поправка действует до закрытия программы.
  }
}
