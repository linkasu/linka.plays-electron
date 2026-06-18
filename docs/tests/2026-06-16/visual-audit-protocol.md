# Visual Electron CDP audit protocol — 2026-06-16

Этот протокол описывает, как собрать реальные PNG из Electron window для текущего реестра игр. Он не заменяет ручной просмотр скриншотов.

## Почему Electron, а не браузер

Layout, размеры окна, preload, IPC и Tobii-related окружение должны проверяться в настоящем Electron `BrowserWindow`. Обычная вкладка Vite подходит только для быстрой разработки, но не доказывает готовность игры.

## Slot 0

В одном терминале:

```bash
npm run build:electron
npx vite --host 127.0.0.1 --port 5173 --strictPort
```

Во втором терминале:

```bash
env -u NODE_OPTIONS VITE_DEV_SERVER_URL=http://127.0.0.1:5173 LINKA_DEV_SESSION=slot-0 LINKA_TOBII_SOCKET_NAME=su.linka.plays.tobiifree.slot-0 npx electron --remote-debugging-port=9222 dist-electron/main.js
```

Проверить Electron CDP targets:

```bash
curl --noproxy 127.0.0.1,localhost http://127.0.0.1:9222/json/list
```

## Сбор JSON и PNG

Скриншоты лучше писать во временную папку, чтобы не раздувать репозиторий PNG-файлами:

```bash
npm run audit:electron-cdp:all -- --port=9222 --output=docs/tests/2026-06-16/electron-cdp-audit.json --screenshot-dir=/tmp/linka-plays-cdp-screenshots/2026-06-16
```

Существующий runner: `scripts/electron-cdp-smoke.mjs`.

Он собирает CDP-метрики и сохраняет PNG для routes из текущего `src/frontend/data/games.ts` при `--all-games`.

## Что смотреть вручную

Просмотреть PNG обязательно для:

- всех `development` игр из `readiness-audit.json`;
- всех routes с CDP failures;
- всех canvas-only или fullscreen игр;
- всех игр, где JSON показывает `targetCount > 0` и `visibleTargetCount === 0`;
- всех игр с `horizontalOverflow`, `hudOverlapCount`, `lowContrastTargetCount`;
- выборочно для ready-игр из каждой категории.

## Критерии pass/warn/blocker

| Статус | Критерий |
|---|---|
| `pass` | Route открыт, экран не пустой, основные действия видны в первом viewport, targets крупные, HUD/prompt не мешают, визуально игра понятна. |
| `warn` | Играть можно, но есть длинная страница, часть вторичных карточек ниже fold, спорная плотность текста или визуальная шероховатость. |
| `blocker` | Основные controls ниже первого viewport, target перекрыт HUD/prompt, canvas пустой, сцена обрезана, есть runtime error или очевидно невозможно начать/продолжить игру gaze-first. |

## Canvas-specific checks

Для canvas/fullscreen игр DOM targets могут отсутствовать. Не считать это дефектом само по себе.

Проверить по PNG:

- canvas видим и не пустой;
- основная сцена занимает ожидаемую область;
- HUD, подсказка и overlay не закрывают активную область;
- мышиный fallback визуально возможен;
- терапевтический feedback спокойный и не выглядит резким.

## Card/choice checks

Для карточных игр:

- первая активная строка choices должна быть в первом viewport на `800x600`;
- preview/stage не должен выталкивать controls ниже fold;
- минимум одна правильная action target должна быть видима без скролла;
- карточки должны быть достаточно крупными для gaze, целевой стандарт для новых правок — не меньше 120 px по короткой стороне.

## После прогона

1. Сверить JSON summary с `readiness-audit.json`.
2. Внести в новый markdown отчёт список `pass`, `warn`, `blocker` по категориям.
3. Начинать shared layout fixes с повторяющихся blockers, а не с одиночных визуальных симптомов.
4. После каждой группы фиксов повторять Electron CDP audit для затронутых routes и сохранять новый отчёт.
