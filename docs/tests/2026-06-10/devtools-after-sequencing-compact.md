# Electron CDP after sequencing compact layout — 2026-06-10

Проверка выполнена в реальном Electron target `LINKa plays` через CDP после compact layout pass для representative sequencing games.

## Игры

- `train-sequence`
- `schedule`
- `soup-recipe`
- `build-bridge`

## Изменения

- На short viewport `max-height:680px` choice grids поднимаются выше крупных preview/stage блоков.
- Заголовки сохраняются, второстепательные описания и крупные recipe/preview детали компактятся или уходят ниже первого viewport.
- Правила игр, scoring и session logic не менялись.

## Результаты CDP на 800x600

| Игра | overflowX | Scroll height | Visible targets | Mostly visible targets | Min visible target |
|---|---:|---:|---:|---:|---:|
| `train-sequence` | false | `678px` | `5/5` | `5` | `140px` |
| `schedule` | false | `1172px` | `6/8` | `4` | `176px` |
| `soup-recipe` | false | `950px` | `8/8` | `8` | `160px` |
| `build-bridge` | false | `788px` | `8/8` | `8` | `150px` |

## Результаты CDP на 1024x600

| Игра | overflowX | Visible targets | Min visible target | First target top |
|---|---:|---:|---:|---:|
| `train-sequence` | false | `5/5` | `150px` | `298px` |
| `schedule` | false | `8/8` | `176px` | `182px` |
| `soup-recipe` | false | `8/8` | `160px` | `182px` |
| `build-bridge` | false | `8/8` | `150px` | `182px` |

## Verification

- `npm run typecheck` прошел.
- Electron CDP smoke прошел для 4 игр на `800x600` и `1024x600`.

## Остаточный риск

- `schedule` остается высокой страницей, потому нижние карточки и strip уходят ниже первого viewport, но первые 4 активные choices теперь доступны gaze-first.
- Этот pass подтверждает pattern для batch 2/3, но еще не является общей абстракцией.
