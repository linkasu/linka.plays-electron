# Музыка для «Пони-оркестра»

Ноты всех стилей — `styles.py` (своя музыка, сочинена для игры). `compose.py` превращает их в петли:
MIDI → FluidSynth с набором FluidR3 GM (лицензия MIT) → из середины трёх повторов вырезается ровно
один круг, громкость ролей выравнивается по `LEVELS`.

Нужно положить в `tools/` (в git не попадает):

- FluidSynth для Windows: https://github.com/FluidSynth/fluidsynth/releases (v2.6.2, `win10-x64`),
  распаковать в `tools/fluidsynth/`;
- `tools/FluidR3_GM.sf2`: https://github.com/pianobooster/fluid-soundfont/releases (v3.1).

Ещё нужны Python с numpy и scipy и ffmpeg с libvorbis.

```sh
python compose.py            # все стили; или python compose.py rock jazz
python random_demo.py pop    # демо: пони включаются в случайные моменты
for s in pop rock classic jazz lullaby disco; do for r in beat bass chords keys lead sparkle; do
  ffmpeg -y -i $s/$r.wav -c:a libvorbis -q:a 4 ../../public/audio/music/pony-band/$s/$r.ogg
done; done
```

Темп каждого стиля должен давать целое число сэмплов и микросекунд на долю (проверяет `compose.py`),
иначе круги разъедутся. После смены темпа/длины обновить `src/frontend/games/pony-band/model.ts`.
