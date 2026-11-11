# Сочиняет стили для игры с пони: каждая партия — отдельная петля одной длины,
# в одном темпе и одной тональности, чтобы любые партии звучали вместе.
# Ноты пишутся в MIDI, озвучиваются FluidSynth (набор FluidR3 GM, лицензия MIT),
# из середины трёх повторов вырезается ровно одна петля — так хвосты звука
# переходят через стык, и петля повторяется без щелчка.
import random
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile

here = Path(__file__).parent
tools = here / "tools"
fluidsynth = tools / "fluidsynth" / "fluidsynth-v2.6.2-win10-x64-cpp11" / "bin" / "fluidsynth.exe"
soundfont = tools / "FluidR3_GM.sf2"
ffmpeg = "ffmpeg"

RATE = 44100
TPB = 480  # тиков на четверть
STEP = TPB // 4  # шестнадцатая


def vlq(value):
    out = [value & 0x7F]
    value >>= 7
    while value:
        out.append(0x80 | (value & 0x7F))
        value >>= 7
    return bytes(reversed(out))


def write_midi(path, bpm, program, channel, notes, total_ticks):
    """notes: (tick, pitch, length_ticks, velocity)."""
    events = []
    for tick, pitch, length, velocity in notes:
        events.append((tick, 1, bytes([0x90 | channel, pitch, velocity])))
        events.append((tick + length, 0, bytes([0x80 | channel, pitch, 0])))
    events.sort(key=lambda e: (e[0], e[1]))
    track = bytearray()
    track += vlq(0) + b"\xff\x51\x03" + struct.pack(">I", round(60_000_000 / bpm))[1:]
    if channel != 9:
        track += vlq(0) + bytes([0xC0 | channel, program])
    track += vlq(0) + bytes([0xB0 | channel, 7, 110])  # громкость канала
    now = 0
    for tick, _, data in events:
        track += vlq(tick - now) + data
        now = tick
    track += vlq(max(0, total_ticks - now)) + b"\xff\x2f\x00"
    head = b"MThd" + struct.pack(">IHHH", 6, 0, 1, TPB)
    path.write_bytes(head + b"MTrk" + struct.pack(">I", len(track)) + bytes(track))


def loop_samples(style):
    beats = style["bars"] * style.get("beats", 4)
    exact = beats * RATE * 60 / style["bpm"]
    assert abs(exact - round(exact)) < 1e-6, "темп должен давать целое число сэмплов"
    assert (60_000_000 / style["bpm"]).is_integer(), "темп должен давать целое число микросекунд"
    return round(exact)


def render(part, style, out_dir):
    bars = style["bars"]
    steps_per_bar = 4 * style.get("beats", 4)
    loop_ticks = bars * steps_per_bar * STEP
    rng = random.Random(f"{style['id']}:{part['name']}")
    notes = []
    for rep in range(3):
        for bar in range(bars):
            for step, pitch, length, velocity in part["bar"](bar, style["chords"][bar]):
                v = max(1, min(127, velocity + rng.randint(-5, 5)))
                tick = round(((rep * bars + bar) * steps_per_bar + step) * STEP)
                notes.append((tick, pitch, max(20, round(length * STEP) - 10), v))
    mid = out_dir / f"{part['name']}.mid"
    wav = out_dir / f"{part['name']}.raw.wav"
    write_midi(mid, style["bpm"], part.get("program", 0), part.get("channel", 0), notes, loop_ticks * 3 + 8 * steps_per_bar * STEP)
    subprocess.run(
        [str(fluidsynth), "-ni", "-q", "-g", "0.5", "-r", str(RATE), "-F", str(wav), str(soundfont), str(mid)],
        check=True,
    )
    rate, data = wavfile.read(wav)
    assert rate == RATE
    wav.unlink()
    loop = loop_samples(style)
    data = data.astype(np.float32) / 32768
    return data[loop : 2 * loop]


def mp3(path, data):
    wav = path.with_suffix(".wav")
    wavfile.write(wav, RATE, (np.clip(data, -1, 1) * 32767).astype(np.int16))
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "192k", str(path)], check=True)


PEAK_CAP = {"beat": -3.0, "bass": -6.0, "chords": -6.0, "keys": -6.0, "lead": -6.0, "sparkle": -6.0}


def db(x):
    return 20 * np.log10(np.sqrt((x**2).mean()) + 1e-12)


def build(style, levels):
    out_dir = here / style["id"]
    out_dir.mkdir(exist_ok=True)
    loops = {}
    for part in style["parts"]:
        data = render(part, style, out_dir)
        # По средней громкости роли, но так, чтобы редкие удары не выскакивали громче предела.
        rms_gain = 10 ** ((levels[part["name"]] - db(data)) / 20)
        peak_cap = 10 ** (PEAK_CAP[part["name"]] / 20) / np.abs(data).max()
        loops[part["name"]] = data * min(rms_gain, peak_cap) * 10 ** (style.get("volume", 0) / 20)
    mix = sum(loops.values())
    gain = min(1.0, 0.95 / np.abs(mix).max())  # если все шесть вместе громче предела
    for name, data in loops.items():
        mp3(out_dir / f"{name}.mp3", data * gain)
    # Демо: пони включаются по одному, каждый новый — на следующем круге.
    order = style.get("demo_order", ["chords", "beat", "bass", "keys", "lead", "sparkle"])
    demo = np.concatenate([sum(loops[n] for n in order[: k + 1]) * gain for k in range(len(order))])
    tail = mix * gain
    demo = np.concatenate([demo, tail * np.linspace(1, 0, len(tail))[:, None]])
    mp3(here / f"{style['id']}-demo.mp3", demo)
    print(f"{style['id']:8s} круг {len(mix) / RATE:5.2f} с, общий запас {gain:.2f}")


if __name__ == "__main__":
    sys.path.insert(0, str(here))
    import styles

    for style in styles.STYLES:
        if len(sys.argv) < 2 or style["id"] in sys.argv[1:]:
            build(style, styles.LEVELS)
