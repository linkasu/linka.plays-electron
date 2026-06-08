# Session Events Spec

## Цель

Session events нужны для результата, аналитики, адаптации сложности и отладки.

## Event model

```ts
type SessionEvent = {
  id: string;
  sessionId: string;
  gameId: string;
  type: SessionEventType;
  at: number;
  payload?: Record<string, unknown>;
};

type SessionEventType =
  | "session-start"
  | "session-pause"
  | "session-resume"
  | "session-finish"
  | "level-start"
  | "target-enter"
  | "target-cancel"
  | "target-click"
  | "success"
  | "mistake"
  | "hint"
  | "gaze-lost"
  | "gaze-restored"
  | "difficulty-change";
```

## Required payloads

`success`:

```ts
{ step: number; targetId?: string; responseMs?: number }
```

`mistake`:

```ts
{ step: number; targetId?: string; expected?: string; actual?: string }
```

`difficulty-change`:

```ts
{ from: string; to: string; reason: string }
```

## Privacy

Сырые gaze paths могут быть чувствительными. Для обычного отчёта хранить агрегаты. Сырые события включать только в debug/dev mode или с явным согласием.
