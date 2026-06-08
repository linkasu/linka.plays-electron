# Data WordBank And TTS

## Источник

Unity использует `Assets/Resources/WordsBank` и `WordSObject` с полями вроде:

- `id`;
- `word`;
- `emoji`;
- `category`;
- `clip`.

В Electron это нужно перенести в явный JSON/TS data layer.

## Целевая модель

```ts
type WordItem = {
  id: string;
  word: string;
  emoji: string;
  category: string;
  audioSrc?: string;
};
```

## Категории

Минимальные категории для переноса:

- `food` - съедобное.
- `thing` - несъедобные предметы.
- дополнительные категории из Unity CSV/Resources.

## Использование в играх

- `ChoosePicture`: вопрос словом, ответ emoji или наоборот.
- `EatOrNotEat`: классификация food/thing.
- `TypeWord`: слово, emoji, audio, буквы.

## TTS

TTS не должен блокировать игру. Аудио должно:

- предзагружаться для текущего уровня;
- иметь fallback без звука;
- не ломать игру при ошибке загрузки;
- быть отключаемым.

## Валидация данных

Проверять:

- уникальность `id`;
- непустой `word`;
- непустой `emoji`;
- существование категории;
- для `EatOrNotEat` наличие хотя бы нескольких `food` и `thing`;
- корректность audio path, если указан.
