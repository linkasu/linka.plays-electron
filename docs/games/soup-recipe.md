# Рецепт супа

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `soup-recipe` |
| Route | `/games/soup-recipe` |
| Категория | `sequencing` — Последовательности |
| Status | `therapy-ready` |
| Resolved stability | `publish` |
| Readiness group | `ready` |
| Skills | последовательность, выбор, словарь |
| Recommended session | 135 сек |
| Min target size | 180 px |
| Default dwell | 1300 ms |

## Назначение

undefined

Самостоятельная формулировка для меню: undefined

## Игровой цикл

```text
показ текущего шага -> выбор следующего элемента -> обновление собранной сцены -> следующий шаг или результат
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 180 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 8, min visible targets = 6.
- Минимальная short-side эвристика targets: 0.187.

## Дефектологическая ценность

- тренирует понимание порядка и причинности
- поддерживает пошаговую инструкцию
- снижает нагрузку через крупный выбор

## Метрики и сессия

- Сессия должна использовать общий game session flow и завершаться через результат для взрослого.
- Важные метрики: успешные выборы, ошибки/отмены, dwell time, подсказки, потеря валидного взгляда.
- Рекомендуемая длительность занятия: 135 сек.

## Реализация

| Проверка | Состояние |
|---|---|
| Route в router | есть |
| Vue-компонент | `SoupRecipeGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | стандартный feedback из `core/gameFeedbackAudio.ts` |
| Runtime audit doc | `docs/tests/2026-06-10/soup-recipe.md` |

## Готовность

Игра находится в группе `ready`, потому что resolved stability равен `publish`.

Автоматические blockers:

- нет

## QA checklist

- Route открывается в Electron, не только в обычном браузере.
- На 800×600 и 1024×600 основные цели видны без ручного скролла.
- HUD, prompt и overlays не перекрывают активные цели.
- Для canvas/fullscreen игры PNG подтверждает непустую сцену и читаемые active zones.
- Звук, если есть, остаётся опциональным и не ломает gameplay при ошибке загрузки.
- Для игр с правилами model tests покрывают правильный ответ, ошибки и завершение раунда.

## Next step

Оставить в ready-очереди и проверять регрессии через общий Electron CDP audit.
