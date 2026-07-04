# Game Registry Spec

## Цель

`src/frontend/data/games.ts` — источник правды для каталога игр. Registry связывает меню, маршруты, настройки запуска, метрики, ready/development gate и документацию.

## TypeScript модель

Актуальная форма записи:

```ts
type GameInfo = {
 id: string;
 title: string;
 description: string;
 selfDescription: string;
 route: string;
 category: GameCategoryId;
 icon: string;
 skills: GameSkill[];
 status: GameStatus;
 stabilityStatus?: GameStabilityStatus;
 tags?: GameTag[];
 recommendedSessionSeconds: number;
 minTargetSizePx: number;
 defaultDwellMs: number;
};
```

Статусы качества:

```ts
type GameStatus = "planned" | "mvp" | "therapy-ready" | "polished";
```

Статусы публикационной стабильности:

```ts
type GameStabilityStatus = "needs-check" | "prefixed" | "publish" | "archived";
```

Теги:

```ts
type GameTag = "hidden-from-menu";
```

## Категории

Текущие категории должны совпадать с `gameCategoryOrder`:

| ID | Назначение |
|---|---|
| `gaze-basics` | первые игры для фиксации, переключения и попадания взглядом |
| `visual-search` | поиск объектов, внимание и удержание цели |
| `sequencing` | порядок действий, сборка и очередность шагов |
| `language-aac` | картинки, слова, AAC и смысловые категории |
| `numeracy` | количество, числа и простая математика |
| `strategy` | головоломки, настольные и пошаговые задачи |
| `continuous-control` | слежение взглядом и непрерывное управление взглядом |

## Ready/development gate

Ready определяется не только `status: "polished"`. Для публикационной готовности используется resolved stability.

Правило:

```ts
function resolveGameStabilityStatus(game: GameInfo): GameStabilityStatus {
 if (game.stabilityStatus) return game.stabilityStatus;
 if (game.tags?.includes("hidden-from-menu")) return "archived";
 return game.status === "polished" ? "publish": "needs-check";
}
```

Группы:

| Группа | Правило |
|---|---|
| `ready` | `resolveGameStabilityStatus(game) === "publish"` |
| `development` | всё кроме `publish`: `needs-check`, `prefixed`, `archived`, скрытые или спорные игры |

Такое правило позволяет считать ready не только `polished`-игры, но и `therapy-ready` игры с явным `stabilityStatus: "publish"`.

## Правила записи

- `id` должен совпадать с route segment.
- `route` должен быть `/games/<id>`.
- `title`, `description` и `selfDescription` не должны быть пустыми.
- `category` должен входить в `GameCategoryId`.
- `skills` не должен быть пустым.
- `recommendedSessionSeconds`, `minTargetSizePx` и `defaultDwellMs` должны отражать фактическую игру, а не только желаемую настройку.
- `hidden-from-menu` скрывает игру из меню, но не должен удалять route и не блокирует прямой запуск для тестирования.
- Явный `stabilityStatus` нужен, когда публикационная готовность отличается от дефолта по `status`.

## Promotion в ready

Игра может считаться ready, если:

- route и Vue-компонент существуют;
- Electron CDP runtime-аудит проходит без route mismatch, blank-like screen, runtime errors и horizontal overflow;
- активные gaze targets видны в первом viewport на `800x600` и `1024x600`;
- HUD и подсказки не перекрывают активные targets;
- для игр с существенными правилами есть `model.ts` и `model.test.ts`;
- для `strategy` есть честный outcome или игра явно позиционирована как trainer;
- звук необязателен и не ломает gameplay при ошибке загрузки;
- визуальный PNG-аудит реального Electron window принят.

## Аудит

Быстрый readiness manifest:

```bash
npm run audit:readiness -- --output=docs/tests/<date>/readiness-audit.json
```

Полный Electron CDP audit текущего реестра:

```bash
npm run audit:electron-cdp:all -- --port=9222 --output=docs/tests/<date>/electron-cdp-audit.json --screenshot-dir=/tmp/linka-plays-cdp-screenshots
```

Для layout и визуального качества нельзя полагаться на обычный браузер: проверка должна идти через реальный Electron CDP target.
