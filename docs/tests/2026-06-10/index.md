# Аудит игр LINKa Plays — 2026-06-10

Этот каталог содержит статический аудит всех игр из `src/frontend/data/games.ts`, а также runtime-проверки через реальный Electron CDP target.

Статический этап зафиксировал подозрительные места, runtime-этап подтвердил часть layout-дефектов на `1024x600` и `800x600`.

## Сводка

| Метрика | Значение |
|---|---:|
| Игр в реестре | 169 |
| Реализованы в router | 169 |
| Высокий общий риск | 154 |
| Средний общий риск | 15 |
| Низкий общий риск | 0 |
| Высокий риск правил | 16 |
| Высокий UI-риск | 152 |

## Runtime CDP 2026-06-10

| Отчет | Назначение |
|---|---|
| [devtools-baseline-p0.md](./devtools-baseline-p0.md) | Базовая Electron CDP-проверка P0 до layout-фиксов |
| [devtools-after-compact-hud.md](./devtools-after-compact-hud.md) | Проверка после compact HUD |
| [devtools-after-controls-reorder.md](./devtools-after-controls-reorder.md) | Проверка controls-above-fold для `calm-2048` и `calm-tetris` |
| [devtools-full-runtime-audit.md](./devtools-full-runtime-audit.md) | Полный прогон 169 игр на `1024x600` и `800x600` |
| [devtools-runtime-triage.md](./devtools-runtime-triage.md) | Разбор false positives и подтвержденных runtime-дефектов |
| [devtools-after-overflow-fix.md](./devtools-after-overflow-fix.md) | Проверка после исправления horizontal overflow в `gaze-maze` и `pac-path` |
| [devtools-after-overlap-fix.md](./devtools-after-overlap-fix.md) | Проверка после исправления HUD/prompt overlaps в `hide-and-seek`, `musical-path`, `rails` |
| [devtools-after-target-size-fix.md](./devtools-after-target-size-fix.md) | Проверка после укрупнения малых targets в `tic-tac-toe` и `connect-four` |
| [devtools-full-runtime-after-fixes.md](./devtools-full-runtime-after-fixes.md) | Полный post-fix прогон 169 игр после закрытия P0/P1 runtime-флагов |
| [devtools-after-sequencing-compact.md](./devtools-after-sequencing-compact.md) | Проверка representative sequencing compact layout для `train-sequence`, `schedule`, `soup-recipe`, `build-bridge` |

Ключевые результаты полного post-fix runtime-прогона: все 169 routes открываются, route mismatch = 0, blank-like screens = 0, console/runtime errors = 0, horizontal overflow = 0, HUD/prompt overlaps = 0, small visible targets `<88px` = 0. Остаточные флаги относятся к vertical first-viewport layout: targets ниже fold, очень высокая страница или карточки ниже первого viewport.

## Статус фиксов

| Статус | Игры |
|---|---|
| Правила проигрыша исправлены | `minesweeper-safe`, `battleship-light`, `calm-2048`, `calm-tetris`, `lines-five`, `checkers-light`, `calm-snake`, `pac-path`, `sokoban-large`, `tanks-no-shooting`, `arkanoid-assist`, `step-pong` |
| Runtime layout частично исправлен | Компактный `GameHud`; `calm-2048` и `calm-tetris` controls подняты выше fold на 800x600 |
| Осталось как продуктовая/следующая задача | `chess-mini`, `domino-matching`, `uno-like`, `tangram`, `sliding-puzzle`, `reversi-light` требуют отдельного решения: strict/adult mode или перекатегоризация |

## Root cause UI

- `GameHud` фиксирован сверху через `position: fixed`, а игры вручную компенсируют его высоту через `padding-block-start`, `top` и локальные `hudHeight`. Это ломается при переносе текста, изменении масштаба и низком Electron окне.
- Многие игры используют `100vh/100vw` вместе с `overflow: hidden`; для canvas это ожидаемо, но карточки, подсказки и диалоги могут обрезаться.
- Текстовые карточки и quiet-controls часто размещены как `fixed/absolute` overlays и могут перекрывать gaze targets.
- В нескольких играх размеры объектов заданы пикселями или inline `:style`, что требует проверки на 1024x600/800x600 и при крупном шрифте.

## Приоритетные проблемы правил

| Игра | Название | Проблема | Минимальная правка |
|---|---|---|---|
| [minesweeper-safe](./minesweeper-safe.md) | Сапёр без взрыва | Мина не взрывается: выбор мины превращается в флаг и автоподсказку, сапер становится беспроигрышным. | Выбор мины должен завершать партию поражением или расходовать ограниченную жизнь; автоподсказку после мины убрать из default. |
| [domino-matching](./domino-matching.md) | Домино: найди сторону | Настольная игра реализована как обучающий выбор: неверный ответ подсвечивает правильную сторону, поражения нет. | Если оставлять в strategy, добавить ограничение ошибок; иначе перекатегоризировать как numeracy/classification trainer. |
| [calm-2048](./calm-2048.md) | 2048 мягкий | canMove=false уже определяется, но Vue говорит «это не проигрыш» и предлагает undo/new board. | Когда ходов нет, завершать партию как loss/no-moves; undo оставить только как assisted-mode. |
| [uno-like](./uno-like.md) | Уно-подобное | Нет руки, колоды, оппонента и штрафа; неверная карта раскрывает подходящие карты. | Wrong card = штраф/добор/попытка; после лимита = loss, либо переименовать как тренажер соответствия. |
| [calm-tetris](./calm-tetris.md) | Тетрис спокойный | Top-out невозможен: spawn в занятый верх чистит строки или сбрасывает доску. | canSpawnPiece=false должен завершать игру как top-out loss; clearTopRows только в assisted-mode. |
| [sokoban-large](./sokoban-large.md) | Сокобан крупный | Это следование предзаданному плану: неверный ход не применяется и возвращает подсказку, deadlock невозможен. | Разрешить все валидные движения, подсказку сделать отдельной, добавить step-limit/deadlock loss. |
| [lines-five](./lines-five.md) | Lines 5 | Поле при заполнении очищается без проигрыша, подсказочные ходы видны постоянно. | Полное поле без линии должно давать loss; suggestedMoves показывать только после запроса/ошибки. |
| [checkers-light](./checkers-light.md) | Шашки light | Нет полноценной партии: нет сторон/взятия/победы, при отсутствии ходов доска сбрасывается. | Убрать автосброс и завершать партию результатом; затем добавить хотя бы простые взятия. |
| [chess-mini](./chess-mini.md) | Chess mini | Это тренажер допустимых ходов, а не шахматная партия; неверный ход показывает все допустимые клетки. | Либо переименовать/перекатегоризировать как тренажер ходов, либо добавить failed task после N ошибок. |
| [tangram](./tangram.md) | Tangram | Это visual matching-тренажер: ошибка подсвечивает правильный танграм, провала нет. | Перенести из strategy/позиционировать как shape trainer или добавить N ошибок = failed round. |
| [battleship-light](./battleship-light.md) | Морской бой light | Морской бой завершает лимит ходов как обычный max-steps даже если корабли не найдены; в описании закреплено «без поражения». | Добавить outcome победа/поражение: все корабли найдены = win, лимит ходов при оставшихся кораблях = loss; обновить model.test.ts и финальный текст. |
| [tanks-no-shooting](./tanks-no-shooting.md) | Танчики без стрельбы | Без model.ts; неверное направление не двигает танк, сразу подсвечивает правильное, поражения нет. | Вынести маршрутную модель; неверный ход должен иметь последствие/лимит ошибок; finish route = win, лимит = loss. |
| [arkanoid-assist](./arkanoid-assist.md) | Арканоид assist | Неверный сектор не теряет мяч: softReturn и подсказка делают арканоид беспроигрышным. | Добавить lives/balls: wrong sector = минус жизнь, lives=0 = loss, все блоки = win. |
| [step-pong](./step-pong.md) | Понг пошаговый | Мяч не теряется: неправильная позиция только включает подсказку. | wrong lane = missed ball/минус жизнь, lives=0 = loss, серия отбиваний = win. |
| [calm-snake](./calm-snake.md) | Змейка спокойная | Модель специально избегает смерти у стены через gentleFallbackDirections. | Добавить strict/default outcome: столкновение со стеной/собой = loss; текущий fallback оставить только assisted-mode. |
| [pac-path](./pac-path.md) | Pac-path | Detour только подсвечивает правильный waypoint; нет погони/опасности/тупика. | Detour должен иметь последствие: потеря жизни/возврат/поражение после лимита; подсказка не авто. |

## Высокий UI-риск

| Игра | Название | Статические признаки |
|---|---|---|
| [aquarium](./aquarium.md) | Аквариум | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [balloons](./balloons.md) | Шарики | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [bells](./bells.md) | Колокольчики | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [high-five-hands](./high-five-hands.md) | Ладошки | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [breathing-flower](./breathing-flower.md) | Дышащий цветок | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [wake-owl](./wake-owl.md) | Разбуди сову | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Inline px sizing; Deep CSS override; Текстовая подсказка поверх сцены |
| [clouds](./clouds.md) | Облака | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [leaves-wind](./leaves-wind.md) | Листья на ветру | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [kite](./kite.md) | Воздушный змей | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [firefly-meadow](./firefly-meadow.md) | Светлячковая поляна | Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [catch-light](./catch-light.md) | Поймай свет | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [catch-star](./catch-star.md) | Поймай звезду | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [starry-sky](./starry-sky.md) | Звёздное небо | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [magic-dust](./magic-dust.md) | Волшебная пыль | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [light-gallery](./light-gallery.md) | Галерея света | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [soap-circles](./soap-circles.md) | Мыльные круги | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Deep CSS override; Текстовая подсказка поверх сцены |
| [find-house](./find-house.md) | Найди домик | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [northern-lights](./northern-lights.md) | Северное сияние | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [sun-rays](./sun-rays.md) | Солнце и лучи | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Deep CSS override; Текстовая подсказка поверх сцены |
| [koi-pond](./koi-pond.md) | Кои-пруд | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [snowflakes](./snowflakes.md) | Снежинки | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [moon-path](./moon-path.md) | Лунная дорожка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [lighthouse](./lighthouse.md) | Маяк | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Deep CSS override; Текстовая подсказка поверх сцены |
| [island](./island.md) | Островок | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [sand-garden](./sand-garden.md) | Песочный сад | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [sea-shells](./sea-shells.md) | Морские ракушки | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [paper-lanterns](./paper-lanterns.md) | Бумажные фонарики | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [open-door](./open-door.md) | Открой дверцу | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [warm-window](./warm-window.md) | Тёплое окно | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [warm-lamp](./warm-lamp.md) | Тёплая лампа | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Inline px sizing; Deep CSS override; Скрытие контента на малой высоте; Текстовая подсказка поверх сцены |
| [warm-fire](./warm-fire.md) | Тёплый костёр | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [musical-pebbles](./musical-pebbles.md) | Музыкальные камешки | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Inline px sizing; Deep CSS override; Текстовая подсказка поверх сцены |
| [big-button](./big-button.md) | Большая кнопка | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [rainbow-button](./rainbow-button.md) | Радужная кнопка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [color-circle](./color-circle.md) | Цветной круг | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Deep CSS override; Текстовая подсказка поверх сцены |
| [feed-animal](./feed-animal.md) | Покорми зверька | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Ручные пиксельные отступы |
| [butterfly](./butterfly.md) | Бабочки | Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [flowers](./flowers.md) | Цветы | Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [quiet-bubbles](./quiet-bubbles.md) | Тихие пузыри | Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [rain-garden](./rain-garden.md) | Сад дождя | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [ducks](./ducks.md) | Утки | Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [fishes](./fishes.md) | Рыбки | Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [jellyfish](./jellyfish.md) | Медузы | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [frog](./frog.md) | Жаба | Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [hide-and-seek](./hide-and-seek.md) | Прятки | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Inline px sizing; Текстовая подсказка поверх сцены |
| [who-hiding](./who-hiding.md) | Кто спрятался? | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Inline px sizing; Deep CSS override; Скрытие контента на малой высоте; Текстовая подсказка поверх сцены |
| [hidden-picture](./hidden-picture.md) | Скрытая картинка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Inline px sizing; Deep CSS override; Скрытие контента на малой высоте; Текстовая подсказка поверх сцены |
| [find-color](./find-color.md) | Найди цвет | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [find-shape](./find-shape.md) | Найди форму | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [match-same](./match-same.md) | Где такой же? | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [spot-difference](./spot-difference.md) | Найди отличие | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [follow-cue](./follow-cue.md) | Следуй за подсказкой | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [grid-scanning](./grid-scanning.md) | Сканирование поля | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [find-letter](./find-letter.md) | Найди букву | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [find-digit](./find-digit.md) | Найди цифру | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [logic-pairs](./logic-pairs.md) | Логические пары | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [find-number](./find-number.md) | Найди число | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [shadow-match](./shadow-match.md) | Тень и предмет | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [sound-source](./sound-source.md) | Где звук? | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Deep CSS override; Текстовая подсказка поверх сцены |
| [odd-one-out](./odd-one-out.md) | Что лишнее? | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [find-emotion](./find-emotion.md) | Найди эмоцию | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [letter-hunt](./letter-hunt.md) | Охота на буквы | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [find-animal](./find-animal.md) | Найди животное | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [memory-cards](./memory-cards.md) | Пары | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [gaze-maze](./gaze-maze.md) | Лабиринт взгляда-указателя | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Deep CSS override; Текстовая подсказка поверх сцены |
| [pyramid](./pyramid.md) | Пирамидка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Inline px sizing; Текстовая подсказка поверх сцены |
| [tower](./tower.md) | Башня | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Inline px sizing; Текстовая подсказка поверх сцены |
| [dress-character](./dress-character.md) | Одень персонажа | Использует fixed GameHud; Fullscreen viewport; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [train-sequence](./train-sequence.md) | Поезд | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [sandwich](./sandwich.md) | Бутерброд | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [patterns](./patterns.md) | Паттерны | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [day-routine](./day-routine.md) | Утро-день-вечер | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [three-frame-story](./three-frame-story.md) | История из 3 кадров | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [first-then](./first-then.md) | Сначала-потом | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [musical-path](./musical-path.md) | Музыкальная дорожка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Deep CSS override; Скрытие контента на малой высоте; Текстовая подсказка поверх сцены |
| [shape-dance](./shape-dance.md) | Танец фигур | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [hero-route](./hero-route.md) | Маршрут героя | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [soup-recipe](./soup-recipe.md) | Рецепт супа | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [schedule](./schedule.md) | Расписание | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [build-bridge](./build-bridge.md) | Строим мост | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [shelf-sorting](./shelf-sorting.md) | Сортировка по полкам | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [orchestra](./orchestra.md) | Оркестр | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [choose-emotion](./choose-emotion.md) | Выбери эмоцию | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [choose-picture](./choose-picture.md) | Выбери картинку | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [action-who](./action-who.md) | Кто что делает? | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [eat-or-not-eat](./eat-or-not-eat.md) | Съедобное | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [word-categories](./word-categories.md) | Категории слов | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [yes-no](./yes-no.md) | Да / нет | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [i-want](./i-want.md) | Я хочу... | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [want-dont-want](./want-dont-want.md) | Хочу / не хочу | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [object-action](./object-action.md) | Предмет + действие | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [hurt-good](./hurt-good.md) | Болит / хорошо | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [where-object](./where-object.md) | Где предмет? | Использует fixed GameHud; Fullscreen viewport; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [big-small](./big-small.md) | Большой / маленький | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Deep CSS override; Текстовая подсказка поверх сцены |
| [one-many](./one-many.md) | Один / много | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [what-sounds](./what-sounds.md) | Что звучит? | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Deep CSS override; Текстовая подсказка поверх сцены |
| [opposites](./opposites.md) | Противоположности | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [tell-picture](./tell-picture.md) | Расскажи картинку | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [what-first](./what-first.md) | Что сначала? | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [mini-dialog](./mini-dialog.md) | Мини-диалог | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [social-phrases](./social-phrases.md) | Социальные фразы | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [clock](./clock.md) | Часы | Использует fixed GameHud; Fullscreen viewport; Текстовая подсказка поверх сцены |
| [calendar](./calendar.md) | Календарь | Использует fixed GameHud; Fullscreen viewport; Текстовая подсказка поверх сцены |
| [coin-counting](./coin-counting.md) | Сложи монетки | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [pizza-fractions](./pizza-fractions.md) | Доли пиццы | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [greater-less](./greater-less.md) | Больше / меньше | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [scales](./scales.md) | Весы | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [number-line](./number-line.md) | Числовая дорожка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Скрытие контента на малой высоте; Текстовая подсказка поверх сцены |
| [number-sorting](./number-sorting.md) | Сортировка чисел | Использует fixed GameHud; Fullscreen viewport; Текстовая подсказка поверх сцены |
| [lines-angles](./lines-angles.md) | Линии и углы | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Deep CSS override |
| [simple-graphs](./simple-graphs.md) | Простые графики | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [shop](./shop.md) | Магазин | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [coordinates](./coordinates.md) | Координаты | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [color-shape](./color-shape.md) | Цвет + форма | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [domino-matching](./domino-matching.md) | Домино: найди сторону | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [calm-2048](./calm-2048.md) | 2048 мягкий | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [sliding-puzzle](./sliding-puzzle.md) | Пятнашки 3×3 | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [uno-like](./uno-like.md) | Уно-подобное | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [calm-tetris](./calm-tetris.md) | Тетрис спокойный | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [sokoban-large](./sokoban-large.md) | Сокобан крупный | Использует fixed GameHud; Fullscreen viewport; Overlay поверх поля; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [tic-tac-toe](./tic-tac-toe.md) | Крестики-нолики | Fullscreen viewport; Overlay поверх поля; Ручные пиксельные отступы; Deep CSS override; Текстовая подсказка поверх сцены |
| [connect-four](./connect-four.md) | 4 в ряд | Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Ручные пиксельные отступы; Deep CSS override; Скрытие контента на малой высоте; Текстовая подсказка поверх сцены |
| [reversi-light](./reversi-light.md) | Реверси light | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы; Deep CSS override |
| [lines-five](./lines-five.md) | Lines 5 | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы; Deep CSS override |
| [checkers-light](./checkers-light.md) | Шашки light | Использует fixed GameHud; Fullscreen viewport; Deep CSS override |
| [chess-mini](./chess-mini.md) | Chess mini | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы; Текстовая подсказка поверх сцены |
| [tangram](./tangram.md) | Tangram | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow |
| [battleship-light](./battleship-light.md) | Морской бой light | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [arkanoid-assist](./arkanoid-assist.md) | Арканоид assist | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [step-pong](./step-pong.md) | Понг пошаговый | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [calm-snake](./calm-snake.md) | Змейка спокойная | Использует fixed GameHud; Fullscreen viewport; Ручные пиксельные отступы |
| [pac-path](./pac-path.md) | Pac-path | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Deep CSS override; Скрытие контента на малой высоте; Текстовая подсказка поверх сцены |
| [cursor-magnet](./cursor-magnet.md) | Курсор-магнит | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Deep CSS override; Текстовая подсказка поверх сцены |
| [pulsing-target](./pulsing-target.md) | Пульсирующая цель | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [boat](./boat.md) | Лодочка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [gaze-follow-snake](./gaze-follow-snake.md) | Змейка gaze-follow | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [table-tennis](./table-tennis.md) | Теннис | Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [gates-path](./gates-path.md) | Дорожка с воротами | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [smooth-car](./smooth-car.md) | Плавная машинка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [balloon-ride](./balloon-ride.md) | Воздушный шар | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [glider](./glider.md) | Планер | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [line-drawing](./line-drawing.md) | Рисование линией | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [guide-fish](./guide-fish.md) | Рыбка-поводырь | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [rails](./rails.md) | Рельсы | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [balancer](./balancer.md) | Балансир | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [catch-wave](./catch-wave.md) | Поймай волну | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [snow-trail](./snow-trail.md) | Снежная тропа | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [robot-vacuum](./robot-vacuum.md) | Робот-пылесос | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [maze-path](./maze-path.md) | Лабиринт-дорожка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [garden-watering](./garden-watering.md) | Садовая лейка | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Текстовая подсказка поверх сцены |
| [space-orbit](./space-orbit.md) | Космическая орбита | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |
| [orchestra-conductor](./orchestra-conductor.md) | Оркестр-дирижёр | Использует fixed GameHud; Fullscreen viewport; Обрезание overflow; Overlay поверх поля; Текстовая подсказка поверх сцены |

## Общая таблица

| Игра | Название | Категория | Route | UI | Правила | Приоритет | Главный флаг |
|---|---|---|---|---|---|---|---|
| [aquarium](./aquarium.md) | Аквариум | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [balloons](./balloons.md) | Шарики | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [bells](./bells.md) | Колокольчики | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [high-five-hands](./high-five-hands.md) | Ладошки | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [breathing-flower](./breathing-flower.md) | Дышащий цветок | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [wake-owl](./wake-owl.md) | Разбуди сову | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [clouds](./clouds.md) | Облака | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [leaves-wind](./leaves-wind.md) | Листья на ветру | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [kite](./kite.md) | Воздушный змей | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [firefly-meadow](./firefly-meadow.md) | Светлячковая поляна | gaze-basics | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [catch-light](./catch-light.md) | Поймай свет | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [catch-star](./catch-star.md) | Поймай звезду | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [starry-sky](./starry-sky.md) | Звёздное небо | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [magic-dust](./magic-dust.md) | Волшебная пыль | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [light-gallery](./light-gallery.md) | Галерея света | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [soap-circles](./soap-circles.md) | Мыльные круги | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [find-house](./find-house.md) | Найди домик | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [northern-lights](./northern-lights.md) | Северное сияние | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [sun-rays](./sun-rays.md) | Солнце и лучи | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [koi-pond](./koi-pond.md) | Кои-пруд | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [snowflakes](./snowflakes.md) | Снежинки | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [moon-path](./moon-path.md) | Лунная дорожка | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [lighthouse](./lighthouse.md) | Маяк | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [island](./island.md) | Островок | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [sand-garden](./sand-garden.md) | Песочный сад | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [sea-shells](./sea-shells.md) | Морские ракушки | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [paper-lanterns](./paper-lanterns.md) | Бумажные фонарики | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [open-door](./open-door.md) | Открой дверцу | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [warm-window](./warm-window.md) | Тёплое окно | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [warm-lamp](./warm-lamp.md) | Тёплая лампа | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [warm-fire](./warm-fire.md) | Тёплый костёр | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [musical-pebbles](./musical-pebbles.md) | Музыкальные камешки | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [big-button](./big-button.md) | Большая кнопка | gaze-basics | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [rainbow-button](./rainbow-button.md) | Радужная кнопка | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [big-cards](./big-cards.md) | Большие карточки | gaze-basics | да | средний | средний | средний | Ошибки не завершают сессию |
| [color-circle](./color-circle.md) | Цветной круг | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [feed-animal](./feed-animal.md) | Покорми зверька | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [butterfly](./butterfly.md) | Бабочки | gaze-basics | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [flowers](./flowers.md) | Цветы | gaze-basics | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [quiet-bubbles](./quiet-bubbles.md) | Тихие пузыри | gaze-basics | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [rain-garden](./rain-garden.md) | Сад дождя | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [ducks](./ducks.md) | Утки | gaze-basics | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [fishes](./fishes.md) | Рыбки | gaze-basics | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [jellyfish](./jellyfish.md) | Медузы | gaze-basics | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [frog](./frog.md) | Жаба | gaze-basics | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [hide-and-seek](./hide-and-seek.md) | Прятки | visual-search | да | высокий | средний | высокий | Есть safe/reset/fallback механизм |
| [who-hiding](./who-hiding.md) | Кто спрятался? | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [hidden-picture](./hidden-picture.md) | Скрытая картинка | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [find-color](./find-color.md) | Найди цвет | visual-search | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [find-shape](./find-shape.md) | Найди форму | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [match-same](./match-same.md) | Где такой же? | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [spot-difference](./spot-difference.md) | Найди отличие | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [what-missing](./what-missing.md) | Что пропало? | visual-search | да | средний | средний | средний | Ошибки не завершают сессию |
| [follow-cue](./follow-cue.md) | Следуй за подсказкой | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [row-scanning](./row-scanning.md) | Сканирование ряда | visual-search | да | средний | средний | средний | Ошибки не завершают сессию |
| [grid-scanning](./grid-scanning.md) | Сканирование поля | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [find-letter](./find-letter.md) | Найди букву | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [find-digit](./find-digit.md) | Найди цифру | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [logic-pairs](./logic-pairs.md) | Логические пары | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [find-number](./find-number.md) | Найди число | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [shadow-match](./shadow-match.md) | Тень и предмет | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [sound-source](./sound-source.md) | Где звук? | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [odd-one-out](./odd-one-out.md) | Что лишнее? | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [find-emotion](./find-emotion.md) | Найди эмоцию | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [letter-hunt](./letter-hunt.md) | Охота на буквы | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [find-animal](./find-animal.md) | Найди животное | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [memory-cards](./memory-cards.md) | Пары | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [gaze-maze](./gaze-maze.md) | Лабиринт взгляда-указателя | visual-search | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [build-robot](./build-robot.md) | Собери роботика | sequencing | да | средний | средний | средний | Ошибки не завершают сессию |
| [pyramid](./pyramid.md) | Пирамидка | sequencing | да | высокий | средний | высокий | Есть safe/reset/fallback механизм |
| [tower](./tower.md) | Башня | sequencing | да | высокий | средний | высокий | Описание закрепляет беспроигрышность |
| [dress-character](./dress-character.md) | Одень персонажа | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [train-sequence](./train-sequence.md) | Поезд | sequencing | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [sandwich](./sandwich.md) | Бутерброд | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [patterns](./patterns.md) | Паттерны | sequencing | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [color-pattern](./color-pattern.md) | Цветовой узор | sequencing | да | средний | средний | средний | Ошибки не завершают сессию |
| [day-routine](./day-routine.md) | Утро-день-вечер | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [three-frame-story](./three-frame-story.md) | История из 3 кадров | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [first-then](./first-then.md) | Сначала-потом | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [musical-path](./musical-path.md) | Музыкальная дорожка | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [mosaic](./mosaic.md) | Мозаика | sequencing | да | средний | средний | средний | Ошибки не завершают сессию |
| [shape-dance](./shape-dance.md) | Танец фигур | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [hero-route](./hero-route.md) | Маршрут героя | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [soup-recipe](./soup-recipe.md) | Рецепт супа | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [fix-picture](./fix-picture.md) | Почини картинку | sequencing | да | средний | средний | средний | Ошибки не завершают сессию |
| [comic-strip](./comic-strip.md) | Комикс | sequencing | да | средний | средний | средний | Ошибки не завершают сессию |
| [schedule](./schedule.md) | Расписание | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [build-bridge](./build-bridge.md) | Строим мост | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [shelf-sorting](./shelf-sorting.md) | Сортировка по полкам | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [orchestra](./orchestra.md) | Оркестр | sequencing | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [choose-emotion](./choose-emotion.md) | Выбери эмоцию | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [choose-picture](./choose-picture.md) | Выбери картинку | language-aac | да | высокий | низкий | высокий | Использует fixed GameHud |
| [action-who](./action-who.md) | Кто что делает? | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [eat-or-not-eat](./eat-or-not-eat.md) | Съедобное | language-aac | да | высокий | низкий | высокий | Использует fixed GameHud |
| [word-categories](./word-categories.md) | Категории слов | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [yes-no](./yes-no.md) | Да / нет | language-aac | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [i-want](./i-want.md) | Я хочу... | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [want-dont-want](./want-dont-want.md) | Хочу / не хочу | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [object-action](./object-action.md) | Предмет + действие | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [hurt-good](./hurt-good.md) | Болит / хорошо | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [where-object](./where-object.md) | Где предмет? | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [big-small](./big-small.md) | Большой / маленький | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [one-many](./one-many.md) | Один / много | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [who-is-this](./who-is-this.md) | Кто это? | language-aac | да | средний | средний | средний | Ошибки не завершают сессию |
| [what-sounds](./what-sounds.md) | Что звучит? | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [opposites](./opposites.md) | Противоположности | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [tell-picture](./tell-picture.md) | Расскажи картинку | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [what-first](./what-first.md) | Что сначала? | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [mini-dialog](./mini-dialog.md) | Мини-диалог | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [social-phrases](./social-phrases.md) | Социальные фразы | language-aac | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [type-word](./type-word.md) | Печать слов | language-aac | да | средний | средний | средний | Есть safe/reset/fallback механизм |
| [clock](./clock.md) | Часы | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [calendar](./calendar.md) | Календарь | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [count-items](./count-items.md) | Счёт | numeracy | да | средний | средний | средний | Есть safe/reset/fallback механизм |
| [coin-counting](./coin-counting.md) | Сложи монетки | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [pizza-fractions](./pizza-fractions.md) | Доли пиццы | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [greater-less](./greater-less.md) | Больше / меньше | numeracy | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [scales](./scales.md) | Весы | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [number-line](./number-line.md) | Числовая дорожка | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [number-sorting](./number-sorting.md) | Сортировка чисел | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [sudoku-2x2](./sudoku-2x2.md) | Судоку 2x2 | numeracy | да | средний | средний | средний | Ошибки не завершают сессию |
| [lines-angles](./lines-angles.md) | Линии и углы | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [simple-graphs](./simple-graphs.md) | Простые графики | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [number-bonds](./number-bonds.md) | Состав числа | numeracy | да | средний | средний | средний | Ошибки не завершают сессию |
| [shop](./shop.md) | Магазин | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [coordinates](./coordinates.md) | Координаты | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [shapes](./shapes.md) | Формы | numeracy | да | средний | средний | средний | Ошибка превращается в подсказку |
| [color-shape](./color-shape.md) | Цвет + форма | numeracy | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [math-actions](./math-actions.md) | Математика. Операции | numeracy | да | средний | средний | средний | Есть safe/reset/fallback механизм |
| [minesweeper-safe](./minesweeper-safe.md) | Сапёр без взрыва | strategy | да | средний | высокий | высокий | Мина не взрывается: выбор мины превращается в флаг и автоподсказку, сапер становится беспроигрышным. |
| [domino-matching](./domino-matching.md) | Домино: найди сторону | strategy | да | высокий | высокий | высокий | Настольная игра реализована как обучающий выбор: неверный ответ подсвечивает правильную сторону, поражения нет. |
| [calm-2048](./calm-2048.md) | 2048 мягкий | strategy | да | высокий | высокий | высокий | canMove=false уже определяется, но Vue говорит «это не проигрыш» и предлагает undo/new board. |
| [sliding-puzzle](./sliding-puzzle.md) | Пятнашки 3×3 | strategy | да | высокий | средний | высокий | При исчерпании шагов нерешенная головоломка не оформлена как проигрыш; возможные ходы подсвечиваются постоянно. |
| [uno-like](./uno-like.md) | Уно-подобное | strategy | да | высокий | высокий | высокий | Нет руки, колоды, оппонента и штрафа; неверная карта раскрывает подходящие карты. |
| [calm-tetris](./calm-tetris.md) | Тетрис спокойный | strategy | да | высокий | высокий | высокий | Top-out невозможен: spawn в занятый верх чистит строки или сбрасывает доску. |
| [sokoban-large](./sokoban-large.md) | Сокобан крупный | strategy | да | высокий | высокий | высокий | Это следование предзаданному плану: неверный ход не применяется и возвращает подсказку, deadlock невозможен. |
| [tic-tac-toe](./tic-tac-toe.md) | Крестики-нолики | strategy | да | высокий | средний | высокий | Поражение и ничья есть; риск только UX с maxSteps=1. |
| [connect-four](./connect-four.md) | 4 в ряд | strategy | да | высокий | средний | высокий | Поражение AI/player и ничья есть; риск только UX: HUD показывает maxSteps=1 как технический костыль. |
| [reversi-light](./reversi-light.md) | Реверси light | strategy | да | высокий | средний | высокий | Реальное поражение AI есть, но неверные пустые клетки допускаются бесконечно из-за finishOnMistakes=false. |
| [lines-five](./lines-five.md) | Lines 5 | strategy | да | высокий | высокий | высокий | Поле при заполнении очищается без проигрыша, подсказочные ходы видны постоянно. |
| [checkers-light](./checkers-light.md) | Шашки light | strategy | да | высокий | высокий | высокий | Нет полноценной партии: нет сторон/взятия/победы, при отсутствии ходов доска сбрасывается. |
| [chess-mini](./chess-mini.md) | Chess mini | strategy | да | высокий | высокий | высокий | Это тренажер допустимых ходов, а не шахматная партия; неверный ход показывает все допустимые клетки. |
| [tangram](./tangram.md) | Tangram | strategy | да | высокий | высокий | высокий | Это visual matching-тренажер: ошибка подсвечивает правильный танграм, провала нет. |
| [battleship-light](./battleship-light.md) | Морской бой light | strategy | да | высокий | высокий | высокий | Морской бой завершает лимит ходов как обычный max-steps даже если корабли не найдены; в описании закреплено «без поражения». |
| [tanks-no-shooting](./tanks-no-shooting.md) | Танчики без стрельбы | strategy | да | средний | высокий | высокий | Без model.ts; неверное направление не двигает танк, сразу подсвечивает правильное, поражения нет. |
| [arkanoid-assist](./arkanoid-assist.md) | Арканоид assist | strategy | да | высокий | высокий | высокий | Неверный сектор не теряет мяч: softReturn и подсказка делают арканоид беспроигрышным. |
| [step-pong](./step-pong.md) | Понг пошаговый | strategy | да | высокий | высокий | высокий | Мяч не теряется: неправильная позиция только включает подсказку. |
| [calm-snake](./calm-snake.md) | Змейка спокойная | strategy | да | высокий | высокий | высокий | Модель специально избегает смерти у стены через gentleFallbackDirections. |
| [pac-path](./pac-path.md) | Pac-path | strategy | да | высокий | высокий | высокий | Detour только подсвечивает правильный waypoint; нет погони/опасности/тупика. |
| [cursor-magnet](./cursor-magnet.md) | Курсор-магнит | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [pulsing-target](./pulsing-target.md) | Пульсирующая цель | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [boat](./boat.md) | Лодочка | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [gaze-follow-snake](./gaze-follow-snake.md) | Змейка gaze-follow | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [table-tennis](./table-tennis.md) | Теннис | continuous-control | да | высокий | средний | высокий | Ошибка превращается в подсказку |
| [gates-path](./gates-path.md) | Дорожка с воротами | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [smooth-car](./smooth-car.md) | Плавная машинка | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [balloon-ride](./balloon-ride.md) | Воздушный шар | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [glider](./glider.md) | Планер | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [line-drawing](./line-drawing.md) | Рисование линией | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [guide-fish](./guide-fish.md) | Рыбка-поводырь | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [rails](./rails.md) | Рельсы | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [balancer](./balancer.md) | Балансир | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [catch-wave](./catch-wave.md) | Поймай волну | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [snow-trail](./snow-trail.md) | Снежная тропа | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [robot-vacuum](./robot-vacuum.md) | Робот-пылесос | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [maze-path](./maze-path.md) | Лабиринт-дорожка | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [garden-watering](./garden-watering.md) | Садовая лейка | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [space-orbit](./space-orbit.md) | Космическая орбита | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
| [orchestra-conductor](./orchestra-conductor.md) | Оркестр-дирижёр | continuous-control | да | высокий | средний | высокий | Ошибки не завершают сессию |
