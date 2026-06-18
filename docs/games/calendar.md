# Календарь

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `calendar` |
| Route | `/games/calendar` |
| Категория | `numeracy` — Счёт и математика |
| Status | `therapy-ready` |
| Resolved stability | `needs-check` |
| Readiness group | `development` |
| Skills | выбор, последовательность, словарь |
| Recommended session | 130 сек |
| Min target size | 190 px |
| Default dwell | 1300 ms |

## Назначение

undefined

Самостоятельная формулировка для меню: undefined

## Игровой цикл

```text
показ числовой задачи -> выбор или ввод ответа крупной целью -> проверка -> следующий пример
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 190 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 4, min visible targets = 4.
- Минимальная short-side эвристика targets: 0.23.

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
| Vue-компонент | `CalendarGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | нет |
| Runtime audit doc | `docs/tests/2026-06-10/calendar.md` |

## Готовность

Игра находится в группе `development`, потому что resolved stability не равен `publish`.

Автоматические blockers:

- stability:needs-check
- missing-game-doc

## QA checklist

- Route открывается в Electron, не только в обычном браузере.
- На 800×600 и 1024×600 основные цели видны без ручного скролла.
- HUD, prompt и overlays не перекрывают активные цели.
- Для canvas/fullscreen игры PNG подтверждает непустую сцену и читаемые active zones.
- Звук, если есть, остаётся опциональным и не ломает gameplay при ошибке загрузки.
- Для игр с правилами model tests покрывают правильный ответ, ошибки и завершение раунда.

## Next step

Разобрать blockers из readiness-аудита, затем повторить Electron CDP/PNG audit и принять решение о `stabilityStatus: "publish"`.
