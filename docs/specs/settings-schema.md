# Settings Schema

## Session settings

```ts
type SessionSettings = {
  preset: "gentle" | "standard" | "challenge" | "custom";
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
```

## Defaults

Gentle:

- `sessionSeconds: 60`.
- `maxSteps: 5`.
- `dwellMs: 1400`.
- `targetScale: 1.35`.
- `motionSpeed: 0.65`.
- `distractors: none`.
- `hints: high`.

Standard:

- `sessionSeconds: 120`.
- `maxSteps: 10`.
- `dwellMs: 1000`.
- `targetScale: 1`.
- `motionSpeed: 1`.
- `distractors: low`.
- `hints: medium`.

Challenge:

- `sessionSeconds: 180`.
- `maxSteps: 15`.
- `dwellMs: 750`.
- `targetScale: 0.9`.
- `motionSpeed: 1.2`.
- `distractors: medium`.
- `hints: low`.

## Правила безопасности

- `dwellMs` не ниже `500` без expert mode.
- `targetScale` не ниже `0.8` без expert mode.
- `motionSpeed` не выше `1.4` без expert mode.
- `sessionSeconds` не выше `300` без явного подтверждения взрослого.
