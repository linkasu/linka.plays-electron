# Морской бой light

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `battleship-light` |
| Route | `/games/battleship-light` |
| Категория | `strategy` — Головоломки |
| Status | `therapy-ready` |
| Resolved stability | `needs-check` |
| Readiness group | `development` |
| Skills | выбор, поиск |
| Recommended session | 180 сек |
| Min target size | 130 px |
| Default dwell | 1300 ms |

## Назначение

undefined

Самостоятельная формулировка для меню: undefined

## Игровой цикл

```text
показ позиции -> выбор хода или управляющего действия -> обновление состояния партии -> следующий ход или итог
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 130 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 25, min visible targets = 15.
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
| Vue-компонент | `BattleshipLightGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | стандартный feedback, TTS через `useGamePromptAudio` |
| Runtime audit doc | `docs/tests/2026-06-10/battleship-light.md` |

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

Принять product decision: оставить как strategy с честным outcome или явно позиционировать как trainer; затем обновить модель, тесты и статус.
