# Найди букву

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `find-letter` |
| Route | `/games/find-letter` |
| Категория | `visual-search` — Поиск и внимание |
| Status | `therapy-ready` |
| Resolved stability | `publish` |
| Readiness group | `ready` |
| Skills | поиск, выбор, словарь |
| Recommended session | 120 сек |
| Min target size | 200 px |
| Default dwell | 1300 ms |

## Назначение

undefined

Самостоятельная формулировка для меню: undefined

## Игровой цикл

```text
показ задания -> поиск цели среди крупных объектов -> dwell-выбор -> мягкий feedback -> следующий раунд
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 200 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 4, min visible targets = 4.
- Минимальная short-side эвристика targets: 0.167.

## Дефектологическая ценность

- тренирует зрительный поиск и переключение внимания
- закрепляет удержание цели без спешки
- помогает взрослому видеть сложные категории поиска

## Метрики и сессия

- Сессия должна использовать общий game session flow и завершаться через результат для взрослого.
- Важные метрики: успешные выборы, ошибки/отмены, dwell time, подсказки, потеря валидного взгляда.
- Рекомендуемая длительность занятия: 120 сек.

## Реализация

| Проверка | Состояние |
|---|---|
| Route в router | есть |
| Vue-компонент | `FindLetterGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | `audio.ts` |
| Runtime audit doc | `docs/tests/2026-06-10/find-letter.md` |

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
- TTS проговаривает букву-задание, мягкий успех и спокойную ошибку с повтором нужной буквы.
- Для игр с правилами model tests покрывают правильный ответ, ошибки и завершение раунда.

## Next step

Оставить в ready-очереди и проверять регрессии через общий Electron CDP audit.
