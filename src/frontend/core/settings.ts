import { DEFAULT_DWELL_MS, MAX_DWELL_MS, MIN_DWELL_MS } from "./dwellSettings";

export type DifficultyPreset = "gentle" | "standard" | "challenge" | "custom";

export type SessionSettings = {
  preset: DifficultyPreset;
  sessionSeconds: number;
  maxSteps: number;
  dwellMs: number;
  targetScale: number;
  motionSpeed: number;
  distractors: "none" | "low" | "medium";
  hints: "high" | "medium" | "low" | "off";
  sound: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  targetMagnet: boolean;
};

export const presetSettings: Record<Exclude<DifficultyPreset, "custom">, SessionSettings> = {
  gentle: {
    preset: "gentle",
    sessionSeconds: 60,
    maxSteps: 5,
    dwellMs: DEFAULT_DWELL_MS,
    targetScale: 1.35,
    motionSpeed: 0.65,
    distractors: "none",
    hints: "high",
    sound: true,
    highContrast: false,
    reduceMotion: false,
    targetMagnet: true
  },
  standard: {
    preset: "standard",
    sessionSeconds: 120,
    maxSteps: 10,
    dwellMs: DEFAULT_DWELL_MS,
    targetScale: 1,
    motionSpeed: 1,
    distractors: "low",
    hints: "medium",
    sound: true,
    highContrast: false,
    reduceMotion: false,
    targetMagnet: true
  },
  challenge: {
    preset: "challenge",
    sessionSeconds: 180,
    maxSteps: 15,
    dwellMs: DEFAULT_DWELL_MS,
    targetScale: 0.9,
    motionSpeed: 1.2,
    distractors: "medium",
    hints: "low",
    sound: true,
    highContrast: false,
    reduceMotion: false,
    targetMagnet: false
  }
};

export function createDefaultSettings(overrides: Partial<SessionSettings> = {}): SessionSettings {
  const base = presetSettings.standard;
  return clampSettings({ ...base, ...overrides });
}

export function settingsFromPreset(preset: DifficultyPreset): SessionSettings {
  if (preset === "custom") return createDefaultSettings({ preset: "custom" });
  return { ...presetSettings[preset] };
}

export function clampSettings(settings: SessionSettings): SessionSettings {
  return {
   ...settings,
    sessionSeconds: Math.min(300, Math.max(30, settings.sessionSeconds)),
    maxSteps: Math.min(40, Math.max(1, settings.maxSteps)),
    dwellMs: Math.min(MAX_DWELL_MS, Math.max(MIN_DWELL_MS, settings.dwellMs)),
    targetScale: Math.min(2, Math.max(0.8, settings.targetScale)),
    motionSpeed: Math.min(1.4, Math.max(0.4, settings.motionSpeed))
  };
}

export function recommendNextSettings(metrics: {
  successes: number;
  mistakes: number;
  targetCancels: number;
  gazeLostCount: number;
}) {
  if (metrics.gazeLostCount >= 3) return "Часто терялся взгляд: проверь посадку и увеличь цели.";
  if (metrics.targetCancels >= 4) return "Много отмен выбора: увеличь dwell или размер целей.";
  if (metrics.mistakes > metrics.successes) return "Ошибок больше успехов: включи подсказки или gentle preset.";
  if (metrics.successes >= 8 && metrics.mistakes === 0) return "Сессия стабильная: можно усложнить следующий запуск.";
  return "Настройки подходят для повторного запуска.";
}
