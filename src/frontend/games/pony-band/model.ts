// Пони-оркестр. Owner's idea (2026-11-11): six big ponies, each plays its own part; look at a
// pony and it joins in, look again and it stops. Any pony can start at any moment and it must
// join in time with the others. A conductor pony changes costume (pop, rock, classic…) and with
// it all the music, so there are many melodies to mix.
// The music is our own: composed note by note in materials/music/styles.py and rendered into
// seamless loops. Inside a style all six loops share tempo, key and length.

export const ponyRoles = ["beat", "bass", "chords", "keys", "lead", "sparkle"] as const;
export type PonyRole = (typeof ponyRoles)[number];

export type PonyStyle = {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  bars: number;
  /** What each pony plays in this style (shown to the specialist, read by screen readers). */
  instruments: Record<PonyRole, string>;
};

export const ponyStyles: PonyStyle[] = [
  {
    id: "pop",
    title: "Поп",
    bpm: 120,
    beatsPerBar: 4,
    bars: 8,
    instruments: {
      beat: "барабаны",
      bass: "бас-гитара",
      chords: "гитара",
      keys: "клавиши",
      lead: "саксофон",
      sparkle: "колокольчики",
    },
  },
  {
    id: "rock",
    title: "Рок",
    bpm: 125,
    beatsPerBar: 4,
    bars: 8,
    instruments: {
      beat: "барабаны",
      bass: "бас-гитара",
      chords: "электрогитара",
      keys: "орган",
      lead: "соло-гитара",
      sparkle: "бубен",
    },
  },
  {
    id: "classic",
    title: "Классика",
    bpm: 100,
    beatsPerBar: 4,
    bars: 8,
    instruments: {
      beat: "литавры",
      bass: "контрабас",
      chords: "арфа",
      keys: "виолончель",
      lead: "скрипка",
      sparkle: "флейта",
    },
  },
  {
    id: "jazz",
    title: "Джаз",
    bpm: 120,
    beatsPerBar: 4,
    bars: 8,
    instruments: {
      beat: "барабаны",
      bass: "контрабас",
      chords: "гитара",
      keys: "пианино",
      lead: "труба",
      sparkle: "вибрафон",
    },
  },
  {
    id: "lullaby",
    title: "Колыбельная",
    bpm: 80,
    beatsPerBar: 3,
    bars: 8,
    instruments: {
      beat: "маракасы",
      bass: "контрабас",
      chords: "гитара",
      keys: "клавиши",
      lead: "кларнет",
      sparkle: "музыкальная шкатулка",
    },
  },
  {
    id: "disco",
    title: "Диско",
    bpm: 120,
    beatsPerBar: 4,
    bars: 8,
    instruments: {
      beat: "барабаны",
      bass: "бас-гитара",
      chords: "электрогитара",
      keys: "скрипка",
      lead: "тромбон",
      sparkle: "электропиано",
    },
  },
];

export function beatSeconds(style: PonyStyle) {
  return 60 / style.bpm;
}

export function loopSeconds(style: PonyStyle) {
  return style.bars * style.beatsPerBar * beatSeconds(style);
}

/**
 * When a pony chosen at `now` comes in: on the next beat of the music that is already playing,
 * so it lands in time. `lead` leaves the audio thread a moment to schedule the start.
 */
export function joinTime(clockStart: number, now: number, beat: number, lead = 0.03) {
  const beats = Math.max(0, Math.ceil((now + lead - clockStart) / beat - 1e-9));
  return clockStart + beats * beat;
}

/** Where in its loop a part starts so that it plays the same bar as everyone else. */
export function loopOffset(elapsed: number, loop: number) {
  return ((elapsed % loop) + loop) % loop;
}

export function nextStyleIndex(index: number) {
  return (index + 1) % ponyStyles.length;
}

export function ponyMusicPath(styleId: string, role: PonyRole) {
  return `audio/music/pony-band/${styleId}/${role}.ogg`;
}

export function ponyArtId(styleId: string, role: PonyRole) {
  return `pony-band/${styleId}-${role}`;
}

export function conductorArtId(styleId: string) {
  return `pony-band/conductor-${styleId}`;
}
