import { games } from "../data/games";
import { resolveDwellMs } from "../core/dwellSettings";
import { useGameSession } from "../core/session";
import type { SessionSettings } from "../core/settings";

export type UseGameSessionForOptions = {
  overrides?: Partial<SessionSettings>;
  maxSteps?: number;
  finishOnMaxSteps?: boolean;
  finishOnMistakes?: boolean;
  finishOnTimeout?: boolean;
};

export function createInitialSessionSettings(gameId: string, options: UseGameSessionForOptions = {}, resolveActiveDwellMs = resolveDwellMs) {
  const info = games.find((game) => game.id === gameId);
  const overrides = options.overrides ?? {};
  const initial: Partial<SessionSettings> = {
    sessionSeconds: info?.recommendedSessionSeconds,
    maxSteps: options.maxSteps,
    ...overrides,
    dwellMs: overrides.dwellMs ?? resolveActiveDwellMs(info?.defaultDwellMs)
  };

  for (const key of Object.keys(initial) as (keyof SessionSettings)[]) {
    if (initial[key] === undefined) delete initial[key];
  }

  return initial;
}

export function useGameSessionFor(gameId: string, options: UseGameSessionForOptions = {}) {
  const initial = createInitialSessionSettings(gameId, options);

  return useGameSession(gameId, initial, {
    finishOnMaxSteps: options.finishOnMaxSteps,
    finishOnMistakes: options.finishOnMistakes,
    finishOnTimeout: options.finishOnTimeout
  });
}
