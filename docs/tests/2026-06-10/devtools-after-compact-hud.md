# Electron DevTools after compact HUD — 2026-06-10

Проверка выполнена через Electron CDP target `LINKa plays` на `127.0.0.1:9222` после компактного `GameHud` и уменьшения top padding в P0 strategy screens.

## Изменение HUD

| Viewport | Было | Стало |
|---|---:|---:|
| 1024x600 | 148px | 82px |
| 800x600 | 148px | 116px |

## Runtime-сводка после изменения

| Игра | Viewport | Horizontal overflow | HUD height | Visible targets | Target out | Scroll height | Вывод |
|---|---:|---:|---:|---:|---:|---:|---|
| minesweeper-safe | 1024x600 | no | 82 | 16 | 5 | 1057 | HUD исправлен, часть поля ниже fold. |
| battleship-light | 1024x600 | no | 82 | 10 | 5 | 1330 | HUD исправлен, сетка по высоте всё ещё длинная. |
| calm-2048 | 1024x600 | no | 82 | 2 | 2 | 996 | Controls всё ещё частично ниже fold. |
| calm-tetris | 1024x600 | no | 82 | 0 | 0 | 1450 | Controls не видны в первом viewport, нужен отдельный layout-fix. |
| lines-five | 1024x600 | no | 82 | 10 | 0 | 1050 | Target out исправлен на 1024x600, но страница высокая. |
| minesweeper-safe | 800x600 | no | 116 | 11 | 5 | 1136 | Требуется отдельная компактная раскладка поля/alert. |
| battleship-light | 800x600 | no | 116 | 10 | 5 | 1215 | Требуется отдельная компактная раскладка сетки. |
| calm-2048 | 800x600 | no | 116 | 0 | 0 | 1407 | Controls не видны в первом viewport, нужен отдельный layout-fix. |
| calm-tetris | 800x600 | no | 116 | 0 | 0 | 1417 | Controls не видны в первом viewport, нужен отдельный layout-fix. |
| lines-five | 800x600 | no | 116 | 10 | 5 | 1452 | Требуется отдельная компактная раскладка на narrow width. |

## Решение

- Компактный общий HUD оставить: он убрал главный общий height-regression.
- Не считать P0 layout полностью закрытым: `calm-2048` и `calm-tetris` требуют отдельного compact board/controls layout.
- Следующий layout-пакет должен быть точечным, а не глобальным: снижать высоту header/alerts и переносить controls выше fold в проблемных games.
