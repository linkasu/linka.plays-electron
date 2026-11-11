# Стили для игры с пони. У каждого стиля шесть партий — по одной на пони, роли одинаковые
# во всех стилях: beat (ритм), bass, chords, keys, lead (мелодия), sparkle (украшение).
# Партия: функция bar(номер_такта, аккорд) -> [(шаг в шестнадцатых, нота MIDI, длина, громкость)].
# Все мелодии сочинены для игры, чужих мотивов нет.

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
        "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def n(name):
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]


def mel(text):
    """«0 E5 4, 4 G5 2» -> [(0, 76, 4), (4, 79, 2)]"""
    out = []
    for item in filter(None, (s.strip() for s in text.split(","))):
        step, note, length = item.split()
        out.append((float(step), n(note), float(length)))
    return out


def melody(bars, velocity, shift=0):
    table = [mel(t) for t in bars]
    return lambda bar, c: [(s, p + shift, length, velocity) for s, p, length in table[bar]]


def held(key, hits):
    return lambda bar, c: [(s, p, length, v) for s, length, v in hits for p in c[key]]


def arp(key, order, gap, length, strong, weak):
    return lambda bar, c: [
        (i * gap, c[key][k], length, strong if i % 2 == 0 else weak) for i, k in enumerate(order)
    ]


KICK, SOFT_KICK, SNARE, CLAP, HAT, PEDAL_HAT, OPEN_HAT, CRASH, RIDE = 36, 35, 38, 39, 42, 44, 46, 49, 51
TAMBOURINE, COWBELL, MARACAS = 54, 56, 70
TOMS = [50, 48, 45, 43]

# ---------------------------------------------------------------- Весёлый поп (одобрен)
P_C = {"root": 36, "guitar": [48, 55, 60, 64], "piano": [60, 64, 67], "bell": [84, 88, 91]}
P_G = {"root": 31, "guitar": [43, 50, 55, 59], "piano": [59, 62, 67], "bell": [83, 86, 91]}
P_Am = {"root": 33, "guitar": [45, 52, 57, 60], "piano": [60, 64, 69], "bell": [84, 88, 93]}
P_F = {"root": 29, "guitar": [41, 48, 53, 57], "piano": [60, 65, 69], "bell": [84, 89, 93]}


def pop_beat(bar, c):
    hits = [(s, KICK, 1, 110) for s in (0, 4, 8, 12)]
    hits += [(s, SNARE, 1, 96) for s in (4, 12)] + [(s, CLAP, 1, 70) for s in (4, 12)]
    hits += [(s, HAT, 1, 72 if s % 4 else 58) for s in range(0, 16, 2) if s != 14]
    hits.append((14, OPEN_HAT, 2, 66))
    if bar == 0:
        hits.append((0, CRASH, 4, 80))
    if bar == 7:
        hits += [(13, SNARE, 1, 70), (14, SNARE, 1, 84), (15, SNARE, 1, 100)]
    return hits


def pop_bass(bar, c):
    r = c["root"]
    pattern = [(0, r), (2, r), (4, r + 12), (6, r), (8, r), (10, r), (12, r + 12), (14, r + 7)]
    return [(s, p, 1.6, 100 if s % 4 == 0 else 84) for s, p in pattern]


def pop_sparkle(bar, c):
    lo, mid, hi = c["bell"]
    if bar % 4 == 3:
        run = zip(range(8, 16), [lo, mid, hi, mid + 12, hi, mid + 12, hi + 5, hi + 12])
        return [(s, p, 1, 70) for s, p in run] + [(0, hi, 4, 80), (4, mid, 4, 66)]
    return [(0, hi, 4, 80), (4, mid, 4, 66), (8, lo, 4, 70), (12, mid, 4, 62)]


POP = {
    "id": "pop",
    "title": "Весёлый поп",
    "bpm": 120,
    "bars": 8,
    "chords": [P_C, P_G, P_Am, P_F, P_C, P_G, P_F, P_G],
    "parts": [
        {"name": "beat", "channel": 9, "bar": pop_beat},
        {"name": "bass", "program": 33, "bar": pop_bass},
        {"name": "chords", "program": 25, "bar": arp("guitar", [0, 2, 1, 2, 3, 2, 1, 2], 2, 3, 78, 64)},
        {"name": "keys", "program": 0, "bar": held("piano", [(0, 5, 76), (6, 5, 66), (12, 3, 70)])},
        {"name": "lead", "program": 65, "bar": melody([
            "0 E5 4, 4 G5 2, 6 E5 2, 8 D5 4, 12 C5 4",
            "0 D5 6, 6 B4 2, 8 G4 8",
            "0 A4 2, 2 C5 2, 4 E5 4, 8 D5 2, 10 C5 2, 12 E5 4",
            "0 F5 6, 6 E5 2, 8 C5 8",
            "0 G5 4, 4 E5 2, 6 G5 2, 8 A5 4, 12 G5 4",
            "0 F5 4, 4 D5 4, 8 B4 4, 12 D5 4",
            "0 C5 2, 2 D5 2, 4 F5 4, 8 E5 4, 12 D5 2, 14 C5 2",
            "0 D5 8, 12 B4 2, 14 D5 2",
        ], 92, shift=-12)},
        {"name": "sparkle", "program": 9, "bar": pop_sparkle},
    ],
}

# ---------------------------------------------------------------- Рок
R_Em = {"root": 40, "power": [40, 47, 52], "organ": [59, 64, 67], "hi": [76, 79, 83]}
R_C = {"root": 36, "power": [48, 55, 60], "organ": [60, 64, 67], "hi": [76, 79, 84]}
R_G = {"root": 43, "power": [43, 50, 55], "organ": [59, 62, 67], "hi": [74, 79, 83]}
R_D = {"root": 38, "power": [50, 57, 62], "organ": [57, 62, 66], "hi": [74, 78, 81]}
R_B = {"root": 35, "power": [47, 54, 59], "organ": [59, 63, 66], "hi": [75, 78, 83]}


def rock_beat(bar, c):
    hits = [(0, KICK, 1, 118), (8, KICK, 1, 108), (10, KICK, 1, 96)]
    hits += [(s, SNARE, 1, 112) for s in (4, 12)]
    fill = bar == 7
    hits += [(s, HAT, 1, 84 if s % 4 == 0 else 64) for s in range(0, 16, 2) if not (fill and s >= 8)]
    if bar in (0, 4):
        hits.append((0, CRASH, 4, 96))
    if fill:
        hits += [(s, tom, 2, 104) for s, tom in zip((8, 10, 12, 14), TOMS)] + [(15, SNARE, 1, 96)]
    return hits


def rock_bass(bar, c):
    r = c["root"]
    return [(s, r, 1.7, 104 if s % 4 == 0 else 86) for s in range(0, 16, 2)]


def rock_chords(bar, c):
    hits = []
    for s in range(0, 16, 2):
        length, v = (3.5, 108) if s in (0, 8) else (1.4, 84)
        if s == 2 or s == 10:
            continue  # после длинного аккорда — пауза, так «качает»
        hits += [(s, p, length, v) for p in c["power"]]
    return hits


def rock_sparkle(bar, c):
    hits = [(s, TAMBOURINE, 1, 72 if s % 4 == 2 else 48) for s in range(0, 16, 2)]
    hits += [(s, COWBELL, 1, 74) for s in (0, 4, 8, 12)]
    return hits


ROCK = {
    "id": "rock",
    "title": "Рок",
    "bpm": 125,
    "bars": 8,
    "chords": [R_Em, R_C, R_G, R_D, R_Em, R_C, R_D, R_B],
    "parts": [
        {"name": "beat", "channel": 9, "bar": rock_beat},
        {"name": "bass", "program": 34, "bar": rock_bass},
        {"name": "chords", "program": 30, "bar": rock_chords},
        {"name": "keys", "program": 18, "bar": held("organ", [(0, 7.5, 70), (8, 7.5, 64)])},
        {"name": "lead", "program": 29, "bar": melody([
            "0 B4 6, 6 E5 2, 8 D5 4, 12 B4 4",
            "0 C5 6, 6 B4 2, 8 G4 8",
            "0 D5 4, 4 B4 2, 6 D5 2, 8 G5 8",
            "0 F#5 6, 6 E5 2, 8 D5 4, 12 A4 4",
            "0 B4 2, 2 E5 2, 4 G5 4, 8 F#5 2, 10 E5 2, 12 D5 4",
            "0 E5 8, 8 C5 4, 12 G4 4",
            "0 A4 4, 4 D5 4, 8 F#5 4, 12 A5 4",
            "0 D#5 6, 6 F#5 2, 8 B4 8",
        ], 100)},
        {"name": "sparkle", "channel": 9, "bar": rock_sparkle},
    ],
}

# ---------------------------------------------------------------- Классика
K_D = {"root": 38, "timp": 38, "harp": [50, 57, 62, 66, 69], "strings": [62, 66, 69], "hi": [78, 81, 86]}
K_G = {"root": 43, "timp": 38, "harp": [43, 50, 55, 59, 62], "strings": [62, 67, 71], "hi": [79, 83, 86]}
K_A = {"root": 45, "timp": 45, "harp": [45, 52, 57, 61, 64], "strings": [61, 64, 69], "hi": [76, 81, 85]}
K_Bm = {"root": 47, "timp": 38, "harp": [47, 54, 59, 62, 66], "strings": [62, 66, 71], "hi": [78, 83, 86]}
K_Em = {"root": 40, "timp": 40, "harp": [40, 47, 52, 55, 59], "strings": [59, 64, 67], "hi": [76, 79, 83]}


def classic_beat(bar, c):
    hits = [(0, c["timp"], 3, 96), (8, c["timp"], 3, 78)]
    if bar == 7:
        hits += [(s, c["timp"], 1, v) for s, v in zip((12, 13, 14, 15), (56, 66, 78, 92))]
    return hits


def classic_bass(bar, c):
    return [(0, c["root"], 7.5, 86), (8, c["root"] + 7, 7.5, 74)]


def classic_sparkle(bar, c):
    lo, mid, hi = c["hi"]
    if bar in (3, 7):
        return [(0, mid, 7.5, 70), (8, lo, 1.8, 66), (10, mid, 1.8, 66), (12, hi, 1.8, 70), (14, mid, 1.8, 62)]
    return [(0, mid, 7.5, 70), (8, lo, 7.5, 62)]


CLASSIC = {
    "id": "classic",
    "title": "Классика",
    "bpm": 100,
    "bars": 8,
    "chords": [K_D, K_G, K_D, K_A, K_Bm, K_G, K_Em, K_A],
    "parts": [
        {"name": "beat", "program": 47, "bar": classic_beat},
        {"name": "bass", "program": 43, "bar": classic_bass},
        {"name": "chords", "program": 46, "bar": arp("harp", [0, 1, 2, 3, 4, 3, 2, 1], 2, 4, 76, 62)},
        {"name": "keys", "program": 48, "bar": held("strings", [(0, 15.8, 62)])},
        {"name": "lead", "program": 40, "bar": melody([
            "0 F#5 4, 4 A5 4, 8 D6 6, 14 C#6 2",
            "0 B5 4, 4 G5 4, 8 D5 8",
            "0 F#5 2, 2 G5 2, 4 A5 4, 8 F#5 4, 12 D5 4",
            "0 E5 6, 6 C#5 2, 8 A4 8",
            "0 B4 4, 4 D5 4, 8 F#5 6, 14 E5 2",
            "0 D5 4, 4 B4 4, 8 G5 6, 14 F#5 2",
            "0 E5 4, 4 G5 4, 8 B5 4, 12 A5 4",
            "0 A5 6, 6 G5 2, 8 E5 4, 12 C#5 2, 14 E5 2",
        ], 90)},
        {"name": "sparkle", "program": 73, "bar": classic_sparkle},
    ],
}

# ---------------------------------------------------------------- Джаз (свинг)
SW = 8 / 3  # вторая восьмая в свинге — на третьей трети доли


def S(beat, off=0):
    return beat * 4 + (SW if off else 0)


J_Gm7 = {"root": 43, "walk": [43, 46, 50], "shell": [53, 58, 62], "comp": [65, 70, 74], "top": [74, 77, 82]}
J_C7 = {"root": 36, "walk": [36, 40, 43], "shell": [52, 58, 62], "comp": [64, 70, 74], "top": [76, 79, 82]}
J_F = {"root": 41, "walk": [41, 45, 48], "shell": [52, 57, 60], "comp": [64, 69, 72], "top": [76, 81, 84]}
J_Dm7 = {"root": 38, "walk": [38, 41, 45], "shell": [53, 57, 60], "comp": [65, 69, 72], "top": [74, 77, 81]}
J_D7 = {"root": 38, "walk": [38, 42, 45], "shell": [54, 60, 64], "comp": [66, 72, 76], "top": [74, 78, 81]}
JAZZ_CHORDS = [J_Gm7, J_C7, J_F, J_Dm7, J_Gm7, J_C7, J_F, J_D7]


def jazz_beat(bar, c):
    hits = [(S(b, o), RIDE, 1, v) for b, o, v in ((0, 0, 80), (1, 0, 92), (1, 1, 64), (2, 0, 80), (3, 0, 92), (3, 1, 64))]
    hits += [(S(1), PEDAL_HAT, 1, 70), (S(3), PEDAL_HAT, 1, 70)]
    hits += [(S(b), KICK, 1, 36) for b in range(4)]
    if bar % 2 == 1:
        hits.append((S(2, 1), SNARE, 1, 56))
    if bar == 7:
        hits += [(S(3, 1), SNARE, 1, 80)]
    return hits


def jazz_bass(bar, c):
    nxt = JAZZ_CHORDS[(bar + 1) % len(JAZZ_CHORDS)]["root"]
    third = c["walk"][2]
    approach = min((nxt - 1, nxt + 1, nxt + 11, nxt + 13), key=lambda p: abs(p - third))
    notes = c["walk"] + [approach]
    return [(S(b), p, 3.6, v) for b, (p, v) in enumerate(zip(notes, (96, 80, 88, 80)))]


def jazz_keys(bar, c):
    if bar % 4 == 3:
        hits = [(S(1, 1), 2, 66), (S(3), 2, 62)]
    else:
        hits = [(0, 3, 72), (S(1, 1), 2, 64)]
    return [(s, p, length, v) for s, length, v in hits for p in c["comp"]]


def jazz_lead():
    bars = [
        [(0, 1, "Bb4", 1.3), (1, 0, "C5", 2.6), (1, 1, "D5", 1.3), (2, 0, "F5", 4), (3, 1, "D5", 1.3)],
        [(0, 0, "E5", 6), (2, 0, "C5", 2.6), (2, 1, "Bb4", 1.3), (3, 0, "G4", 4)],
        [(0, 0, "A4", 2.6), (0, 1, "C5", 1.3), (1, 0, "E5", 6), (3, 0, "D5", 2.6), (3, 1, "C5", 1.3)],
        [(0, 0, "A4", 6), (2, 1, "F4", 1.3), (3, 0, "A4", 2.6), (3, 1, "C5", 1.3)],
        [(0, 0, "D5", 2.6), (0, 1, "F5", 1.3), (1, 0, "A5", 6), (3, 0, "G5", 2.6), (3, 1, "F5", 1.3)],
        [(0, 0, "E5", 4), (1, 1, "G5", 1.3), (2, 0, "E5", 2.6), (2, 1, "C5", 1.3), (3, 0, "Bb4", 4)],
        [(0, 0, "A4", 12), (3, 1, "C5", 1.3)],
        [(0, 0, "F#5", 4), (1, 1, "D5", 1.3), (2, 0, "C5", 2.6), (2, 1, "A4", 1.3), (3, 0, "F#4", 2.6), (3, 1, "A4", 1.3)],
    ]
    return lambda bar, c: [(S(b, o), n(p), length, 88) for b, o, p, length in bars[bar]]


def jazz_sparkle(bar, c):
    lo, mid, hi = c["top"]
    if bar in (3, 6):  # мелодия тянет длинную ноту — вибрафон отвечает
        run = [(S(2), lo), (S(2, 1), mid), (S(3), hi), (S(3, 1), hi + 5)]
        return [(s, p, 2, 62) for s, p in run]
    return [(S(2), mid, 4, 54), (S(2, 1), hi, 4, 48)]


JAZZ = {
    "id": "jazz",
    "title": "Джаз",
    "bpm": 120,
    "bars": 8,
    "chords": JAZZ_CHORDS,
    "parts": [
        {"name": "beat", "channel": 9, "bar": jazz_beat},
        {"name": "bass", "program": 32, "bar": jazz_bass},
        {"name": "chords", "program": 26, "bar": held("shell", [(S(b), 2, 64 if b % 2 == 0 else 70) for b in range(4)])},
        {"name": "keys", "program": 0, "bar": jazz_keys},
        {"name": "lead", "program": 56, "bar": jazz_lead()},
        {"name": "sparkle", "program": 11, "bar": jazz_sparkle},
    ],
}

# ---------------------------------------------------------------- Колыбельная (на три четверти)
L_G = {"root": 43, "arp": [43, 50, 55, 59, 62], "pad": [59, 62, 67], "hi": [83, 86, 91]}
L_Em = {"root": 40, "arp": [40, 47, 52, 55, 59], "pad": [59, 64, 67], "hi": [83, 88, 91]}
L_C = {"root": 36, "arp": [36, 43, 48, 52, 55], "pad": [60, 64, 67], "hi": [84, 88, 91]}
L_D = {"root": 38, "arp": [38, 45, 50, 54, 57], "pad": [57, 62, 66], "hi": [81, 86, 90]}
L_Am = {"root": 45, "arp": [45, 52, 57, 60, 64], "pad": [60, 64, 69], "hi": [81, 84, 88]}


def lullaby_beat(bar, c):
    return [(s, MARACAS, 1, 50 if s == 0 else 34) for s in range(0, 12, 2)] + [(0, SOFT_KICK, 1, 56)]


def lullaby_sparkle(bar, c):
    lo, mid, hi = c["hi"]
    if bar in (3, 7):
        return [(6, hi, 2, 58), (8, mid, 2, 54), (10, lo, 2, 50)]
    return [(4, hi, 3, 60), (8, mid, 3, 52)]


LULLABY = {
    "id": "lullaby",
    "title": "Колыбельная",
    "bpm": 80,
    "beats": 3,
    "volume": -3,  # колыбельная тише остальных
    "bars": 8,
    "chords": [L_G, L_Em, L_C, L_D, L_G, L_Em, L_Am, L_D],
    "parts": [
        {"name": "beat", "channel": 9, "bar": lullaby_beat},
        {"name": "bass", "program": 32, "bar": lambda bar, c: [(0, c["root"], 11, 72)]},
        {"name": "chords", "program": 24, "bar": arp("arp", [0, 2, 3, 4, 3, 2], 2, 4, 62, 52)},
        {"name": "keys", "program": 89, "bar": held("pad", [(0, 12, 54)])},
        {"name": "lead", "program": 71, "bar": melody([
            "0 D5 8, 8 B4 4",
            "0 G4 8, 8 B4 4",
            "0 E5 4, 4 D5 4, 8 C5 4",
            "0 A4 12",
            "0 B4 4, 4 D5 4, 8 G5 4",
            "0 F#5 4, 4 E5 4, 8 B4 4",
            "0 C5 4, 4 E5 4, 8 C5 4",
            "0 A4 8, 8 F#4 2, 10 A4 2",
        ], 80)},
        {"name": "sparkle", "program": 10, "bar": lullaby_sparkle},
    ],
}

# ---------------------------------------------------------------- Диско
D_Am7 = {"root": 33, "scratch": [60, 64, 67], "strings": [72, 76, 79], "hi": [81, 84, 88]}
D_Dm7 = {"root": 38, "scratch": [60, 65, 69], "strings": [72, 77, 81], "hi": [81, 84, 89]}
D_G = {"root": 43, "scratch": [59, 62, 67], "strings": [71, 74, 79], "hi": [79, 83, 86]}
D_C = {"root": 36, "scratch": [59, 64, 67], "strings": [71, 76, 79], "hi": [79, 83, 88]}
D_F = {"root": 41, "scratch": [60, 64, 69], "strings": [72, 76, 81], "hi": [81, 84, 88]}
D_E7 = {"root": 40, "scratch": [59, 62, 68], "strings": [71, 74, 80], "hi": [80, 83, 86]}


def disco_beat(bar, c):
    hits = [(s, KICK, 1, 112) for s in (0, 4, 8, 12)]
    hits += [(s, CLAP, 1, 92) for s in (4, 12)] + [(s, SNARE, 1, 66) for s in (4, 12)]
    hits += [(s, HAT, 1, 52 if s % 2 else 60) for s in range(16) if s % 4 != 2]
    hits += [(s, OPEN_HAT, 1.5, 82) for s in (2, 6, 10, 14)]
    if bar == 7:
        hits += [(s, SNARE, 1, v) for s, v in zip((12, 13, 14, 15), (64, 76, 88, 100))]
    return hits


def disco_bass(bar, c):
    r = c["root"]
    hits = [(s, r if s % 4 == 0 else r + 12, 1.5, 100 if s % 4 == 0 else 88) for s in range(0, 16, 2)]
    return hits + [(15, r + 12, 0.8, 70)]


def disco_chords(bar, c):
    hits = []
    for s in range(16):
        if s % 4 == 1:
            continue
        v = 86 if s % 4 == 2 else 54
        hits += [(s, p, 0.8, v) for p in c["scratch"]]
    return hits


DISCO = {
    "id": "disco",
    "title": "Диско",
    "bpm": 120,
    "bars": 8,
    "chords": [D_Am7, D_Dm7, D_G, D_C, D_F, D_Dm7, D_E7, D_E7],
    "parts": [
        {"name": "beat", "channel": 9, "bar": disco_beat},
        {"name": "bass", "program": 38, "bar": disco_bass},
        {"name": "chords", "program": 28, "bar": disco_chords},
        {"name": "keys", "program": 49, "bar": held("strings", [(0, 15.8, 66)])},
        {"name": "lead", "program": 61, "bar": melody([
            "2 A4 1.5, 4 C5 1.5, 6 E5 2, 10 D5 1, 12 C5 2",
            "2 A4 1.5, 4 C5 1.5, 6 F5 2, 10 E5 1, 12 D5 2",
            "0 B4 2, 2 D5 2, 4 G5 4, 10 F5 2, 12 D5 2",
            "0 E5 6, 8 G5 2, 10 E5 2, 12 C5 4",
            "2 A4 1.5, 4 C5 1.5, 6 F5 2, 10 E5 1, 12 C5 2",
            "2 D5 1.5, 4 F5 1.5, 6 A5 2, 10 G5 1, 12 F5 2",
            "0 G#5 4, 4 E5 2, 6 B4 2, 8 D5 4, 12 E5 4",
            "0 G#4 2, 2 B4 2, 4 D5 2, 6 E5 2, 8 G#5 8",
        ], 96)},
        {"name": "sparkle", "program": 4, "bar": arp("hi", [0, 1, 2, 1, 0, 1, 2, 1], 2, 2, 62, 50)},
    ],
}

STYLES = [POP, ROCK, CLASSIC, JAZZ, LULLABY, DISCO]

# Громкость каждой роли (RMS, дБ) — одинаковая во всех стилях, по одобренному «попу».
LEVELS = {"beat": -24.0, "bass": -22.0, "chords": -25.3, "keys": -26.7, "lead": -21.4, "sparkle": -27.2}
