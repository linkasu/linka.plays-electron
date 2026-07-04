# Electron CDP after overflow fix — 2026-06-10

Проверка выполнена в реальном Electron target `LINKa plays` через CDP после правки `gaze-maze` и `pac-path`.

## Изменение

- Убран short-viewport min-content overflow от связки `aspect-ratio: 16 / 9` + крупный `min-block-size`.
- На `721px..900px` и при `max-height:700px` stage сохраняет ширину контейнера без горизонтальной прокрутки.
- Игровая механика и waypoint coordinates не менялись.

## Результаты CDP

| Игра | Viewport | overflowX | scroll/client width | Stage | Targets visible | Min visible target |
|---|---|---:|---:|---|---:|---:|
| `gaze-maze` | `800x600` | false | `800/800` | `736x414`, left `32`, right `768` | `5/7` | `105px` |
| `gaze-maze` | `1024x600` | false | `1024/1024` | `944x531`, left `40`, right `984` | `3/7` | `120px` |

## Verification

- `npm run typecheck` прошел.
- Electron CDP smoke прошел для `gaze-maze` и `pac-path` на `800x600` и `1024x600`.

## Остаточный риск

- Обе игры остаются высокими по вертикали на `600px` высоты. Это уже не horizontal overflow, но может потребовать отдельного controls/feedback compaction pass.
