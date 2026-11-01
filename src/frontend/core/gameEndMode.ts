import { readonly, ref } from "vue";
import type { SessionFinishReason } from "./session";

export type GameEndMode = "successes" | "endless" | "timed";

export const gameEndModeLabels: Record<GameEndMode, string> = {
  successes: "До 8 успехов",
  endless: "Бесконечно",
  timed: "На время",
};
export const gameEndModes = Object.keys(gameEndModeLabels) as GameEndMode[];

export const GAME_TIME_LIMIT_MINUTES = [1, 3, 5, 10] as const;
export const DEFAULT_GAME_TIME_LIMIT_MINUTES = 3;

const endModeStorageKey = "linka-game-end-mode";
const timeLimitStorageKey = "linka-game-time-limit-minutes";

// These games have no success goal of their own: time is the only thing that ends them.
const timeEndedGameIds = new Set([
  "ducks",
  "fishes",
  "magic-dust",
  "moon-path",
  "northern-lights",
  "table-tennis",
  "warm-fire",
]);

const continuingFinishReasons = new Set<SessionFinishReason>([
  "max-steps",
  "game-complete",
  "game-lost",
  "game-draw",
]);

export function normalizeGameEndMode(value: unknown): GameEndMode {
  return gameEndModes.includes(value as GameEndMode) ? (value as GameEndMode) : "successes";
}

export function normalizeGameTimeLimitMinutes(value: unknown) {
  const minutes = Number(value);
  return (GAME_TIME_LIMIT_MINUTES as readonly number[]).includes(minutes)
    ? minutes
    : DEFAULT_GAME_TIME_LIMIT_MINUTES;
}

export function isTimeEndedGame(gameId: string) {
  return timeEndedGameIds.has(gameId);
}

export function continuesAfterFinish(mode: GameEndMode, reason: SessionFinishReason | undefined) {
  return mode !== "successes" && reason !== undefined && continuingFinishReasons.has(reason);
}

function loadStored(key: string) {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The setting remains active for this run when storage is unavailable.
  }
}

const gameEndMode = ref(normalizeGameEndMode(loadStored(endModeStorageKey)));
const gameTimeLimitMinutes = ref(normalizeGameTimeLimitMinutes(loadStored(timeLimitStorageKey)));

export function setGameEndMode(value: unknown) {
  gameEndMode.value = normalizeGameEndMode(value);
  store(endModeStorageKey, gameEndMode.value);
}

export function setGameTimeLimitMinutes(value: unknown) {
  gameTimeLimitMinutes.value = normalizeGameTimeLimitMinutes(value);
  store(timeLimitStorageKey, String(gameTimeLimitMinutes.value));
}

// Keys the page in App.vue, so that changing it mounts the game afresh.
export const gameMountEpoch = ref(0);

export function mountGameAfresh() {
  gameMountEpoch.value += 1;
}

export function useGameEndMode() {
  return {
    gameEndMode: readonly(gameEndMode),
    gameTimeLimitMinutes: readonly(gameTimeLimitMinutes),
    setGameEndMode,
    setGameTimeLimitMinutes,
  };
}
