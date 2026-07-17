# linka.plays-electron

Стартовый Electron/Vue/Canvas MVP для переноса `linka.plays-unity`.

## Что есть

- Electron main process с preload API для Tobii IPC scaffold.
- Vue 3 + Vuetify меню.
- Mouse fallback для разработки без айтрекера.
- Canvas-игра `Бабочки`.

## Команды

```bash
npm install
npm run typecheck
npm run build
npm run smoke:renderer-assets
npm run electron:serve
```

## Tobii

Сейчас Tobii-слой заложен как IPC scaffold: `tobii:status:get`, `tobii:status`, `tobii:gaze`.
Следующий шаг - перенести production tracker из `../linka.looks-electron/src/electron/tobii` и helper из `../linka.looks-electron/tools/tobiifree-helper`.

## Diagnostics

Для отправки диагностических отчётов задайте `LINKA_DIAGNOSTICS_URL` в окружении Electron-процесса.
