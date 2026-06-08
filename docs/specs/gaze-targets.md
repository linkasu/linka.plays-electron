# Gaze Targets Spec

## Цель

Gaze target - любой объект, который может реагировать на взгляд: кнопка, пузырь, цветок, буква, вариант ответа, движущийся объект.

## Модель

```ts
type GazeTarget = {
  id: string;
  bounds: DOMRectReadOnly;
  enabled: boolean;
  dwellMs: number;
  priority: number;
  magnet?: boolean;
  once?: boolean;
  role: "button" | "answer" | "object" | "letter" | "control";
};
```

## Events

```ts
type GazeTargetEvent =
  | { type: "enter"; targetId: string; at: number }
  | { type: "stay"; targetId: string; at: number; progress: number }
  | { type: "cancel"; targetId: string; at: number; reason: "left" | "invalid-gaze" | "disabled" }
  | { type: "click"; targetId: string; at: number; dwellMs: number };
```

## Target selection

Если несколько целей перекрываются:

1. Игнорировать disabled.
2. Выбрать цель, содержащую effective gaze point.
3. Выбрать максимальный `priority`.
4. При равном priority выбрать ближайшую к центру.

## Размеры

Минимальные размеры на easy:

- static target: от `120px`.
- answer card: от `180px` шириной.
- letter key: от `96px`.
- moving object: эффективная зона от `140px`.

## Dwell feedback

Каждая цель должна показывать progress. Это может быть:

- кольцо;
- заполняющаяся рамка;
- мягкое свечение;
- рост объекта;
- progress bar внутри карточки.

## Cooldown

После `click` нужен cooldown `300-700ms`, чтобы не было двойного выбора.
