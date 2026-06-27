# Lines 5

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `lines-five` |
| Route | `/games/lines-five` |
| Категория | `strategy` — Головоломки |
| Status | `therapy-ready` |
| Resolved stability | `needs-check` |
| Readiness group | `development` |
| Skills | выбор, последовательность, поиск |
| Recommended session | 180 сек |
| Min target size | 104 px |
| Default dwell | 1300 ms |

## Назначение

Мини-версия Lines на поле 5×5: ребёнок выбирает пустые клетки, ставит цветные шарики и собирает линии одинакового цвета.

Самостоятельная формулировка для меню: Ставь шарики на пустые клетки и собирай цветные линии.

## Игровой цикл

```text
показ поля и цвета следующего шарика -> выбор пустой клетки -> шарик ставится, линия исчезает или поле приближается к завершению -> итог
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 104 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 25, min visible targets = 25.
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
| Vue-компонент | `LinesFiveGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | стандартный feedback, TTS через `useGamePromptAudio` |
| Runtime audit doc | `docs/tests/2026-06-10/lines-five.md` |

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
