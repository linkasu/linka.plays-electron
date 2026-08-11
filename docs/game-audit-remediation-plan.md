# План исправления игр после полного аудита

## Область аудита

Аудит охватывает все 136 игр из `src/frontend/data/games.ts`:

- 35 игр категории `gaze-basics`;
- 17 игр категории `visual-search`;
- 19 игр категории `sequencing`;
- 16 игр категории `language-aac`;
- 20 игр категории `numeracy`;
- 17 игр категории `strategy`;
- 12 игр категории `continuous-control`.

На момент аудита 134 игры имели `stabilityStatus: "publish"`, а `bubble-pop` и `who-is-this` были архивированы. Наличие route, Vue-компонента, документа и model test проверено, но текущий `publish` не считается достаточным доказательством runtime-готовности.

## Главные системные дефекты

1. Пауза меняет статус сессии, но не замораживает TTS, timers, RAF, AI-запросы и async-переходы раунда.
2. Dwell после cooldown повторно активирует ту же цель без ухода взгляда.
3. Mouse click и gaze dwell имеют разную cooldown и telemetry семантику.
4. `minTargetSizePx` не применяется как runtime-контракт и не проверяется CDP-аудитом.
5. Readiness и CDP audits дают ложнозелёный результат: проверяют главным образом registry и стартовый DOM-кадр.
6. Canvas targets не координируются с DOM/HUD targets и почти не измеряются аудитом.
7. Shared dwell controls не имеют полноценной keyboard/switch accessibility.
8. Нет component/E2E-тестов pause, timeout, restart, TTS и result flow.
9. Документация и сохранённые runtime-отчёты не соответствуют текущему registry и реализации.

## Порядок итераций

### Итерация 0. Исполнимые quality gates

- Проверять точное соответствие registry, router, component map, docs и assets.
- Завершать readiness audit с ошибкой при blockers.
- Добавлять commit SHA, версию приложения и число registry-игр в отчёт.
- Запускать adaptive-layout lint по всему frontend в CI.
- Считать полностью видимую часть цели, а не наличие одного видимого пикселя.
- Сверять DOM target с `minTargetSizePx` конкретной игры.
- Добавить instrumentation для canvas targets и интерактивные состояния CDP-аудита.

Критерий завершения: quality gates воспроизводимо отклоняют route mismatch, отсутствующий asset, обрезанную цель, stale docs и непроверяемую canvas-игру.

### Итерация 1. Session и async lifecycle

- Ввести lifecycle `preparing -> running <-> paused -> finishing -> finished/interrupted`.
- Добавить pause-aware timers и active session clock.
- Связать TTS, RAF, AI и delayed transitions с session lifecycle.
- Использовать tokens `{ sessionId, roundId, attemptId }` или AbortController для async continuation.
- Инвалидировать старые callbacks при restart, timeout и unmount.
- Унифицировать terminal outcomes и result visibility.

Критерий завершения: pause в любой фазе не меняет раунд, score или result до resume; restart и unmount не принимают старые callbacks.

### Итерация 2. Dwell, input и accessibility

- Добавить dwell-состояние `awaiting-release`.
- Разрешать повторный выбор только после ухода с цели, invalid input или смены target.
- Унифицировать cooldown для gaze, mouse, keyboard и switch.
- Передавать явный activation source в telemetry.
- Сделать shared dwell primitive нативной доступной кнопкой.
- Реализовать input FSM `no-input -> gaze-active -> gaze-grace -> mouse-active`.
- Перевести smoothing на time-based EMA.

Критерий завершения: одна фиксация даёт ровно один выбор; mouse не маркируется gaze; Enter/Space работают; invalid Tobii не подавляет свежую мышь.

### Итерация 3. Target и layout contract

- Определить `minTargetSizePx` как минимальную полностью видимую короткую сторону эффективной цели.
- Передавать registry target contract в общие DOM layouts.
- Ввести safe canvas play area с учётом HUD и guidance overlays.
- Хранить canvas geometry нормализованно и репроецировать при resize.
- Проверять viewport 800x600, реальное Electron окно 900x600, 1024x600 и DPR 1/2.

Критерий завершения: все обязательные controls полностью видимы, не пересекаются с HUD и соответствуют registry contract.

### Итерация 4. Критичные AAC, numeracy и terminal flow

Партия A:

- `yes-no`;
- `want-dont-want`;
- `social-phrases`;
- `mini-dialog`;
- `what-first`.

Партия B:

- `number-sorting`;
- `shop`;
- `sound-source`;
- `pyramid`;
- `train-sequence`;
- `bells`.

Критерий завершения: коммуникация не записывается как ошибка, TTS соответствует показанной фразе, timeout всегда приводит к доступному result, последовательность завершается только целиком.

### Итерация 5. Gaze, visual search и sequencing

Партия A:

- `magic-dust`;
- `northern-lights`;
- `moon-path`;
- `clouds`;
- `firefly-meadow`;
- `frog`.

Партия B:

- `hide-and-seek`;
- `odd-one-out`;
- `find-emotion`;
- `gaze-maze`;
- `memory-cards`.

Партия C:

- `build-robot`;
- `dress-character`;
- `patterns`;
- `color-pattern`;
- `shape-dance`;
- `solfege`.

Критерий завершения: финальные состояния достижимы, задания однозначны, правильная позиция не предсказуема, pause не блокирует следующий раунд.

### Итерация 6. Strategy и native rules

- `battleship-light`: вернуть gaze-секторный выбор вместо 100 мелких targets.
- `chess-mini`: определить trainer/full-game scope, добавить native rule tests и preflight/fallback.
- `sokoban-large`: deadlock detection, restart и terminal outcome.
- `domino-matching`: корректные pass, blocked, bot-win и telemetry outcomes.
- `step-tetris`, `checkers-light`, AI-игры: pause-safe request lifecycle.
- Добавить native/TypeScript parity tests для общих движков.

Критерий завершения: legal moves и terminal outcomes проверены, stale AI response не меняет новую партию, игровые доски пригодны для gaze на обязательных viewport.

### Итерация 7. Continuous control

- Исправить Tobii/mouse arbitration, visibility pause и frame-rate independence.
- Устранить success при invalid input.
- Убрать пересечение canvas targets с guidance cards.
- Согласовать target geometry и registry metadata.
- Разделить assisted/no-fail и strict loss modes.
- Извлечь сложную state logic из Vue в testable models.

Приоритетная партия: `boat`, `road-car`, `glider`, `robot-vacuum`, `line-drawing`, `rails`, затем остальные continuous-control игры.

Критерий завершения: одинаковое поведение при 30/60/120 FPS, resize, DPR 1/2, valid/invalid gaze и mouse takeover.

### Итерация 8. Контент, документация и публикация

- Проверить семантическую однозначность всех заданий.
- Проверить AAC refusal, stop, help и repeat как самостоятельные коммуникационные outcomes.
- Сверить model copy, UI copy, TTS manifest и реальные assets.
- Обновить game specs и удалить stale runtime claims.
- Повторить полный Electron CDP/PNG audit всех 136 routes.
- Подтверждать `publish` только после unit, component, runtime и ручного PNG review.

## Продуктовые решения

- Assisted/no-fail является режимом по умолчанию; strict outcome включается явно.
- `who-is-this` остаётся архивным до миграции старых ссылок, затем удаляется как дубль `match-same`.
- `hide-and-seek` перерабатывается в настоящую сцену поиска.
- `chess-mini` позиционируется как trainer, пока не реализованы и не протестированы полные шахматные правила.
- Для `solfege` текущая staged-механика становится нормативной только после синхронизации docs и acceptance tests.

## Проверки после каждой партии

```bash
npm run typecheck
npm run test:unit
npm run lint:adaptive-layout -- --all
npm run audit:readiness
```

Для frontend/game changes дополнительно выполняется targeted Electron CDP audit с PNG реального Electron viewport. Перед публикацией выполняется полный `audit:electron-cdp:all`, ручной просмотр initial, active, mistake, pause и result состояний и проверка mouse/Tobii fallback.

## Итоговая проверка 2026-08-10

- Readiness: 136 игр, 134 `publish`, 2 `archived`, blockers отсутствуют.
- Electron CDP: 136 routes × 3 viewport = 408 проверок, failures отсутствуют.
- `minTargetSizePx` синхронизирован с измеренной полностью видимой короткой стороной эффективной DOM-цели.
- PNG сохранены в `/tmp/linka-plays-cdp-screenshots-green`, JSON-отчёт — `/tmp/linka-plays-cdp-green.json`.
- `npm run typecheck`, `npm run test:unit`, `npm run lint:adaptive-layout -- --all`, `npm run audit:readiness`, `npm run audit:tts-assets` и `npm run build:native` проходят.
