# Где предмет?

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `where-object` |
| Route | `/games/where-object` |
| Категория | `language-aac` — Слова и AAC |
| Status | `therapy-ready` |
| Resolved stability | `development` |
| Readiness group | `needs-check` |
| Skills | AAC, выбор, словарь, поиск |
| Recommended session | 120 сек |
| Min target size | 190 px |
| Default dwell | 1300 ms |

## Назначение

Тренировка понимания предлогов `на`, `под`, `в` на одной спокойной canvas-сцене. Ошибка не озвучивает и не подсвечивает правильный предлог.

Самостоятельная формулировка для меню: выбери слово, где лежит предмет.

## Игровой цикл

```text
показ предмета на/под/в полуоткрытом объекте -> выбор предлога -> подсказка или следующий раунд
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 190 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 3, min visible targets = 3.
- Минимальная short-side эвристика targets: 0.211.

## Дефектологическая ценность

- поддерживает коммуникационный выбор без речи
- развивает словарь и понимание ситуации
- даёт взрослому материал для обсуждения ответа

## Метрики и сессия

- Сессия должна использовать общий game session flow и завершаться через результат для взрослого.
- Важные метрики: успешные выборы, ошибки/отмены, dwell time, подсказки, потеря валидного взгляда.
- Рекомендуемая длительность занятия: 120 сек.

## Реализация

| Проверка | Состояние |
|---|---|
| Route в router | есть |
| Vue-компонент | `WhereObjectGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Scene | `scene.ts` canvas renderer |
| Audio module | стандартный feedback, TTS через `useGamePromptAudio` |
| Runtime audit doc | `docs/tests/2026-06-10/where-object.md` |

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

Проверить в Electron CDP на 800×600/1024×600 и визуально подтвердить canvas PNG перед approve.
