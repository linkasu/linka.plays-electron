# Electron DevTools after controls reorder — 2026-06-10

Проверка выполнена через Electron CDP target `LINKa plays` на `127.0.0.1:9222` после перестановки controls выше поля на narrow layout.

## Проверенные игры

| Игра | Viewport | Horizontal overflow | Visible targets | Min target | First target top | HUD height | Вывод |
|---|---:|---:|---:|---:|---:|---:|---|
| number-2048 | 800x600 | no | 4 | 132 | 390 | 116 | Основные direction controls теперь видны в первом viewport. |
| step-tetris | 800x600 | no | 4 | 116 | 366 | 116 | Основные movement/drop controls теперь видны в первом viewport. |

## Решение

- На узких экранах `number-2048` и `step-tetris` визуально показывают controls перед board через Vuetify order classes.
- Логика игры не менялась.
- Проблема длинной страницы остается, но gaze-first блок управления больше не находится полностью ниже первого экрана.
