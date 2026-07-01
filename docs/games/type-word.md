# Печать слов

## Registry

| Поле | Значение |
|---|---|
| ID | `type-word` |
| Route | `/games/type-word` |
| Категория | `language-aac` — Слова и AAC |
| Status | `polished` |
| Resolved stability | `development` |
| Readiness group | `needs-check` |

## Unity source

- Scene: `Assets/Games/TypeWord/TypeWord.unity`.
- Asset: `Assets/Resources/Games/Games/TypeWord.asset`.
- Scripts: `TypeWordGameController.cs`, `FillGrid.cs`, `FillKeyboard.cs`, `FillTarget.cs`.

## Core mechanic

Показаны emoji/картинка и слово, которое нужно собрать по буквам. Ребёнок выбирает буквы взглядом на большой клавиатуре; повторная попытка не сдвигает текущую букву, а голосовая подсказка не называет правильную букву.

## Игровой цикл

```text
слово показано -> нужная буква подсвечена -> выбор буквы -> буква встала на место -> слово собрано
```

## Управление взглядом

- Dwell target на клавишах.
- Крупные клавиши.
- Confirm mode для сложного режима.
- Подсветка текущей нужной буквы в target word.

## Дефектологическая ценность

- Связь изображения, слова и букв.
- Подготовка к AAC/eye typing.
- Последовательность.
- Чтение и фонематическое внимание.

## Современное переосмысление

Unity добавляет случайные буквы до 5 клавиш. В Electron нужно сделать несколько режимов: минимальный выбор, слоги, полная экранная клавиатура, многоступенчатый gaze keyboard.

## Уровни сложности

- Gentle: 3-5 клавиш, нужная буква подсвечена.
- Standard: 5-8 клавиш, подсветка только в слове.
- Challenge: больше букв, confirm mode или группировка клавиатуры.

## Метрики

- Правильные буквы.
- Ошибочные буквы.
- Время на букву.
- Слова завершены.
- Частые ошибки по буквам.

## MVP

- WordBank sorted by word length.
- Target letters.
- Keyboard choices.
- Dwell selection.
- TTS prompt/correct/mistake/complete without answer reveal.

## Therapy-ready

- Настройка количества distractor letters.
- Повтор аудио слова.
- Confirm mode.
- Режим `сначала подсказка, потом самостоятельность`.

## Polished

- Группировка букв по зонам.
- Слоговые карточки.
- Красивое появление собранного слова.
- Озвучка собранного слова.

## QA checklist

- Текущая буква не выходит за границы слова.
- Слушатели кнопок не накапливаются при новом уровне.
- Ошибочная буква не ломает последовательность.

## Next step

Проверить в Electron CDP на 800×600/1024×600 и визуально подтвердить PNG перед approve.
