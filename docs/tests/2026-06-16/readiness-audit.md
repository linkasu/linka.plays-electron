| `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 12 | 9 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 || `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 11 | 10 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 || `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 10 | 11 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 || `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 9 | 12 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 || `continuous-control` | 1 | 19 || `strategy` | 2 | 18 || `language-aac` | 4 | 17 || `sequencing` | 8 | 13 || `numeracy` | 6 | 14 || `visual-search` | 16 | 0 || `gaze-basics` | 36 | 0 |# Readiness audit — 2026-06-16

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
| Игр в текущем реестре | 154 |
| Ready | 77 |
| Development | 77 |
| `status: "polished"` | 44 |
| `status: "therapy-ready"` | 110 |
| `resolvedStabilityStatus: "publish"` | 77 |
| `resolvedStabilityStatus: "needs-check"` | 77 |
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
| `numeracy` | 6 | 14 |
| `sequencing` | 7 | 14 |
| `language-aac` | 4 | 17 |
| `strategy` | 2 | 18 |
| `continuous-control` | 1 | 19 |

## Первые development blockers

| Игра | Категория | Stability | Blockers |
|---|---|---|---|
| `shape-dance` | `sequencing` | `needs-check` | `stability:needs-check` |
| `hero-route` | `sequencing` | `needs-check` | `stability:needs-check`, `rules-not-extracted-to-model` |
| `soup-recipe` | `sequencing` | `needs-check` | `stability:needs-check` |
| `fix-picture` | `sequencing` | `needs-check` | `stability:needs-check`, `rules-not-extracted-to-model` |
| `comic-strip` | `sequencing` | `needs-check` | `stability:needs-check` |
| `schedule` | `sequencing` | `needs-check` | `stability:needs-check` |
| `build-bridge` | `sequencing` | `needs-check` | `stability:needs-check`, `rules-not-extracted-to-model` |
| `shelf-sorting` | `sequencing` | `needs-check` | `stability:needs-check` |
| `orchestra` | `sequencing` | `needs-check` | `stability:needs-check`, `rules-not-extracted-to-model` |
| `choose-emotion` | `language-aac` | `needs-check` | `stability:needs-check` |

Полный список development-игр и blockers находится в `developmentQueue` внутри `readiness-audit.json`.

## Docs coverage

Очередь недостающих `docs/games/<id>.md` закрыта. Все 154 registry-игры имеют игровой markdown-документ.

## Model/test долг

Очередь `model.ts` без соседнего `model.test.ts` закрыта. Добавлены тесты для ready-игр:

- `eat-or-not-eat`
- `type-word`
- `math-actions`

## Выводы

- Registry/router/component coverage хорошее: все 154 игры имеют route и Vue-компонент.
- Ready сейчас определяется не только `status: "polished"`: в ready также попадают `therapy-ready` игры с явным `stabilityStatus: "publish"`.
- Основной development-массив находится в `sequencing`, `language-aac`, `numeracy`, `strategy` и `continuous-control`.
- Документация `docs/games/<id>.md` синхронизирована с фактическим реестром: отсутствующих документов 0.
- Тестовый долг `model.ts` без `model.test.ts` закрыт: `modelWithoutTest = 0`.
- Этот отчёт не является визуальным PNG-аудитом. Визуальная проверка должна запускаться отдельно через реальный Electron CDP target и `audit:electron-cdp:all`.

## Следующий шаг

Запустить visual audit protocol для текущего реестра: собрать PNG на `800x600` и `1024x600`, вручную проверить development/warn/blocker и затем начинать shared layout fixes с групп `sequencing`, `language-aac`, `numeracy`, `strategy`, `continuous-control`.
