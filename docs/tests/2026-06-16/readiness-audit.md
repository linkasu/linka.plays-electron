| `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 5 | 16 || `sequencing` | 19 | 0 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 || `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 19 | 0 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 || `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 18 | 1 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 || `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 17 | 2 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 || `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 16 | 3 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 || `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 15 | 4 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 |# Readiness audit — 2026-06-16

Аудит построен командой:

```bash
npm run audit:readiness -- --output=docs/tests/2026-06-16/readiness-audit.json
```

Машиночитаемый отчёт: `readiness-audit.json`.

## Правило группировки

| Группа | Правило |
|---|---|
| `ready` | `resolvedStabilityStatus === "publish"` |
| `development` | всё кроме `publish`: `needs-check`, `prefixed`, `archived`, скрытые или спорные игры |

`resolvedStabilityStatus` считается так же, как в `src/frontend/data/games.ts`: явный `stabilityStatus`, затем `hidden-from-menu` как `archived`, затем `polished` как `publish`, иначе `needs-check`.

## Сводка

| Метрика | Значение |
|---|---:|
| Игр в текущем реестре | 152 |
| Ready | 85 |
| Development | 67 |
| `status: "polished"` | 44 |
| `status: "therapy-ready"` | 108 |
| `resolvedStabilityStatus: "publish"` | 85 |
| `resolvedStabilityStatus: "needs-check"` | 67 |
| `resolvedStabilityStatus: "archived"` | 0 |
| Отсутствующие routes | 0 |
| Отсутствующие Vue-компоненты | 0 |
| Отсутствующие `docs/games/<id>.md` | 0 |
| Отсутствующие runtime audit docs | 0 |
| `model.ts` без `model.test.ts` | 0 |

## Ready и development по категориям

| Категория | Ready | Development |
|---|---:|---:|
| `gaze-basics` | 36 | 0 |
| `visual-search` | 16 | 0 |
| `sequencing` | 14 | 5 |
| `numeracy` | 6 | 14 |
| `language-aac` | 4 | 17 |
| `strategy` | 2 | 18 |
| `continuous-control` | 1 | 19 |

## Первые development blockers

| Игра | Категория | Stability | Blockers |
|---|---|---|---|
| `word-categories` | `language-aac` | `needs-check` | `stability:needs-check` |
| `i-want` | `language-aac` | `needs-check` | `stability:needs-check`, `rules-not-extracted-to-model` |
| `want-dont-want` | `language-aac` | `needs-check` | `stability:needs-check` |
| `object-action` | `language-aac` | `needs-check` | `stability:needs-check` |
| `where-object` | `language-aac` | `needs-check` | `stability:needs-check` |
| `big-small` | `language-aac` | `needs-check` | `stability:needs-check` |
| `one-many` | `language-aac` | `needs-check` | `stability:needs-check` |
| `who-is-this` | `language-aac` | `needs-check` | `stability:needs-check` |

Полный список development-игр и blockers находится в `developmentQueue` внутри `readiness-audit.json`.

## Docs coverage

Очередь недостающих `docs/games/<id>.md` закрыта. Все 152 registry-игры имеют игровой markdown-документ.

## Model/test долг

Очередь `model.ts` без соседнего `model.test.ts` закрыта. Добавлены тесты для ready-игр:

- `eat-or-not-eat`
- `type-word`
- `math-actions`

## Выводы

- Registry/router/component coverage хорошее: все 152 игры имеют route и Vue-компонент.
- Ready сейчас определяется не только `status: "polished"`: в ready также попадают `therapy-ready` игры с явным `stabilityStatus: "publish"`.
- Основной development-массив находится в `language-aac`, `numeracy`, `strategy` и `continuous-control`.
- Документация `docs/games/<id>.md` синхронизирована с фактическим реестром: отсутствующих документов 0.
- Тестовый долг `model.ts` без `model.test.ts` закрыт: `modelWithoutTest = 0`.
- Этот отчёт не является визуальным PNG-аудитом. Визуальная проверка должна запускаться отдельно через реальный Electron CDP target и `audit:electron-cdp:all`.

## Следующий шаг

Запустить visual audit protocol для текущего реестра: собрать PNG на `800x600` и `1024x600`, вручную проверить development/warn/blocker и затем начинать shared layout fixes с групп `language-aac`, `numeracy`, `strategy`, `continuous-control`.
