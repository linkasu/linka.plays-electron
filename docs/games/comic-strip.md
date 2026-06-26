# Комикс

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `comic-strip` |
| Route | `/games/comic-strip` |
| Категория | `sequencing` — Последовательности |
| Status | `therapy-ready` |
| Resolved stability | `development` |
| Readiness group | `needs-check` |
| Skills | последовательность, выбор, словарь |
| Recommended session | 140 сек |
| Min target size | 180 px |
| Default dwell | 1300 ms |

## Назначение

Собрать короткий комикс по кадрам. Ошибка не подсвечивает правильный кадр и оставляет ребёнку спокойную повторную попытку.

Самостоятельная формулировка для меню: собери комикс по кадрам.

## Игровой цикл

```text
показ текущего шага -> выбор следующего элемента -> обновление собранной сцены -> следующий шаг или результат
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 180 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 3, min visible targets = 3.
- Минимальная short-side эвристика targets: 0.181.

## Дефектологическая ценность

- тренирует понимание порядка и причинности
- поддерживает пошаговую инструкцию
- снижает нагрузку через крупный выбор

## Метрики и сессия

- Сессия должна использовать общий game session flow и завершаться через результат для взрослого.
- Важные метрики: успешные выборы, ошибки/отмены, dwell time, подсказки, потеря валидного взгляда.
- Рекомендуемая длительность занятия: 140 сек.

## Реализация

| Проверка | Состояние |
|---|---|
| Route в router | есть |
| Vue-компонент | `ComicStripGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | стандартный feedback из `core/gameFeedbackAudio.ts`, soft piano, TTS через `useGamePromptAudio` |
| Runtime audit doc | `docs/tests/2026-06-10/comic-strip.md` |

## Готовность

Игра находится в группе `needs-check`, пока проходит batch review.

Автоматические blockers:

- `stability:needs-check`

## QA checklist

- Route открывается в Electron, не только в обычном браузере.
- На 800×600 и 1024×600 основные цели видны без ручного скролла.
- HUD, prompt и overlays не перекрывают активные цели.
- Для canvas/fullscreen игры PNG подтверждает непустую сцену и читаемые active zones.
- Звук, если есть, остаётся опциональным и не ломает gameplay при ошибке загрузки.
- Для игр с правилами model tests покрывают правильный ответ, ошибки и завершение раунда.

## Next step

Проверить в Electron CDP на 800×600/1024×600 и визуально подтвердить PNG перед approve.
