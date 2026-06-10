# Electron CDP after overlap fix — 2026-06-10

Проверка выполнена в реальном Electron target `LINKa plays` через CDP после правок `hide-and-seek`, `musical-path` и `rails`.

## Изменения

- `hide-and-seek`: цели теперь clamp'ятся ниже compact safe-area; prompt на низкой высоте становится компактной карточкой без второстепенного текста.
- `musical-path`: на short viewport верхние stones/sparks clamp'ятся ниже HUD-safe top.
- `rails`: стартовый выбор поезда переходит в три колонки уже с `sm`, чтобы не складываться вертикально под fixed HUD на `800x600`.

## Результаты CDP

| Игра | Viewport | overflowX | Targets visible | Min visible target | HUD overlaps | Prompt overlaps |
|---|---|---:|---:|---:|---:|---:|
| `hide-and-seek` | `800x600` | false | `5/5` | `150px` | 0 | 0 |
| `musical-path` | `800x600` | false | `8/8` | `142px` | 0 | 0 |
| `rails` | `800x600` | false | `3/3` | `170px` | 0 | 0 |
| `hide-and-seek` | `1024x600` | false | `5/5` | `150px` | 0 | 0 |
| `musical-path` | `1024x600` | false | `8/8` | `142px` | 0 | 0 |
| `rails` | `1024x600` | false | `3/3` | `170px` | 0 | 0 |

## Verification

- `npm run typecheck` прошел.
- Electron CDP smoke прошел для `hide-and-seek`, `musical-path`, `rails` на `800x600` и `1024x600`.
