# Проверка «любая партия в любой момент»: как в игре — первый пони запускает общие часы,
# остальные включаются и выключаются в случайные моменты. Включение ждёт ближайшей доли
# (не дольше 0,5 с) и начинается с того места круга, где сейчас играют все, а не с начала.
import random, sys
import numpy as np
from scipy.io import wavfile
from compose import RATE, mp3

import styles
style = sys.argv[1] if len(sys.argv) > 1 else "pop"
bpm = next(s for s in styles.STYLES if s["id"] == style)["bpm"]
parts = ["beat", "bass", "chords", "keys", "lead", "sparkle"]
loops = {}
for n in parts:
    _, d = wavfile.read(f"{style}/{n}.wav")
    loops[n] = d.astype(np.float32) / 32768
L = len(loops["beat"])
beat = RATE * 60 / bpm
total = int(80 * RATE)
out = np.zeros((total, 2), np.float32)
rng = random.Random(3)
# (секунда нажатия, пони, включить/выключить) — нажатия в произвольные моменты, не по сетке.
presses = [(0.0, "lead", 1), (5.3, "beat", 1), (9.7, "bass", 1), (14.2, "chords", 1), (19.9, "sparkle", 1),
           (26.4, "lead", 0), (31.1, "keys", 1), (37.6, "beat", 0), (41.3, "lead", 1), (46.8, "beat", 1),
           (53.5, "bass", 0), (57.2, "bass", 1), (66.0, "chords", 0)]
state = {}
for t, name, on in presses:
    start = int(np.ceil(t * RATE / beat) * beat) if t > 0 else 0  # ближайшая доля
    if on:
        state[name] = start
    else:
        s0 = state.pop(name)
        fade = int(0.25 * RATE)
        idx = np.arange(s0, min(start + fade, total))
        g = np.ones(len(idx), np.float32); tail = idx >= start
        g[tail] = np.linspace(1, 0, tail.sum())
        fi = min(len(idx), int(0.02 * RATE)); g[:fi] *= np.linspace(0, 1, fi)
        out[idx] += loops[name][idx % L] * g[:, None]
for name, s0 in state.items():
    idx = np.arange(s0, total); g = np.ones(len(idx), np.float32)
    fi = int(0.02 * RATE); g[:fi] *= np.linspace(0, 1, fi); g[-2 * RATE:] *= np.linspace(1, 0, 2 * RATE)
    out[idx] += loops[name][idx % L] * g[:, None]
mp3(__import__("pathlib").Path(f"{style}-anytime-demo.mp3"), out)
print("ok", round(total / RATE), "s")
