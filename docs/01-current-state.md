# Current State

## Electron сейчас

В `linka.plays-electron` уже есть стартовый MVP:

- Electron main process.
- Vue 3.
- Vuetify.
- Hash router.
- Tobii IPC scaffold.
- Mouse fallback.
- Главная страница с карточками игр.
- Canvas-игра `Бабочки`.

Ключевые файлы:

- `src/frontend/data/games.ts` - текущий каталог игр, пока только `butterfly`.
- `src/frontend/games/butterfly/ButterflyGame.vue` - первая canvas-игра.
- `src/frontend/composables/useGazePointer.ts` - общий pointer/gaze источник.
- `src/frontend/composables/useTobiiStatus.ts` - статус Tobii.
- `src/electron/main.ts` и `src/electron/preload.ts` - Electron/Tobii IPC слой.

## Unity источник

В `../linka.plays-unity` найдено 15 игр в `Assets/Games`, но текущий план переносит 13 игр без `Labyrinth` / `Картинг` и `Bubbles` / `Бульк`.

Игры к переносу:

- `Butterfly` - Бабочки.
- `ChoosePicture` - Выбери картинку.
- `CountItems` - Счёт.
- `Ducks` - Утки.
- `EatOrNotEat` - Съедобное.
- `Fishes` - Рыбки / дно.
- `Flowers` - Цветы.
- `Frog` - Жаба.
- `Hide-and-seek` - Прятки.
- `Math` - Математика. Операции.
- `Pyramid` - Пирамидка.
- `TableTennis` - Теннис.
- `TypeWord` - Печать слов.

Исключено:

- `Labyrinth` - Картинг / Лабиринт.
- `Bubbles` - Бульк.

## Unity категории

- `Знакомство с трекером`: Бабочки, Утки, Рыбки, Цветы, Жаба, Прятки, Пирамидка.
- `Учим слова`: Выбери картинку, Съедобное, Печать слов.
- `Математика`: Счёт, Математика. Операции.
- `Приключения`: Теннис. Картинг исключён.

## Технические проблемы Unity, которые нельзя тащить дальше

- Часть логики зашита в `.unity` сценах через UnityEvents.
- Некоторые контроллеры пустые или полузаглушки.
- Есть несогласованность id: например, `Fishes` имеет `GameSceneId: fishes` в нижнем регистре.
- `Ducks` описан asset-файлом `Game.asset`, а не `Ducks.asset`.
- У многих игр пустые description и order.
- Ввод gaze в Unity смешан с игровой логикой.
- Длительность сессии, dwell timeout, штрафы и сложность не оформлены как продуктовые настройки.

## Принцип переноса

Каждая игра переносится как новая Electron-игра, но её исходная идея, цель и узнаваемый образ сохраняются. Если Unity-реализация устарела или не подходит для gaze UX, переносится не код, а смысл механики.
