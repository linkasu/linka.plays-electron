# Migration Roadmap

## Scope

Переносим все игры из Unity, кроме `Картинг/Лабиринт`.

## Этап 1: Platform Foundation

- Расширить каталог игр.
- Сделать общий game registry.
- Сделать общий экран запуска игры.
- Сделать общий HUD.
- Сделать общий экран результата.
- Довести Tobii status и mouse fallback.

## Этап 2: Gaze Core

- Dwell target composable.
- Gaze metrics.
- Invalid gaze behavior.
- Target magnet.
- Настройки dwell/target size.

## Этап 3: First Games

- `Бабочки` - довести MVP до эталона.
- `Бульк` - dwell click и простые цели.
- `Цветы` - удержание взгляда.
- `Утки` - выбор объектов.

## Этап 4: Basic Cognitive Games

- `Счёт`.
- `Выбери картинку`.
- `Съедобное`.

## Этап 5: Sequence And Search

- `Пирамидка`.
- `Рыбки`.
- `Прятки`.

## Этап 6: Advanced Input

- `Печать слов`.
- `Математика. Операции`.

## Этап 7: Dynamic Games

- `Жаба`.
- `Теннис`.

## Не включать

- `Картинг/Лабиринт`.

## Definition of Done для каждой игры

- Игра доступна из меню.
- Работает мышью.
- Работает через Tobii pointer.
- Есть настройки запуска.
- Есть session progress.
- Есть завершение и результат.
- Есть базовые метрики.
- Есть QA checklist.
- Нет зависания animation frame после выхода.
