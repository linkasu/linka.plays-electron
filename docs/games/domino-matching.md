# Домино: найди сторону

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `domino-matching` |
| Route | `/games/domino-matching` |
| Категория | `strategy` — Головоломки |
| Status | `therapy-ready` |
| Resolved stability | `needs-check` |
| Readiness group | `development` |
| Skills | счёт, выбор, классификация |
| Recommended session | 180 сек |
| Min target size | 148 px |
| Default dwell | 1300 ms |

## Назначение

Подбор домино по количеству точек на заданной стороне: ребёнок сравнивает видимую сторону образца с одной стороной вариантов.

Самостоятельная формулировка для меню: Сравни точки на домино и выбери карточку с таким же количеством.

## Игровой цикл

```text
показ образца и вариантов -> выбор домино -> подходящий выбор открывает следующий раунд, повтор правила без подсветки ответа -> итог
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 148 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 4, min visible targets = 4.
- Минимальная short-side эвристика targets: 0.24.

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
| Vue-компонент | `DominoMatchingGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | стандартный feedback, TTS через `useGamePromptAudio` |
| Runtime audit doc | `docs/tests/2026-06-10/domino-matching.md` |

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
