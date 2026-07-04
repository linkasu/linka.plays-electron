# Runtime triage Electron CDP — 2026-06-10

Проверка продолжает `devtools-full-runtime-audit.md`: первичные DOM-метрики были разобраны вручную и через дополнительные CDP-замеры, чтобы отделить реальные дефекты от ложных флагов.

## Подтверждено хорошо

| Проверка | Результат |
|---|---:|
| Все routes из реестра открываются | 169 / 169 |
| Route mismatch | 0 |
| Console/runtime errors | 0 |
| Реальные blank screens после canvas-triage | 0 |

## Canvas-only false positives

Первичный аудит пометил эти игры как `blank`, потому что у них нет `h1` и `.dwell-hitbox`. Дополнительная CDP-проверка показала видимый `<canvas>` размером `800x600`, backing store `800x600` и ненулевые пиксели в sampled frame.

| Игра | Вывод |
|---|---|
| `firefly-meadow` | Canvas render подтвержден, не blank |
| `butterfly` | Canvas render подтвержден, не blank |
| `flowers` | Canvas render подтвержден, не blank |
| `bubble-pop` | Canvas render подтвержден, не blank |
| `ducks` | Canvas render подтвержден, не blank |
| `fishes` | Canvas render подтвержден, не blank |
| `frog` | Canvas render подтвержден, не blank |
| `table-tennis` | Canvas render подтвержден, не blank |

Риск остается не в пустом экране, а в покрытии аудита: canvas-only цели невидимы для DOM/a11y-эвристики. Следующий audit-script должен классифицировать такие игры как `canvas-game` и проверять canvas size/pixel activity отдельно.

## Подтвержденные runtime дефекты

| Приоритет | Игра | Флаг | Доказательство | Минимальный следующий шаг |
|---|---|---|---|---|
| P0 | `gaze-maze` | Horizontal overflow на `800x600` | `overflowX=true`, `targets=5/7`, stage `aspect-ratio: 16/9` + `min-block-size: 28rem` | Исправлено после triage; см. `devtools-after-overflow-fix.md` |
| P0 | `hide-and-seek` | HUD/target overlap на `800x600` | 1 target пересекал fixed HUD; дополнительная проверка показала prompt/target overlap | Исправлено после triage; см. `devtools-after-overlap-fix.md` |
| P0 | `musical-path` | HUD/target overlap на `800x600` | верхний stone target стартовал в зоне HUD из-за процентов от всего viewport | Исправлено после triage; см. `devtools-after-overlap-fix.md` |
| P0 | `rails` | HUD/target overlap на `800x600` | стартовый выбор поезда складывался вертикально под wrapped HUD | Исправлено после triage; см. `devtools-after-overlap-fix.md` |
| P1 | `tic-tac-toe` | Small targets | min visible target `72px`, ниже gaze target spec `120px` | Runtime-флаг `<88px` исправлен; см. `devtools-after-target-size-fix.md` |
| P1 | `connect-four` | Small targets | 7 column targets давали min visible target `72px` | Runtime-флаг `<88px` исправлен; strict `>=120px` требует отдельного redesign выбора колонок |

## Подтвержденный общий layout-риск

Много карточных игр имеют targets в DOM, но первая строка выбора оказывается ниже первого viewport на `800x600` и иногда на `1024x600`. Это не crash, но для gaze-first interaction это практический блокер: указатель gaze/mouse ограничен viewport, а страница не auto-scroll'ится.

| Группа | Примеры | Корневая причина | Следующий шаг |
|---|---|---|---|
| Sequencing карточки | `train-sequence`, `day-routine`, `comic-strip`, `soup-recipe`, `schedule`, `build-bridge`, `sandwich`, `dress-character` | fixed HUD + ручной `padding-block-start` + большой preview/slots/stage перед `GameDwellButton` | Ввести compact-card layout для `max-height:680px`: choices выше, preview ниже/сбоку, stage ограничен по высоте |
| Language/numeracy карточки | `tell-picture`, `who-is-this`, `simple-graphs`, `number-bonds`, `sudoku-2x2` | крупные scene/prompt blocks перед choices; breakpoint зависит от ширины, а баг от высоты | Добавить height-aware compact mode и проверять первые visible targets на `800x600` |
| Strategy trainers | `arkanoid-assist`, `step-pong`, `tanks-no-shooting`, `sokoban-large`, `route-snake`, `uno-like`, `tangram` | основная сцена/подсказка стоит над controls на compact layout | Для strategy pages применить тот же controls-above-fold паттерн, который уже сделан для `number-2048`/`step-tetris` |

## Что не считать багом без продуктового решения

- Беспроигрышность therapeutic gaze-basics/continuous-control игр сама по себе не является дефектом.
- Высокий `scrollHeight/clientHeight` не всегда баг, если основная активная цель видна в первом viewport.
- Canvas-only DOM-empty screen не является blank screen, если canvas видим и рисует кадры.

## Следующие фиксы по порядку

1. Ввести общий compact-card паттерн для sequencing/language/numeracy игр, начиная с `train-sequence`, `tell-picture`, `schedule`, `soup-recipe`.
2. Обновить audit-script: классифицировать canvas routes отдельно и не считать отсутствие `h1/.dwell-hitbox` blank screen для canvas-only игр.
3. Если продуктово требуется strict gaze target `>=120px` для `connect-four`, сделать отдельный redesign выбора колонок.
