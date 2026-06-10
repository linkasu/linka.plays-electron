# Electron DevTools baseline P0 — 2026-06-10

Проверка выполнена через реальный Electron CDP target `LINKa plays` на `127.0.0.1:9222`, а не через обычный браузерный Vite tab.

Команды запуска:

```bash
npm run build:electron
npx vite --host 127.0.0.1 --port 5173 --strictPort
env -u NODE_OPTIONS VITE_DEV_SERVER_URL=http://127.0.0.1:5173 LINKA_DEV_SESSION=slot-0 LINKA_TOBII_SOCKET_NAME=su.linka.plays.tobiifree.slot-0 npx electron --remote-debugging-port=9222 dist-electron/main.js
```

## Цель

Снять базовые runtime-метрики для P0 strategy-игр перед/во время исправления: горизонтальный overflow, высота HUD, видимые dwell targets, пересечения HUD с targets, элементы вне первого viewport.

## Сводка

| Игра | Viewport | Horizontal overflow | HUD height | Видимых targets | Min target | Targets вне viewport | Large cards вне viewport | Главный runtime-риск |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| minesweeper-safe | 1366x768 | no | 98 | 21 | 100 | 5 | 1 | Нижняя подсказка и часть поля ниже первого экрана. |
| battleship-light | 1366x768 | no | 98 | 15 | 131 | 5 | 1 | Поле 5x5 не помещается целиком по высоте. |
| calm-2048 | 1366x768 | no | 98 | 6 | 112 | 2 | 1 | Управление частично ниже первого экрана. |
| calm-tetris | 1366x768 | no | 98 | 0 | 0 | 0 | 2 | Интерактивные controls не попали в первый viewport, страница высокая. |
| lines-five | 1366x768 | no | 98 | 20 | 104 | 5 | 1 | Правая информационная карточка/нижние цели ниже первого экрана. |
| minesweeper-safe | 1024x600 | no | 148 | 16 | 100 | 5 | 1 | HUD переносится до 148px, поле и alert уходят ниже fold. |
| battleship-light | 1024x600 | no | 148 | 10 | 133 | 5 | 1 | Часть сетки ниже fold; HUD высокий. |
| calm-2048 | 1024x600 | no | 148 | 2 | 132 | 2 | 1 | Почти все controls ниже fold. |
| calm-tetris | 1024x600 | no | 148 | 0 | 0 | 0 | 4 | Controls/карточки не видны в первом viewport. |
| lines-five | 1024x600 | no | 148 | 10 | 104 | 5 | 2 | Часть сетки и боковая карточка ниже fold. |
| minesweeper-safe | 800x600 | no | 148 | 11 | 100 | 5 | 1 | Alert на y=1032, большая вертикальная прокрутка. |
| battleship-light | 800x600 | no | 148 | 10 | 135 | 5 | 1 | Сетка требует вертикальной прокрутки. |
| calm-2048 | 800x600 | no | 148 | 0 | 0 | 0 | 5 | Controls не видны в первом viewport, высота страницы 1427px. |
| calm-tetris | 800x600 | no | 148 | 0 | 0 | 0 | 4 | Controls не видны в первом viewport, высота страницы 1437px. |
| lines-five | 800x600 | no | 148 | 10 | 104 | 5 | 2 | Вторая подсказка на y=1324, страница 1496px. |

## Выводы

- Горизонтального overflow в P0-наборе не найдено.
- Основной подтвержденный runtime-баг общий: высокий fixed HUD плюс карточный layout делают первый экран неполным на 1024x600 и 800x600.
- `calm-2048` и `calm-tetris` особенно проблемны на 800x600: интерактивные dwell controls отсутствуют в первом viewport.
- Targets не пересекаются с HUD, но многие targets/alerts ниже первого viewport; это не критично для mouse, но плохо для gaze-first интерфейса, где пользователь ожидает крупные цели сразу.
- Минимальные размеры видимых targets в P0-наборе не падают ниже 100px, то есть проблема не в размере, а в вертикальной компоновке.

## Следующие фиксы

- Для P0 strategy-игр сначала довести правила win/loss и тексты до честного состояния.
- Затем сделать компактный top-safe layout для карточных strategy-игр: уменьшить ручной `padding-block-start`, убрать лишнюю высоту header/alerts на малых viewport, разместить controls рядом с полем или выше fold.
- После каждого layout-пакета повторить этот CDP-скрипт и обновить результаты.
