# Electron CDP after language/numeracy compact layout — 2026-06-10

Проверка выполнена в реальном Electron target `LINKa plays` через CDP после compact layout pass для representative language/numeracy games.

## Игры

- `tell-picture`
- `who-is-this`
- `simple-graphs`
- `number-bonds`
- `sudoku-2x2`

## Изменения

- На short viewport `max-height:680px` active choices поднимаются выше крупных scene/graph/board panels.
- Второстепательные подсказки, overline и декоративные детали скрываются или уходят ниже первого viewport.
- Правила игр, ответы, scoring и session logic не менялись.

## Результаты CDP на 800x600

| Игра | overflowX | Scroll height | Visible targets | Mostly visible targets | Min visible target | First target top |
|---|---:|---:|---:|---:|---:|---:|
| `tell-picture` | false | `688px` | `3/3` | `3` | `220px` | `120px` |
| `who-is-this` | false | `820px` | `4/4` | `4` | `205px` | `178px` |
| `simple-graphs` | false | `600px` | `3/3` | `3` | `136px` | `182px` |
| `number-bonds` | false | `682px` | `4/4` | `4` | `190px` | `176px` |
| `sudoku-2x2` | false | `753px` | `2/2` | `2` | `190px` | `233px` |

## Результаты CDP на 1024x600

| Игра | overflowX | Scroll height | Visible targets | Mostly visible targets | Min visible target | First target top |
|---|---:|---:|---:|---:|---:|---:|
| `tell-picture` | false | `645px` | `3/3` | `3` | `220px` | `120px` |
| `who-is-this` | false | `650px` | `4/4` | `4` | `205px` | `188px` |
| `simple-graphs` | false | `600px` | `3/3` | `3` | `136px` | `192px` |
| `number-bonds` | false | `600px` | `4/4` | `4` | `190px` | `186px` |
| `sudoku-2x2` | false | `772px` | `2/2` | `2` | `190px` | `252px` |

## Verification

- `npm run typecheck` прошел.
- Electron CDP smoke прошел для 5 игр на `800x600` и `1024x600`.

## Остаточный риск

- `who-is-this` и `sudoku-2x2` остаются вертикально прокручиваемыми, но active choices теперь доступны gaze-first в первом viewport.
- Этот pass не вводит общий shared layout: изменения локальны и повторяют pattern, подтвержденный sequencing batch.
