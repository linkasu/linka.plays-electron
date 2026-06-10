# Electron CDP after target size fix — 2026-06-10

Проверка выполнена в реальном Electron target `LINKa plays` через CDP после правок `tic-tac-toe` и `connect-four`.

## Изменения

- `tic-tac-toe`: menu/pause quiet controls увеличены с `72px` до `96px` по высоте.
- `connect-four`: menu/pause quiet controls увеличены с `72px` до `96px`; short-height board расширен до доступной ширины, gap/padding уменьшены для более широких column hit zones.

## Результаты CDP

| Игра | Viewport | overflowX | Targets visible | Min visible target |
|---|---|---:|---:|---:|
| `tic-tac-toe` | `800x600` | false | `9/12` | `96px` |
| `connect-four` | `800x600` | false | `10/10` | `92px` |
| `tic-tac-toe` | `1024x600` | false | `9/12` | `96px` |
| `connect-four` | `1024x600` | false | `10/10` | `92px` |

## Verification

- `npm run typecheck` прошел.
- Electron CDP smoke прошел для `tic-tac-toe` и `connect-four` на `800x600` и `1024x600`.

## Остаточный риск

- `connect-four` физически не может дать 7 колонок по `120px` внутри `800px` без redesign выбора колонок. Текущий фикс снимает подтвержденный runtime-флаг `<88px`; если нужен строгий gaze spec `>=120px`, нужен отдельный interaction redesign.
