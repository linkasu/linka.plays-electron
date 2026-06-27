# Шашки light

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `checkers-light` |
| Route | `/games/checkers-light` |
| Категория | `strategy` — Головоломки |
| Status | `therapy-ready` |
| Resolved stability | `needs-check` |
| Readiness group | `development` |
| Skills | выбор, последовательность, переключение |
| Recommended session | 180 сек |
| Min target size | 126 px |
| Default dwell | 1300 ms |

## Назначение

Упрощённые шашки 4×4: ребёнок выбирает доступную шашку, затем отмеченную клетку для спокойного диагонального хода.

Самостоятельная формулировка для меню: Выбери шашку и сделай спокойный ход по диагонали.

## Игровой цикл

```text
показ поля -> выбор доступной шашки -> выбор отмеченной клетки -> ход засчитывается, отсутствие новых ходов завершает раунд -> итог
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 126 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 16, min visible targets = 16.
- Минимальная short-side эвристика targets: 0.15.

## Дефектологическая ценность

- тренирует планирование и выбор действия
- переводит настольную/аркадную идею в спокойный пошаговый формат
- требует отдельной проверки честного outcome или trainer-позиционирования

## Метрики и сессия

- Сессия должна использовать общий game session flow и завершаться через результат для взрослого.
- Важные метрики: успешные выборы, ошибки/отмены, dwell time, подсказки, потеря валидного взгляда.
- Рекомендуемая длительность занятия: 180 сек.

## Реализация

| Проверка | Состояние |
|---|---|
| Route в router | есть |
| Vue-компонент | `CheckersLightGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | стандартный feedback, TTS через `useGamePromptAudio` |
| Runtime audit doc | `docs/tests/2026-06-10/checkers-light.md` |

## Готовность

Игра находится в группе `development`, потому что resolved stability не равен `publish`.

Автоматические blockers:

- stability:needs-check
- pending-manual-approval

## QA checklist

- Route открывается в Electron, не только в обычном браузере.
- На 800×600 и 1024×600 основные цели видны без ручного скролла.
- HUD, prompt и overlays не перекрывают активные цели.
- Для canvas/fullscreen игры PNG подтверждает непустую сцену и читаемые active zones.
- Звук, если есть, остаётся опциональным и не ломает gameplay при ошибке загрузки.
- Для игр с правилами model tests покрывают правильный ответ, ошибки и завершение раунда.

## Next step

Провести ручной approve после проверки в Electron CDP и оставить `needs-check` до явного решения ревьюера.
