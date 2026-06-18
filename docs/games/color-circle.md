# Цветной круг

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `color-circle` |
| Route | `/games/color-circle` |
| Категория | `gaze-basics` — Основы взгляда |
| Status | `therapy-ready` |
| Resolved stability | `publish` |
| Readiness group | `ready` |
| Skills | выбор, фиксация |
| Recommended session | 90 сек |
| Min target size | 180 px |
| Default dwell | 1300 ms |

## Назначение

undefined

Самостоятельная формулировка для меню: undefined

## Игровой цикл

```text
спокойная сцена -> ребёнок удерживает или ведёт взгляд -> мягкий визуальный отклик -> следующий спокойный шаг
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 180 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 4, min visible targets = 4.
- Минимальная short-side эвристика targets: 0.177.

## Дефектологическая ценность

- тренирует спокойную фиксацию и доверие к gaze feedback
- подходит для коротких первых занятий
- не требует быстрого ответа

## Метрики и сессия

- Сессия должна использовать общий game session flow и завершаться через результат для взрослого.
- Важные метрики: успешные выборы, ошибки/отмены, dwell time, подсказки, потеря валидного взгляда.
- Рекомендуемая длительность занятия: 90 сек.

## Реализация

| Проверка | Состояние |
|---|---|
| Route в router | есть |
| Vue-компонент | `ColorCircleGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | `audio.ts` |
| Runtime audit doc | `docs/tests/2026-06-10/color-circle.md` |

## Готовность

Игра находится в группе `ready`, потому что resolved stability равен `publish`.

Автоматические blockers:

- missing-game-doc

## QA checklist

- Route открывается в Electron, не только в обычном браузере.
- На 800×600 и 1024×600 основные цели видны без ручного скролла.
- HUD, prompt и overlays не перекрывают активные цели.
- Для canvas/fullscreen игры PNG подтверждает непустую сцену и читаемые active zones.
- Звук, если есть, остаётся опциональным и не ломает gameplay при ошибке загрузки.
- Для игр с правилами model tests покрывают правильный ответ, ошибки и завершение раунда.

## Next step

Поддерживать CDP/PNG pass при изменениях; при развитии игры расширять этот документ ручными продуктово-дефектологическими деталями.
