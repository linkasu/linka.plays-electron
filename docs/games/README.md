# Games

Эта папка содержит игровые спецификации для текущего Electron registry. Полный источник правды по каталогу: `src/frontend/data/games.ts`.

## Readiness rule

| Группа | Правило |
|---|---|
| `ready` | `resolvedStabilityStatus === "publish"` |
| `development` | всё кроме `publish`: `needs-check`, `prefixed`, `archived`, скрытые или спорные игры |

Сводка по последнему readiness-аудиту: 147 игр, 3 игры, 144 игры. Все registry-игры имеют `docs/games/<id>.md`.

## Форматы документов

- Ручные legacy/spec документы сохраняют исторические разделы вроде `Unity source`, `Core mechanic`, `Polished` и `QA checklist`.
- Новые недостающие документы созданы как `Registry-backed spec`: они фиксируют факты из registry, readiness-аудита и Electron CDP, а продуктовые детали должны расширяться вручную при доработке игры.

## Registry games

### Основы взгляда

| Игра | ID | Документ | Status | Stability | Group |
|---|---|---|---|---|---|
| Аквариум | `aquarium` | [aquarium.md](aquarium.md) | `polished` | `publish` | `ready` |
| Шарики | `balloons` | [balloons.md](balloons.md) | `polished` | `publish` | `ready` |
| Колокольчики | `bells` | [bells.md](bells.md) | `polished` | `publish` | `ready` |
| Дышащий цветок | `breathing-flower` | [breathing-flower.md](breathing-flower.md) | `polished` | `publish` | `ready` |
| Разбуди сову | `wake-owl` | [wake-owl.md](wake-owl.md) | `polished` | `publish` | `ready` |
| Облака | `clouds` | [clouds.md](clouds.md) | `polished` | `publish` | `ready` |
| Листья на ветру | `leaves-wind` | [leaves-wind.md](leaves-wind.md) | `therapy-ready` | `publish` | `ready` |
| Воздушный змей | `kite` | [kite.md](kite.md) | `polished` | `publish` | `ready` |
| Светлячковая поляна | `firefly-meadow` | [firefly-meadow.md](firefly-meadow.md) | `polished` | `publish` | `ready` |
| Поймай свет | `catch-light` | [catch-light.md](catch-light.md) | `polished` | `publish` | `ready` |
| Звёздное небо | `starry-sky` | [starry-sky.md](starry-sky.md) | `polished` | `publish` | `ready` |
| Волшебная пыль | `magic-dust` | [magic-dust.md](magic-dust.md) | `polished` | `publish` | `ready` |
| Галерея света | `light-gallery` | [light-gallery.md](light-gallery.md) | `polished` | `publish` | `ready` |
| Мыльные круги | `soap-circles` | [soap-circles.md](soap-circles.md) | `polished` | `publish` | `ready` |
| Северное сияние | `northern-lights` | [northern-lights.md](northern-lights.md) | `polished` | `publish` | `ready` |
| Солнце и лучи | `sun-rays` | [sun-rays.md](sun-rays.md) | `polished` | `publish` | `ready` |
| Снежинки | `snowflakes` | [snowflakes.md](snowflakes.md) | `polished` | `publish` | `ready` |
| Лунная дорожка | `moon-path` | [moon-path.md](moon-path.md) | `polished` | `publish` | `ready` |
| Маяк | `lighthouse` | [lighthouse.md](lighthouse.md) | `polished` | `publish` | `ready` |
| Песочный сад | `sand-garden` | [sand-garden.md](sand-garden.md) | `polished` | `publish` | `ready` |
| Морские ракушки | `sea-shells` | [sea-shells.md](sea-shells.md) | `polished` | `publish` | `ready` |
| Бумажные фонарики | `paper-lanterns` | [paper-lanterns.md](paper-lanterns.md) | `polished` | `publish` | `ready` |
| Открой дверцу | `open-door` | [open-door.md](open-door.md) | `polished` | `publish` | `ready` |
| Тёплое окно | `warm-window` | [warm-window.md](warm-window.md) | `polished` | `publish` | `ready` |
| Тёплый костёр | `warm-fire` | [warm-fire.md](warm-fire.md) | `polished` | `publish` | `ready` |
| Большие карточки | `big-cards` | [big-cards.md](big-cards.md) | `therapy-ready` | `publish` | `ready` |
| Цветной круг | `color-circle` | [color-circle.md](color-circle.md) | `therapy-ready` | `publish` | `ready` |
| Покорми зверька | `feed-animal` | [feed-animal.md](feed-animal.md) | `therapy-ready` | `publish` | `ready` |
| Бабочки | `butterfly` | [butterfly.md](butterfly.md) | `polished` | `publish` | `ready` |
| Цветы | `flowers` | [flowers.md](flowers.md) | `therapy-ready` | `publish` | `ready` |
| Тихие пузыри | `quiet-bubbles` | [quiet-bubbles.md](quiet-bubbles.md) | `therapy-ready` | `publish` | `ready` |
| Утки | `ducks` | [ducks.md](ducks.md) | `therapy-ready` | `publish` | `ready` |
| Рыбки | `fishes` | [fishes.md](fishes.md) | `therapy-ready` | `publish` | `ready` |
| Медузы | `jellyfish` | [jellyfish.md](jellyfish.md) | `therapy-ready` | `publish` | `ready` |
| Жаба | `frog` | [frog.md](frog.md) | `polished` | `publish` | `ready` |

### Поиск и внимание

| Игра | ID | Документ | Status | Stability | Group |
|---|---|---|---|---|---|
| Прятки | `hide-and-seek` | [hide-and-seek.md](hide-and-seek.md) | `polished` | `needs-check` | `development` |
| Кто спрятался? | `who-hiding` | [who-hiding.md](who-hiding.md) | `therapy-ready` | `needs-check` | `development` |
| Найди цвет | `find-color` | [find-color.md](find-color.md) | `polished` | `needs-check` | `development` |
| Найди форму | `find-shape` | [find-shape.md](find-shape.md) | `therapy-ready` | `needs-check` | `development` |
| Где такой же? | `match-same` | [match-same.md](match-same.md) | `polished` | `needs-check` | `development` |
| Что пропало? | `what-missing` | [what-missing.md](what-missing.md) | `therapy-ready` | `needs-check` | `development` |
| Следуй за подсказкой | `follow-cue` | [follow-cue.md](follow-cue.md) | `therapy-ready` | `needs-check` | `development` |
| Найди букву | `find-letter` | [find-letter.md](find-letter.md) | `therapy-ready` | `needs-check` | `development` |
| Тень и предмет | `shadow-match` | [shadow-match.md](shadow-match.md) | `therapy-ready` | `needs-check` | `development` |
| Где звук? | `sound-source` | [sound-source.md](sound-source.md) | `therapy-ready` | `needs-check` | `development` |
| Что лишнее? | `odd-one-out` | [odd-one-out.md](odd-one-out.md) | `therapy-ready` | `needs-check` | `development` |
| Найди эмоцию | `find-emotion` | [find-emotion.md](find-emotion.md) | `therapy-ready` | `needs-check` | `development` |
| Охота на буквы | `letter-hunt` | [letter-hunt.md](letter-hunt.md) | `therapy-ready` | `needs-check` | `development` |
| Найди животное | `find-animal` | [find-animal.md](find-animal.md) | `therapy-ready` | `needs-check` | `development` |
| Пары | `memory-cards` | [memory-cards.md](memory-cards.md) | `therapy-ready` | `needs-check` | `development` |
| Лабиринт взгляда-указателя | `gaze-maze` | [gaze-maze.md](gaze-maze.md) | `therapy-ready` | `needs-check` | `development` |

### Последовательности

| Игра | ID | Документ | Status | Stability | Group |
|---|---|---|---|---|---|
| Собери роботика | `build-robot` | [build-robot.md](build-robot.md) | `therapy-ready` | `needs-check` | `development` |
| Пирамидка | `pyramid` | [pyramid.md](pyramid.md) | `polished` | `needs-check` | `development` |
| Одень персонажа | `dress-character` | [dress-character.md](dress-character.md) | `therapy-ready` | `needs-check` | `development` |
| Поезд | `train-sequence` | [train-sequence.md](train-sequence.md) | `polished` | `needs-check` | `development` |
| Бутерброд | `sandwich` | [sandwich.md](sandwich.md) | `therapy-ready` | `needs-check` | `development` |
| Паттерны | `patterns` | [patterns.md](patterns.md) | `polished` | `needs-check` | `development` |
| Цветовой узор | `color-pattern` | [color-pattern.md](color-pattern.md) | `therapy-ready` | `needs-check` | `development` |
| Утро-день-вечер | `day-routine` | [day-routine.md](day-routine.md) | `therapy-ready` | `needs-check` | `development` |
| История из 3 кадров | `three-frame-story` | [three-frame-story.md](three-frame-story.md) | `therapy-ready` | `needs-check` | `development` |
| Сначала-потом | `first-then` | [first-then.md](first-then.md) | `therapy-ready` | `needs-check` | `development` |
| Музыкальная дорожка | `musical-path` | [musical-path.md](musical-path.md) | `therapy-ready` | `needs-check` | `development` |
| Мозаика | `mosaic` | [mosaic.md](mosaic.md) | `therapy-ready` | `needs-check` | `development` |
| Танец фигур | `shape-dance` | [shape-dance.md](shape-dance.md) | `therapy-ready` | `needs-check` | `development` |
| Рецепт супа | `soup-recipe` | [soup-recipe.md](soup-recipe.md) | `therapy-ready` | `needs-check` | `development` |
| Комикс | `comic-strip` | [comic-strip.md](comic-strip.md) | `therapy-ready` | `needs-check` | `development` |
| Расписание | `schedule` | [schedule.md](schedule.md) | `therapy-ready` | `needs-check` | `development` |
| Строим мост | `build-bridge` | [build-bridge.md](build-bridge.md) | `therapy-ready` | `needs-check` | `development` |
| Сортировка по полкам | `shelf-sorting` | [shelf-sorting.md](shelf-sorting.md) | `therapy-ready` | `needs-check` | `development` |
| Оркестр | `orchestra` | [orchestra.md](orchestra.md) | `therapy-ready` | `needs-check` | `development` |

### Слова и AAC

| Игра | ID | Документ | Status | Stability | Group |
|---|---|---|---|---|---|
| Выбери эмоцию | `choose-emotion` | [choose-emotion.md](choose-emotion.md) | `therapy-ready` | `needs-check` | `development` |
| Выбери картинку | `choose-picture` | [choose-picture.md](choose-picture.md) | `polished` | `needs-check` | `development` |
| Съедобное | `eat-or-not-eat` | [eat-or-not-eat.md](eat-or-not-eat.md) | `polished` | `needs-check` | `development` |
| Категории слов | `word-categories` | [word-categories.md](word-categories.md) | `therapy-ready` | `needs-check` | `development` |
| Да / нет | `yes-no` | [yes-no.md](yes-no.md) | `polished` | `needs-check` | `development` |
| Я хочу... | `i-want` | [i-want.md](i-want.md) | `therapy-ready` | `needs-check` | `development` |
| Хочу / не хочу | `want-dont-want` | [want-dont-want.md](want-dont-want.md) | `therapy-ready` | `needs-check` | `development` |
| Предмет + действие | `object-action` | [object-action.md](object-action.md) | `therapy-ready` | `needs-check` | `development` |
| Где предмет? | `where-object` | [where-object.md](where-object.md) | `therapy-ready` | `needs-check` | `development` |
| Большой / маленький | `big-small` | [big-small.md](big-small.md) | `therapy-ready` | `needs-check` | `development` |
| Один / много | `one-many` | [one-many.md](one-many.md) | `therapy-ready` | `needs-check` | `development` |
| Кто это? | `who-is-this` | [who-is-this.md](who-is-this.md) | `therapy-ready` | `needs-check` | `development` |
| Противоположности | `opposites` | [opposites.md](opposites.md) | `therapy-ready` | `needs-check` | `development` |
| Что сначала? | `what-first` | [what-first.md](what-first.md) | `therapy-ready` | `needs-check` | `development` |
| Мини-диалог | `mini-dialog` | [mini-dialog.md](mini-dialog.md) | `therapy-ready` | `needs-check` | `development` |
| Социальные фразы | `social-phrases` | [social-phrases.md](social-phrases.md) | `therapy-ready` | `needs-check` | `development` |
| Печать слов | `type-word` | [type-word.md](type-word.md) | `polished` | `needs-check` | `development` |

### Счёт и математика

| Игра | ID | Документ | Status | Stability | Group |
|---|---|---|---|---|---|
| Найди цифру | `find-digit` | [find-digit.md](find-digit.md) | `therapy-ready` | `needs-check` | `development` |
| Логические пары | `logic-pairs` | [logic-pairs.md](logic-pairs.md) | `therapy-ready` | `needs-check` | `development` |
| Часы | `clock` | [clock.md](clock.md) | `therapy-ready` | `needs-check` | `development` |
| Календарь | `calendar` | [calendar.md](calendar.md) | `therapy-ready` | `needs-check` | `development` |
| Счёт | `count-items` | [count-items.md](count-items.md) | `polished` | `needs-check` | `development` |
| Сложи монетки | `coin-counting` | [coin-counting.md](coin-counting.md) | `therapy-ready` | `needs-check` | `development` |
| Доли пиццы | `pizza-fractions` | [pizza-fractions.md](pizza-fractions.md) | `therapy-ready` | `needs-check` | `development` |
| Больше / меньше | `greater-less` | [greater-less.md](greater-less.md) | `polished` | `needs-check` | `development` |
| Весы | `scales` | [scales.md](scales.md) | `therapy-ready` | `needs-check` | `development` |
| Числовая дорожка | `number-line` | [number-line.md](number-line.md) | `therapy-ready` | `needs-check` | `development` |
| Сортировка чисел | `number-sorting` | [number-sorting.md](number-sorting.md) | `therapy-ready` | `needs-check` | `development` |
| Судоку 2x2 | `sudoku-2x2` | [sudoku-2x2.md](sudoku-2x2.md) | `therapy-ready` | `needs-check` | `development` |
| Линии и углы | `lines-angles` | [lines-angles.md](lines-angles.md) | `therapy-ready` | `needs-check` | `development` |
| Простые графики | `simple-graphs` | [simple-graphs.md](simple-graphs.md) | `therapy-ready` | `needs-check` | `development` |
| Состав числа | `number-bonds` | [number-bonds.md](number-bonds.md) | `therapy-ready` | `needs-check` | `development` |
| Магазин | `shop` | [shop.md](shop.md) | `therapy-ready` | `needs-check` | `development` |
| Координаты | `coordinates` | [coordinates.md](coordinates.md) | `therapy-ready` | `needs-check` | `development` |
| Формы | `shapes` | [shapes.md](shapes.md) | `polished` | `needs-check` | `development` |
| Цвет + форма | `color-shape` | [color-shape.md](color-shape.md) | `therapy-ready` | `needs-check` | `development` |
| Математика. Операции | `math-actions` | [math-actions.md](math-actions.md) | `polished` | `needs-check` | `development` |

### Головоломки

| Игра | ID | Документ | Status | Stability | Group |
|---|---|---|---|---|---|
| Сапёр | `minesweeper-safe` | [minesweeper-safe.md](minesweeper-safe.md) | `therapy-ready` | `needs-check` | `development` |
| Домино: найди сторону | `domino-matching` | [domino-matching.md](domino-matching.md) | `therapy-ready` | `needs-check` | `development` |
| 2048 мягкий | `calm-2048` | [calm-2048.md](calm-2048.md) | `therapy-ready` | `needs-check` | `development` |
| Пятнашки 3×3 | `sliding-puzzle` | [sliding-puzzle.md](sliding-puzzle.md) | `therapy-ready` | `needs-check` | `development` |
| Уно-подобное | `uno-like` | [uno-like.md](uno-like.md) | `therapy-ready` | `needs-check` | `development` |
| Тетрис спокойный | `calm-tetris` | [calm-tetris.md](calm-tetris.md) | `therapy-ready` | `needs-check` | `development` |
| Сокобан крупный | `sokoban-large` | [sokoban-large.md](sokoban-large.md) | `therapy-ready` | `needs-check` | `development` |
| Крестики-нолики | `tic-tac-toe` | [tic-tac-toe.md](tic-tac-toe.md) | `polished` | `needs-check` | `development` |
| 4 в ряд | `connect-four` | [connect-four.md](connect-four.md) | `polished` | `needs-check` | `development` |
| Реверси light | `reversi-light` | [reversi-light.md](reversi-light.md) | `therapy-ready` | `needs-check` | `development` |
| Lines 5 | `lines-five` | [lines-five.md](lines-five.md) | `therapy-ready` | `needs-check` | `development` |
| Шашки light | `checkers-light` | [checkers-light.md](checkers-light.md) | `therapy-ready` | `needs-check` | `development` |
| Chess mini | `chess-mini` | [chess-mini.md](chess-mini.md) | `therapy-ready` | `needs-check` | `development` |
| Tangram | `tangram` | [tangram.md](tangram.md) | `therapy-ready` | `needs-check` | `development` |
| Морской бой light | `battleship-light` | [battleship-light.md](battleship-light.md) | `therapy-ready` | `needs-check` | `development` |
| Танчики без стрельбы | `tanks-no-shooting` | [tanks-no-shooting.md](tanks-no-shooting.md) | `therapy-ready` | `needs-check` | `development` |
| Арканоид assist | `arkanoid-assist` | [arkanoid-assist.md](arkanoid-assist.md) | `therapy-ready` | `needs-check` | `development` |
| Понг пошаговый | `step-pong` | [step-pong.md](step-pong.md) | `therapy-ready` | `needs-check` | `development` |
| Змейка спокойная | `calm-snake` | [calm-snake.md](calm-snake.md) | `therapy-ready` | `needs-check` | `development` |
| Pac-path | `pac-path` | [pac-path.md](pac-path.md) | `therapy-ready` | `needs-check` | `development` |

### Непрерывное управление

| Игра | ID | Документ | Status | Stability | Group |
|---|---|---|---|---|---|
| Курсор-магнит | `cursor-magnet` | [cursor-magnet.md](cursor-magnet.md) | `therapy-ready` | `needs-check` | `development` |
| Пульсирующая цель | `pulsing-target` | [pulsing-target.md](pulsing-target.md) | `therapy-ready` | `needs-check` | `development` |
| Лодочка | `boat` | [boat.md](boat.md) | `therapy-ready` | `needs-check` | `development` |
| Змейка gaze-follow | `gaze-follow-snake` | [gaze-follow-snake.md](gaze-follow-snake.md) | `therapy-ready` | `needs-check` | `development` |
| Теннис | `table-tennis` | [table-tennis.md](table-tennis.md) | `polished` | `needs-check` | `development` |
| Дорожка с воротами | `gates-path` | [gates-path.md](gates-path.md) | `therapy-ready` | `needs-check` | `development` |
| Плавная машинка | `smooth-car` | [smooth-car.md](smooth-car.md) | `therapy-ready` | `needs-check` | `development` |
| Воздушный шар | `balloon-ride` | [balloon-ride.md](balloon-ride.md) | `therapy-ready` | `needs-check` | `development` |
| Планер | `glider` | [glider.md](glider.md) | `therapy-ready` | `needs-check` | `development` |
| Рисование линией | `line-drawing` | [line-drawing.md](line-drawing.md) | `therapy-ready` | `needs-check` | `development` |
| Рыбка-поводырь | `guide-fish` | [guide-fish.md](guide-fish.md) | `therapy-ready` | `needs-check` | `development` |
| Рельсы | `rails` | [rails.md](rails.md) | `therapy-ready` | `needs-check` | `development` |
| Балансир | `balancer` | [balancer.md](balancer.md) | `therapy-ready` | `needs-check` | `development` |
| Поймай волну | `catch-wave` | [catch-wave.md](catch-wave.md) | `therapy-ready` | `needs-check` | `development` |
| Снежная тропа | `snow-trail` | [snow-trail.md](snow-trail.md) | `therapy-ready` | `needs-check` | `development` |
| Робот-пылесос | `robot-vacuum` | [robot-vacuum.md](robot-vacuum.md) | `therapy-ready` | `needs-check` | `development` |
| Лабиринт-дорожка | `maze-path` | [maze-path.md](maze-path.md) | `therapy-ready` | `needs-check` | `development` |
| Садовая лейка | `garden-watering` | [garden-watering.md](garden-watering.md) | `therapy-ready` | `needs-check` | `development` |
| Космическая орбита | `space-orbit` | [space-orbit.md](space-orbit.md) | `therapy-ready` | `needs-check` | `development` |
| Оркестр-дирижёр | `orchestra-conductor` | [orchestra-conductor.md](orchestra-conductor.md) | `therapy-ready` | `needs-check` | `development` |

## Legacy / excluded docs

- [bubbles.md](bubbles.md) — legacy-документ для исключённой игры `Бульк`; игра не входит в текущий registry.

## Проверки

Обновить coverage после изменений registry:

```bash
npm run audit:readiness -- --output=docs/tests/2026-06-16/readiness-audit.json
```

Визуальный Electron CDP/PNG protocol описан в `docs/tests/2026-06-16/visual-audit-protocol.md`.
