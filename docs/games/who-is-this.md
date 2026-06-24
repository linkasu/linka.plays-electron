# Кто это?

> Registry-backed spec. Документ создан из текущего Electron registry и audit-данных; при продуктовой доработке его нужно расширять вручную.

## Registry

| Поле | Значение |
|---|---|
| ID | `who-is-this` |
| Route | `/games/who-is-this` |
| Категория | `language-aac` — Слова и AAC |
| Status | `therapy-ready` |
| Resolved stability | `publish` |
| Readiness group | `ready` |
| Skills | AAC, выбор, словарь |
| Recommended session | 120 сек |
| Min target size | 190 px |
| Default dwell | 1300 ms |

## Назначение

undefined

Самостоятельная формулировка для меню: undefined

## Игровой цикл

```text
показ ситуации или вопроса -> выбор карточки/слова -> подтверждение смысла -> следующий AAC-раунд
```

## Управление взглядом

- Основной ввод должен быть gaze-first; mouse fallback сохраняется для отладки и занятий без трекера.
- Минимальный целевой размер из registry: 190 px.
- Базовый dwell из registry: 1300 ms.
- Последний Electron CDP audit: failures = 0, max targets = 4, min visible targets = 4.
- Минимальная short-side эвристика targets: 0.228.

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
| Vue-компонент | `WhoIsThisGame.vue` |
| Model | `model.ts` |
| Model test | `model.test.ts` |
| Audio module | нет |
| Runtime audit doc | `docs/tests/2026-06-10/who-is-this.md` |

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
