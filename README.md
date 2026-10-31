# linka.plays-electron

«Линка. играй» (LINKa Plays Electron) — набор игр с управлением взглядом и мышью на
Electron, Vue и Canvas. Программу развивает и поддерживает [АНО «Линка»](https://nkolinka.ru/).

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

Оформление: Sunny Meadow по умолчанию; ещё две темы выбираются в меню. Устройство
стилей и правила новых сцен описаны в [документации тем](docs/appearance-themes.md).
Для smoke всех игр во всех темах в уже запущенном Electron с отдельным тестовым
профилем: `npm run audit:themes -- --port=9223 --base-url=http://127.0.0.1:5174`.

## Tobii

Сейчас Tobii-слой заложен как IPC scaffold: `tobii:status:get`, `tobii:status`, `tobii:gaze`.
Следующий шаг - перенести production tracker из `../linka.looks-electron/src/electron/tobii` и helper из `../linka.looks-electron/tools/tobiifree-helper`.

## Лицензия

Собственный исходный код проекта распространяется на условиях **GNU General Public License
версии 3 или любой более поздней версии** (`GPL-3.0-or-later`). Полный текст — в [LICENSE](LICENSE).

При распространении изменённой программы нужно соблюдать GPL, включая предоставление
получателям соответствующего исходного кода. Коммерческое использование разрешено.

Сторонние библиотеки, Tobii-компоненты и медиафайлы имеют собственные условия. Область действия
GPL, атрибуция и вопросы, которые нужно решить перед GPL-релизом, описаны в
[документе о лицензировании](docs/licensing.md).

## АНО «Линка»

На [nkolinka.ru](https://nkolinka.ru/) можно узнать о программах АНО «Линка», получить информацию
о помощи пользователям и поддержать работу организации. Контакт: [feedback@linka.su](mailto:feedback@linka.su).
