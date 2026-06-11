# Game Registry Spec

## Цель

Game registry описывает каталог игр. Он не должен быть просто списком карточек меню. Registry является контрактом между меню, настройками запуска, маршрутизацией, метриками и документацией.

## TypeScript модель

```ts
type GameStatus = "planned" | "mvp" | "therapy-ready" | "polished";
type GameTag = "hidden-from-menu";

type GameSkill =
  | "fixation"
  | "smooth-pursuit"
  | "attention-shift"
  | "visual-search"
  | "choice"
  | "aac"
  | "vocabulary"
  | "classification"
  | "sequence"
  | "counting"
  | "math"
  | "typing"
  | "continuous-control";

type GameInfo = {
  id: string;
  title: string;
  description: string;
  route: string;
  category: string;
  icon: string;
  skills: GameSkill[];
  status: GameStatus;
  tags?: GameTag[];
  recommendedSessionSeconds: number;
  minTargetSizePx: number;
  defaultDwellMs: number;
};
```

## Категории

- `tracker-basics` - знакомство с трекером.
- `words` - учим слова.
- `math` - математика.
- `adventure` - приключения без картинга.

## Игры

Обязательные `id`:

- `bubbles`.
- `butterfly`.
- `ducks`.
- `fishes`.
- `flowers`.
- `frog`.
- `hide-and-seek`.
- `pyramid`.
- `choose-picture`.
- `eat-or-not-eat`.
- `type-word`.
- `count-items`.
- `math-actions`.
- `table-tennis`.

`labyrinth` не добавлять в текущий registry.

## Правила

- `id` должен совпадать с route segment.
- `route` должен быть `/games/<id>`.
- `description` не должен быть пустым.
- `skills` не должен быть пустым.
- `recommendedSessionSeconds` не должен быть больше 180 для базовых игр.
- Если игра `planned`, карточка может быть показана как `Скоро`, но запуск должен быть заблокирован.
- Тег `hidden-from-menu` скрывает игру из меню специалиста и самостоятельного режима, но не удаляет маршрут и не блокирует прямой запуск для тестирования.
