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
  | "session-interrupt"
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

Локальный `payload` может содержать данные, нужные игровой логике, но не является сетевым payload. Перед IPC центральная проекция удаляет `targetId`, expected/actual, текст, board/FEN, координаты и timestamp указателя. Непрерывные gaze/mouse samples никогда не отправляются, включая debug/dev mode; в session summary передаются только раздельные счётчики и gaze-агрегаты.
