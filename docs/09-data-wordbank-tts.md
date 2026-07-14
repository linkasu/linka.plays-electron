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

`emoji` остаётся обязательным fallback, но предметы в интерфейсе показываются через PNG из `public/images/words/<id>.png`. ASCII-имя по `id` не зависит от Unicode-нормализации русского слова.

## Картинки слов

Импорт готового zip-архива:

```bash
npm run words:images:import -- "/path/to/картинки.zip"
```

Импортер:

- извлекает архив через `bsdtar`, чтобы сохранить русские имена;
- приводит имена к Unicode NFC для сопоставления с `wordBank`;
- записывает найденные изображения под стабильными именами `<word-id>.png`;
- формирует `public/images/words/manifest.json`;
- сообщает о словах без изображения.

Для локальной генерации fallback-картинок из emoji используется `npm run words:images`. Оба способа создают одинаковые runtime-пути. Компонент `GameWordImage` при ошибке загрузки показывает `emoji`, поэтому отсутствие отдельного PNG не блокирует игру.

## Категории

Минимальные категории для переноса:

- `food` - съедобное.
- `thing` - несъедобные предметы.
- дополнительные категории из Unity CSV/Resources.

## Использование в играх

- `ChoosePicture`: вопрос словом, ответ картинкой или наоборот.
- `EatOrNotEat`: классификация food/thing.
- `TypeWord`: слово, картинка, audio, буквы.

## TTS

TTS не должен блокировать игру. Аудио должно:

- предзагружаться для текущего уровня;
- иметь fallback без звука;
- не ломать игру при ошибке загрузки;
- быть отключаемым.

## TTS API

Совместимый сервис найден в соседних проектах `tts-echo-docker`, `tts-echo`, `linka.looks-electron`, `linka-type-pwa-v2` и `linka.plays-unity`.

Для разработки использовать прямой TTS endpoint:

```bash
curl "https://tts.linka.su/voices"
curl "https://tts.linka.su/tts?text=Привет&voice=jane" --output sample.mp3
curl -X POST "https://tts.linka.su/tts" \
 -H "Content-Type: application/json" \
 --data '{"text":"Привет","voice":"jane"}' \
 --output sample.mp3
```

Локальный сервис из `../tts-echo-docker` обычно поднимается на `http://localhost:3000` через Docker Compose. Для прямого `go run` default может быть `http://localhost:8080`.

Параметры:

- `text` - обязательный текст.
- `voice` - голос, по умолчанию `jane`.
- `speed` - совместимый параметр, текущий Go-сервис его принимает, но игнорирует.

Ответ `/tts`: `audio/mpeg` с mp3-байтами. Ошибки возвращаются JSON и не должны ломать генерацию всей партии без понятного сообщения.

## Dev-загрузка ассетов

Статические TTS assets описываются в `src/frontend/data/ttsAssets.json`:

```json
[
 {
 "id": "high-five-hands.intro",
 "game": "high-five-hands",
 "text": "Посмотри на ладошку.",
 "voice": "jane",
 "path": "/audio/tts/high-five-hands/intro.mp3"
 }
]
```

Генерация mp3 в `public/audio/tts/...`:

```bash
npm run tts:assets
npm run tts:assets -- --game high-five-hands
TTS_BASE_URL=http://localhost:3000 npm run tts:assets -- --game high-five-hands --force
TTS_VOICE=alena npm run tts:assets -- --game high-five-hands
```

Опции генератора:

- `--game <id>` - сгенерировать фразы одной игры.
- `--force` - перезаписать уже существующие mp3.
- `--dry-run` - проверить манифест без сетевых запросов и записи файлов.
- `--base-url <url>` или `TTS_BASE_URL` - endpoint сервиса без `/tts`.
- `--voice <id>` или `TTS_VOICE` - голос по умолчанию для фраз без собственного `voice`.
- `--delay-ms <ms>` или `TTS_DELAY_MS` - пауза между запросами, чтобы не упираться в rate limit.

Runtime-подключение:

- Игры импортируют `ttsAssets.json` и выбирают фразы по `game`/`id`.
- Для проигрывания используется `src/frontend/core/ttsAudio.ts`.
- `warmTtsAssets()` предзагружает mp3 только если `session.settings.sound === true`.
- `playTtsAsset()` ставит звук и ловит ошибки autoplay/загрузки.
- Если файла нет, сеть недоступна или браузер запретил звук, игра продолжается без речи.

Для терапевтических игр TTS-фразы должны быть короткими,, без резких повторов и без обязательной зависимости геймплея от звука.

## Валидация данных

Проверять:

- уникальность `id`;
- непустой `word`;
- непустой `emoji`;
- существование категории;
- для `EatOrNotEat` наличие хотя бы нескольких `food` и `thing`;
- корректность audio path, если указан.
