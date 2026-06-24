# Full Electron runtime audit after fixes — 2026-06-10

Проверка выполнена через реальный Electron CDP target `LINKa plays` на `127.0.0.1:9222` после коммитов `bacfdc3`, `05bee9f`, `daebaaf`. Проверялись все игры из `src/frontend/data/games.ts` на viewport `1024x600` и `800x600`.

JSON с полными метриками: `devtools-full-runtime-after-fixes.json`.

## Summary

| Метрика | Значение |
|---|---:|
| Игр | 169 |
| Проверок viewport | 338 |
| Игр с runtime-флагами | 78 |
| Route mismatch | 0 |
| Blank-like screens после canvas-aware проверки | 0 |
| Console/runtime errors | 0 |
| Horizontal overflow | 0 |
| HUD/target overlaps | 0 |
| Prompt/target overlaps | 0 |
| Нет видимых targets при наличии targets | 43 |
| Видимые targets меньше 88px | 0 |
| Очень высокая страница, scrollHeight/clientHeight >= 2.2 | 26 |

## Top Remaining Runtime Flags

| Игра | Название | Категория | Runtime-флаги | Метрики |
|---|---|---|---|---|
| [arkanoid-assist](./arkanoid-assist.md) | Арканоид assist | strategy | no-visible-targets, many-cards-below-fold, very-tall-page | 1024x600: targets 0/3, min 0, y 2.57, cardsOut 6<br>800x600: targets 0/3, min 0, y 2.57, cardsOut 6 |
| [step-pong](./step-pong.md) | Понг пошаговый | strategy | no-visible-targets, many-cards-below-fold, very-tall-page | 1024x600: targets 0/3, min 0, y 2.56, cardsOut 6<br>800x600: targets 0/3, min 0, y 2.56, cardsOut 6 |
| [tanks-no-shooting](./tanks-no-shooting.md) | Танчики без стрельбы | strategy | no-visible-targets, many-cards-below-fold, very-tall-page | 1024x600: targets 0/4, min 0, y 2.55, cardsOut 6<br>800x600: targets 0/4, min 0, y 2.59, cardsOut 6 |
| [comic-strip](./comic-strip.md) | Комикс | sequencing | no-visible-targets, many-cards-below-fold, very-tall-page | 1024x600: targets 0/3, min 0, y 1.46, cardsOut 4<br>800x600: targets 0/3, min 0, y 2.68, cardsOut 7 |
| [train-sequence](./train-sequence.md) | Поезд | sequencing | no-visible-targets, many-cards-below-fold, very-tall-page | 1024x600: targets 0/5, min 0, y 2.24, cardsOut 7<br>800x600: targets 0/5, min 0, y 2.17, cardsOut 7 |
| [calm-tetris](./calm-tetris.md) | Тетрис спокойный | strategy | many-cards-below-fold, very-tall-page | 1024x600: targets 4/4, min 116, y 2.42, cardsOut 4<br>800x600: targets 4/4, min 116, y 2.36, cardsOut 4 |
| [day-routine](./day-routine.md) | Утро-день-вечер | sequencing | no-visible-targets, many-cards-below-fold, very-tall-page | 1024x600: targets 0/8, min 0, y 2.11, cardsOut 1<br>800x600: targets 0/8, min 0, y 2.78, cardsOut 3 |
| [dress-character](./dress-character.md) | Одень персонажа | sequencing | many-cards-below-fold, no-visible-targets, very-tall-page | 1024x600: targets 1/3, min 180, y 1.74, cardsOut 5<br>800x600: targets 0/3, min 0, y 2.54, cardsOut 5 |
| [sandwich](./sandwich.md) | Бутерброд | sequencing | many-cards-below-fold, no-visible-targets, very-tall-page | 1024x600: targets 2/5, min 169, y 1.74, cardsOut 3<br>800x600: targets 0/5, min 0, y 2.52, cardsOut 7 |
| [tangram](./tangram.md) | Tangram | strategy | no-visible-targets, many-cards-below-fold | 1024x600: targets 0/4, min 0, y 1.96, cardsOut 6<br>800x600: targets 0/4, min 0, y 1.87, cardsOut 5 |
| [uno-like](./uno-like.md) | Уно-подобное | strategy | many-cards-below-fold, no-visible-targets, very-tall-page | 1024x600: targets 2/4, min 307, y 1.77, cardsOut 5<br>800x600: targets 0/4, min 0, y 2.42, cardsOut 5 |
| [build-bridge](./build-bridge.md) | Строим мост | sequencing | no-visible-targets, many-cards-below-fold, very-tall-page | 800x600: targets 0/8, min 0, y 2.27, cardsOut 10 |
| [feed-animal](./feed-animal.md) | Покорми зверька | gaze-basics | no-visible-targets, many-cards-below-fold | 1024x600: targets 0/1, min 0, y 1.62, cardsOut 3<br>800x600: targets 0/1, min 0, y 1.44, cardsOut 2 |
| [first-then](./first-then.md) | Сначала-потом | sequencing | many-cards-below-fold, no-visible-targets | 1024x600: targets 2/2, min 242, y 1.44, cardsOut 3<br>800x600: targets 0/2, min 0, y 1.97, cardsOut 3 |
| [orchestra](./orchestra.md) | Оркестр | sequencing | no-visible-targets, many-cards-below-fold, very-tall-page | 800x600: targets 0/4, min 0, y 2.27, cardsOut 6 |
| [pizza-fractions](./pizza-fractions.md) | Доли пиццы | numeracy | many-cards-below-fold, very-tall-page | 1024x600: targets 3/3, min 309, y 1.24, cardsOut 4<br>800x600: targets 1/3, min 348, y 2.44, cardsOut 4 |
| [schedule](./schedule.md) | Расписание | sequencing | no-visible-targets, many-cards-below-fold, very-tall-page | 800x600: targets 0/8, min 0, y 2.53, cardsOut 9 |
| [simple-graphs](./simple-graphs.md) | Простые графики | numeracy | no-visible-targets, many-cards-below-fold | 1024x600: targets 0/3, min 0, y 1.34, cardsOut 4<br>800x600: targets 0/3, min 0, y 1.26, cardsOut 1 |
| [sokoban-large](./sokoban-large.md) | Сокобан крупный | strategy | no-visible-targets, many-cards-below-fold, very-tall-page | 800x600: targets 0/4, min 0, y 2.63, cardsOut 5 |
| [soup-recipe](./soup-recipe.md) | Рецепт супа | sequencing | no-visible-targets, many-cards-below-fold, very-tall-page | 800x600: targets 0/8, min 0, y 4.65, cardsOut 11 |
| [three-frame-story](./three-frame-story.md) | История из 3 кадров | sequencing | no-visible-targets, many-cards-below-fold, very-tall-page | 1024x600: targets 0/3, min 0, y 1.54, cardsOut 1<br>800x600: targets 1/3, min 230, y 2.25, cardsOut 4 |
| [tower](./tower.md) | Башня | sequencing | many-cards-below-fold, no-visible-targets | 1024x600: targets 3/5, min 136, y 1.78, cardsOut 5<br>800x600: targets 0/5, min 0, y 2.05, cardsOut 7 |
| [build-robot](./build-robot.md) | Собери роботика | sequencing | no-visible-targets, many-cards-below-fold | 800x600: targets 0/4, min 0, y 2, cardsOut 7 |
| [calm-2048](./calm-2048.md) | 2048 мягкий | strategy | many-cards-below-fold, very-tall-page | 800x600: targets 4/6, min 132, y 2.35, cardsOut 3 |
| [calm-snake](./calm-snake.md) | Змейка спокойная | strategy | no-visible-targets, many-cards-below-fold | 800x600: targets 0/4, min 0, y 1.99, cardsOut 5 |
| [choose-emotion](./choose-emotion.md) | Выбери эмоцию | language-aac | many-cards-below-fold | 1024x600: targets 3/3, min 220, y 1.15, cardsOut 4<br>800x600: targets 2/3, min 220, y 1.47, cardsOut 4 |
| [choose-picture](./choose-picture.md) | Выбери картинку | language-aac | many-cards-below-fold | 1024x600: targets 4/4, min 210, y 1.3, cardsOut 3<br>800x600: targets 4/4, min 210, y 1.27, cardsOut 3 |
| [domino-matching](./domino-matching.md) | Домино: найди сторону | strategy | many-cards-below-fold | 1024x600: targets 2/4, min 256, y 1.56, cardsOut 5<br>800x600: targets 2/4, min 256, y 1.93, cardsOut 5 |
| [follow-cue](./follow-cue.md) | Следуй за подсказкой | visual-search | many-cards-below-fold | 1024x600: targets 4/4, min 180, y 1.19, cardsOut 3<br>800x600: targets 4/4, min 172, y 1.12, cardsOut 3 |
| [grid-scanning](./grid-scanning.md) | Сканирование поля | visual-search | many-cards-below-fold | 1024x600: targets 4/4, min 160, y 1.2, cardsOut 3<br>800x600: targets 4/4, min 160, y 1.14, cardsOut 3 |
| [logic-pairs](./logic-pairs.md) | Логические пары | numeracy | many-cards-below-fold | 1024x600: targets 4/4, min 210, y 1.38, cardsOut 3<br>800x600: targets 2/4, min 210, y 1.71, cardsOut 5 |
| [mosaic](./mosaic.md) | Мозаика | sequencing | no-visible-targets | 1024x600: targets 0/4, min 0, y 1.98, cardsOut 1<br>800x600: targets 0/4, min 0, y 1.78, cardsOut 1 |
| [number-bonds](./number-bonds.md) | Состав числа | numeracy | no-visible-targets, many-cards-below-fold | 1024x600: targets 0/4, min 0, y 1.4, cardsOut 1<br>800x600: targets 2/4, min 190, y 1.69, cardsOut 5 |
| [object-action](./object-action.md) | Предмет + действие | language-aac | many-cards-below-fold | 1024x600: targets 2/4, min 210, y 1.68, cardsOut 5<br>800x600: targets 2/4, min 210, y 1.74, cardsOut 5 |
| [pyramid](./pyramid.md) | Пирамидка | sequencing | no-visible-targets, many-cards-below-fold | 800x600: targets 0/4, min 0, y 1.66, cardsOut 6 |
| [scales](./scales.md) | Весы | numeracy | many-cards-below-fold | 1024x600: targets 3/3, min 158, y 1.28, cardsOut 4<br>800x600: targets 1/3, min 158, y 1.81, cardsOut 4 |
| [shape-dance](./shape-dance.md) | Танец фигур | sequencing | no-visible-targets, many-cards-below-fold | 1024x600: targets 0/4, min 0, y 1.53, cardsOut 1<br>800x600: targets 2/4, min 210, y 1.71, cardsOut 5 |
| [shop](./shop.md) | Магазин | numeracy | many-cards-below-fold | 1024x600: targets 4/4, min 230, y 1.42, cardsOut 3<br>800x600: targets 4/4, min 230, y 1.38, cardsOut 3 |
| [sound-source](./sound-source.md) | Где звук? | visual-search | many-cards-below-fold | 1024x600: targets 2/2, min 250, y 1.19, cardsOut 3<br>800x600: targets 2/2, min 250, y 1.15, cardsOut 3 |
| [sudoku-2x2](./sudoku-2x2.md) | Судоку 2x2 | numeracy | no-visible-targets, many-cards-below-fold | 800x600: targets 0/2, min 0, y 1.63, cardsOut 3 |
| [want-dont-want](./want-dont-want.md) | Хочу / не хочу | language-aac | many-cards-below-fold | 1024x600: targets 2/2, min 264, y 1.44, cardsOut 3<br>800x600: targets 1/2, min 264, y 1.81, cardsOut 3 |
| [what-first](./what-first.md) | Что сначала? | language-aac | many-cards-below-fold | 1024x600: targets 2/2, min 292, y 1.55, cardsOut 3<br>800x600: targets 1/2, min 260, y 1.88, cardsOut 3 |
| [who-is-this](./who-is-this.md) | Кто это? | language-aac | no-visible-targets, many-cards-below-fold | 800x600: targets 0/4, min 0, y 1.88, cardsOut 6 |
| [yes-no](./yes-no.md) | Да / нет | language-aac | many-cards-below-fold | 1024x600: targets 2/2, min 220, y 1.17, cardsOut 3<br>800x600: targets 1/2, min 220, y 1.5, cardsOut 3 |
| [battleship-light](./battleship-light.md) | Морской бой light | strategy | very-tall-page | 1024x600: targets 10/25, min 133, y 2.22, cardsOut 1 |
| [bells](./bells.md) | Колокольчики | gaze-basics | many-cards-below-fold | 1024x600: targets 2/2, min 283, y 1.13, cardsOut 3 |
| [big-cards](./big-cards.md) | Большие карточки | gaze-basics | many-cards-below-fold | 1024x600: targets 2/2, min 260, y 1.11, cardsOut 3 |
| [calendar](./calendar.md) | Календарь | numeracy | many-cards-below-fold | 800x600: targets 2/4, min 190, y 1.39, cardsOut 3 |
| [coin-counting](./coin-counting.md) | Сложи монетки | numeracy | many-cards-below-fold | 1024x600: targets 3/5, min 190, y 1.54, cardsOut 4 |
| [color-pattern](./color-pattern.md) | Цветовой узор | sequencing | many-cards-below-fold | 800x600: targets 2/4, min 220, y 1.57, cardsOut 5 |
| [color-shape](./color-shape.md) | Цвет + форма | numeracy | many-cards-below-fold | 800x600: targets 4/4, min 266, y 1.45, cardsOut 3 |
| [find-animal](./find-animal.md) | Найди животное | visual-search | many-cards-below-fold | 800x600: targets 4/4, min 230, y 1.33, cardsOut 3 |
| [find-color](./find-color.md) | Найди цвет | visual-search | many-cards-below-fold | 800x600: targets 4/4, min 200, y 1.23, cardsOut 3 |
| [find-digit](./find-digit.md) | Найди цифру | numeracy | many-cards-below-fold | 800x600: targets 4/4, min 251, y 1.4, cardsOut 3 |
| [find-number](./find-number.md) | Найди число | visual-search | many-cards-below-fold | 800x600: targets 4/4, min 172, y 1.14, cardsOut 3 |
| [i-want](./i-want.md) | Я хочу... | language-aac | many-cards-below-fold | 800x600: targets 2/6, min 220, y 1.86, cardsOut 5 |
| [light-gallery](./light-gallery.md) | Галерея света | gaze-basics | many-cards-below-fold | 800x600: targets 4/8, min 159, y 1.8, cardsOut 7 |
| [lines-angles](./lines-angles.md) | Линии и углы | numeracy | many-cards-below-fold | 800x600: targets 4/4, min 225, y 1.31, cardsOut 3 |
| [lines-five](./lines-five.md) | Lines 5 | strategy | very-tall-page | 800x600: targets 10/25, min 104, y 2.42, cardsOut 2 |
| [match-same](./match-same.md) | Где такой же? | visual-search | many-cards-below-fold | 800x600: targets 4/4, min 190, y 1.33, cardsOut 3 |
| [mini-dialog](./mini-dialog.md) | Мини-диалог | language-aac | many-cards-below-fold | 800x600: targets 1/3, min 220, y 1.96, cardsOut 4 |
| [number-sorting](./number-sorting.md) | Сортировка чисел | numeracy | many-cards-below-fold | 1024x600: targets 3/5, min 210, y 1.6, cardsOut 6 |
| [odd-one-out](./odd-one-out.md) | Что лишнее? | visual-search | many-cards-below-fold | 800x600: targets 4/4, min 190, y 1.22, cardsOut 3 |
| [one-many](./one-many.md) | Один / много | language-aac | many-cards-below-fold | 1024x600: targets 2/2, min 288, y 1.09, cardsOut 3 |
| [opposites](./opposites.md) | Противоположности | language-aac | many-cards-below-fold | 800x600: targets 2/4, min 190, y 1.51, cardsOut 5 |
| [patterns](./patterns.md) | Паттерны | sequencing | many-cards-below-fold | 800x600: targets 2/4, min 180, y 1.44, cardsOut 5 |
| [shadow-match](./shadow-match.md) | Тень и предмет | visual-search | many-cards-below-fold | 800x600: targets 2/4, min 220, y 1.56, cardsOut 5 |
| [shapes](./shapes.md) | Формы | numeracy | many-cards-below-fold | 800x600: targets 4/4, min 208, y 1.27, cardsOut 3 |
| [shelf-sorting](./shelf-sorting.md) | Сортировка по полкам | sequencing | many-cards-below-fold | 800x600: targets 1/3, min 220, y 2.02, cardsOut 4 |
| [social-phrases](./social-phrases.md) | Социальные фразы | language-aac | many-cards-below-fold | 800x600: targets 1/3, min 220, y 2.15, cardsOut 4 |
| [what-missing](./what-missing.md) | Что пропало? | visual-search | many-cards-below-fold | 1024x600: targets 3/3, min 190, y 1.25, cardsOut 4 |
| [where-object](./where-object.md) | Где предмет? | language-aac | many-cards-below-fold | 800x600: targets 4/4, min 230, y 1.36, cardsOut 3 |
| [word-categories](./word-categories.md) | Категории слов | language-aac | many-cards-below-fold | 800x600: targets 2/4, min 220, y 1.62, cardsOut 5 |

## Вывод

- Подтвержденные P0/P1 runtime-классы из triage закрыты: horizontal overflow, HUD/prompt overlaps, small visible targets < 88px.
- Оставшиеся флаги в основном относятся к vertical first-viewport layout: targets ниже fold, очень высокая страница или карточки ниже первого viewport.
- Следующий технический шаг — общий compact-card паттерн для карточных sequencing/language/numeracy/strategy-trainer экранов.
