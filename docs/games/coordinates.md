# Координаты

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `coordinates` |
| Route | `/games/coordinates` |
| Категория | `numeracy` — Счёт и математика |
| Status | `therapy-ready` |
| Resolved stability | `needs-check` |
| Readiness group | `development` |
| Skills | поиск, выбор, арифметика |
| Recommended session | 130 сек |
| Min target size | 160 px |
| Default dwell | 1300 ms |

## Назначение

Найти клетку 3×3 по координате A1, B2 или C3. Ошибка не подсвечивает правильную клетку.

Самостоятельная формулировка для меню: найди клетку по координате.

## Игровой цикл

```text
показ числовой задачи -> выбор или ввод ответа крупной целью -> проверка -> следующий пример
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 160 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 9, min visible targets = 9.
- Минимальная short-side эвристика targets: 0.166.

## Дефектологическая ценность

- закрепляет количество, число или операцию через крупные цели
- позволяет повторять короткие задания без таймера
- поддерживает мягкую ошибку и повтор

## Метрики и сессия

- Сессия должна использовать общий game session flow и завершаться через результат для взрослого.
- Важные метрики: успешные выборы, ошибки/отмены, dwell time, подсказки, потеря валидного взгляда.
- Рекомендуемая длительность занятия: 130 сек.

## Реализация

| Проверка | Состояние |
|---|---|
| Route в router | есть |
| Vue-компонент | `CoordinatesGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | стандартный feedback, TTS через `useGamePromptAudio` |
| Runtime audit doc | `docs/tests/2026-06-10/coordinates.md` |

## Готовность

Игра находится в группе `development`, потому что resolved stability не равен `publish`.

Автоматические blockers:

- stability:needs-check
- нет

## QA checklist

- Route открывается в Electron, не только в обычном браузере.
- На 800×600 и 1024×600 основные цели видны без ручного скролла.
- HUD, prompt и overlays не перекрывают активные цели.
- Для canvas/fullscreen игры PNG подтверждает непустую сцену и читаемые active zones.
- Звук, если есть, остаётся опциональным и не ломает gameplay при ошибке загрузки.
- Для игр с правилами model tests покрывают правильный ответ, ошибки и завершение раунда.

## Next step

Проверить в Electron CDP на 800×600/1024×600 и визуально подтвердить PNG перед approve.
