# Architecture

## Целевая схема

Приложение делится на слои:

- Electron shell: запуск, упаковка, доступ к нативному Tobii helper.
- Preload API: безопасный мост от renderer к Electron IPC.
- Frontend shell: Vue router, Vuetify layout, меню, настройки, результаты.
- Gaze engine: единая нормализация Tobii/mouse input.
- Game core: сессии, метрики, адаптация, события.
- Game registry: каталог игр и metadata.
- Game modules: отдельные игры.
- Data layer: WordBank, TTS/audio, ассеты, presets.

## Рекомендуемые папки

```text
src/frontend/
  core/
    gaze/
    session/
    metrics/
    adaptive/
  data/
    games.ts
    wordBank.ts
  games/
    butterfly/
    ...
  pages/
  components/
```

## Game module

Каждая игра должна иметь минимум:

```text
src/frontend/games/<game-id>/
  <GameName>Game.vue
  model.ts
```

Если игра простая, `model.ts` может содержать только генератор уровней и типы. Если игра canvas-heavy, туда выносится чистая логика без DOM.

## Общие правила

- Gaze input не читается напрямую внутри игр, кроме через общий composable.
- Игры не считают сессию сами: они вызывают общий session API.
- Игры не хранят настройки сложности в локальных magic numbers без registry/settings.
- Вся логика генерации уровней должна быть тестируемой отдельно от Vue.
- Canvas animation frame должен корректно останавливаться на unmount.
- Mouse fallback обязателен для каждой игры.

## Что хранить в registry

- `id`.
- `title`.
- `description`.
- `route`.
- `category`.
- `icon`.
- `skills`.
- `inputMode`.
- `recommendedSessionSeconds`.
- `difficultyPresets`.
- `status`.

## Что не хранить в registry

- Runtime state игры.
- Сырые gaze events.
- Большие ассеты.
- Логи сессий.
