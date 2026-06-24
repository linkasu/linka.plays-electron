# Electron CDP visual audit — 2026-06-16

Аудит выполнен на реальном Electron CDP target `LINKa plays` через slot `5174/9223`.

Команда:

```bash
npm run audit:electron-cdp:all -- --port=9223 --output=docs/tests/2026-06-16/electron-cdp-audit.json --screenshot-dir=/tmp/linka-plays-cdp-screenshots/2026-06-16
```

Машиночитаемый отчёт: `electron-cdp-audit.json`.

PNG: `/tmp/linka-plays-cdp-screenshots/2026-06-16`.

## Summary

| Метрика | Значение |
|---|---:|
| Routes | 154 |
| Viewports per route | 3 |
| Проверок | 462 |
| CDP failures | 0 |
| Routes с failures | 0 |
| Routes без DOM targets, но с canvas | 45 |
| Routes без DOM targets и без canvas | 0 |
| Routes с DOM targets | 109 |
| Routes ниже строгого целевого размера 120 px по эвристике `shortSideRatio < 0.15` | 0 |

## Ручной PNG-review выборки

| Игра | PNG | Визуальный статус | Наблюдение |
|---|---|---|---|
| `dress-character` | `games-dress-character-800x600.png` | `pass` | Основные 3 choices видны, персонаж и подсказка читаются. |
| `soup-recipe` | `games-soup-recipe-800x600.png` | `warn` | Все 8 ингредиентов видны и playable; кастрюля ниже fold, но это вторичная сцена. |
| `arkanoid-assist` | `games-arkanoid-assist-800x600.png` | `pass` | Сцена и 3 sector controls видны в первом viewport. |
| `cursor-magnet` | `games-cursor-magnet-800x600.png` | `blocker` до фикса | Большой центральный intro overlay перекрывал сцену и часть целей. |
| `aquarium` | `games-aquarium-800x600.png` | `pass` | Canvas заполнен, рыбы видны, HUD не закрывает игровую область. |
| `orchestra-conductor` | `games-orchestra-conductor-800x600.png` | `warn` | Overlay крупный и закрывает центр сцены, но active дуга и beat zones читаются. |
| `schedule` | `games-schedule-800x600.png` | `warn` | Все 8 карточек выбора видны; следующий preview ниже fold. |
| `sudoku-2x2` | `games-sudoku-2x2-800x600.png` | `warn` | Две choices видны крупно; нижняя часть поля уходит ниже viewport. |
| `step-pong` | `games-step-pong-800x600.png` | `pass` | Сцена и 3 position controls видны в первом viewport. |
| `table-tennis` | `games-table-tennis-800x600.png` | `pass` | Polished canvas-эталон: поле, ракетки, мяч и HUD читаются. |
| `choose-emotion` | `games-choose-emotion-800x600.png` | `pass` | 3 крупные эмоции видны, prompt не мешает выбору. |

## Strict target-size queue

Очередь строгого target-size закрыта. Повторный targeted audit по 11 routes сохранён в `strict-target-size-after-fixes.json` и PNG-папке `/tmp/linka-plays-cdp-screenshots/2026-06-16-strict-target-size-after`.

Проверенные routes:

- `/games/pyramid`
- `/games/coin-counting`
- `/games/minesweeper-safe`
- `/games/tic-tac-toe`
- `/games/connect-four`
- `/games/reversi-light`
- `/games/lines-five`
- `/games/checkers-light`
- `/games/battleship-light`
- `/games/arkanoid-assist`
- `/games/step-pong`

Итог targeted audit: 33 проверки, failures = 0, routes ниже `shortSideRatio < 0.15` = 0.

## Targeted fix после полного прогона

`cursor-magnet` проверен повторно после compact overlay fix:

```bash
npm run audit:electron-cdp -- --port=9223 --routes=/games/cursor-magnet --output=docs/tests/2026-06-16/cursor-magnet-after-overlay-fix.json --screenshot-dir=/tmp/linka-plays-cdp-screenshots/2026-06-16-cursor-magnet-after
```

Результат targeted CDP: failures = 0. Свежий PNG `games-cursor-magnet-800x600.png` в `/tmp/linka-plays-cdp-screenshots/2026-06-16-cursor-magnet-after` показывает compact panel справа сверху: центр сцены, цель и предметы читаются. Визуальный статус после фикса: `pass`.

## Вывод

- Текущий полный Electron CDP прогон не подтвердил P0 runtime/layout failures.
- После strict target-size fixes полный all-games прогон показывает routes ниже `shortSideRatio < 0.15` = 0.
- Старые first-viewport blockers у карточных games в проверенной выборке в основном закрыты: активные choices видны на `800x600`.
- Основной визуальный blocker по ручной выборке был `cursor-magnet`; после targeted compact overlay fix он прошёл повторную CDP/PNG-проверку.
- Следующая очередь улучшений: документационное покрытие `docs/games/<id>.md` и продуктовые decisions для development strategy/trainer игр.
