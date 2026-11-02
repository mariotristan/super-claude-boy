// Original chiptune soundtrack, composed for Super Claude Boy and synthesized live
// with Web Audio (no audio files, no third-party music).
//
// Track format:
//   chords  one chord per bar, cycled ("Am", "F", "C#m", "Bb"...)
//   mel     one string per bar, 8 eighth-note tokens: note ("E5", "F#4"), "-" hold, "." rest
//   bass    16-step pattern per bar: x root, o octave up, f fifth, . rest
//   k/s/h   16-step kick / snare / hi-hat patterns
import { audioGraph, onAudioUnlock } from './audio.js';

const TRACKS = {
  title: {
    bpm: 112, chords: 'C Am F G', arp: true,
    bass: 'x.......x.......', k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.',
    mel: ['E5 - G5 - C6 - B5 -', 'A5 - - - E5 - - -', 'F5 - A5 - C6 - A5 -', 'G5 - - - D5 - - -',
      'E5 - G5 - C6 - D6 -', 'E6 - C6 - A5 - - -', 'F5 - A5 - G5 - F5 -', 'E5 - D5 - C5 - - -'],
  },
  ending: {
    bpm: 120, chords: 'C G Am F', arp: true,
    bass: 'x...o...x...o...', k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.',
    mel: ['C5 E5 G5 - C6 - G5 E5', 'D5 G5 B5 - D6 - B5 G5', 'C5 E5 A5 - C6 - A5 E5', 'F5 A5 C6 - F6 - C6 A5',
      'E6 - D6 C6 - G5 - E5', 'D6 - B5 G5 - D5 - -', 'C6 - B5 A5 - E5 A5 C6', 'C6 - - - C6 - . .'],
  },
  'hello-world': {
    bpm: 140, chords: 'Am F C G', arp: true,
    bass: 'x.x.o.x.x.x.o.x.', k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.',
    mel: ['A4 C5 E5 - A5 - G5 E5', 'F5 - E5 C5 - A4 C5 -', 'C5 E5 G5 - C6 - B5 G5', 'B5 - A5 G5 - D5 - -',
      'A4 C5 E5 A5 - G5 - E5', 'F5 - A5 - C6 - A5 F5', 'G5 - E5 - C5 - E5 G5', 'B5 - - - G5 - D5 -'],
  },
  'wall-jump-101': {
    bpm: 150, chords: 'Em C D B', arp: true,
    bass: 'x..x..x.x..x..x.', k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.',
    mel: ['E5 - G5 - B5 - G5 E5', 'C5 - E5 - G5 - E5 -', 'D5 - F#5 - A5 - F#5 D5', 'B4 - D#5 - F#5 - B5 -',
      'E5 G5 B5 - E6 - D6 B5', 'C6 - B5 G5 - E5 - -', 'D5 F#5 A5 - D6 - C6 A5', 'B5 - - A5 F#5 - D#5 -'],
  },
  'slop-pit': {
    bpm: 126, chords: 'Dm Bb C A', arp: false,
    bass: 'x..xx..x.x..x..x', k: 'x......xx.......', s: '....x.......x..x', h: '..x...x...x...x.',
    mel: ['D5 - . F5 - . A5 -', 'Bb4 - . D5 - . F5 -', 'C5 - E5 - G5 - E5 C5', 'A4 - C#5 - E5 - - -',
      'D5 F5 A5 - G5 F5 E5 D5', 'F5 - - D5 Bb4 - - -', 'E5 G5 C6 - Bb5 A5 G5 E5', 'C#5 - E5 - A5 - - -'],
  },
  sawmill: {
    bpm: 160, chords: 'Gm Eb F D', arp: true,
    bass: 'x.x.x.x.x.x.x.x.', k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx',
    mel: ['G5 - D5 - G5 A5 Bb5 -', 'G5 - Eb5 - Bb4 - Eb5 -', 'F5 - C5 - F5 G5 A5 -', 'F#5 - D5 - A4 - D5 -',
      'Bb5 - A5 G5 - D5 G5 -', 'Eb6 - D6 C6 Bb5 - G5 -', 'A5 - G5 F5 - C5 F5 -', 'F#5 - A5 - D6 - - -'],
  },
  'context-collapse': {
    bpm: 144, chords: 'Cm Ab Bb G', arp: true,
    bass: 'x...o.x.x...o.x.', k: 'x.....x.x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx',
    mel: ['C5 - Eb5 - G5 - - Eb5', 'Ab4 - C5 - Eb5 - - C5', 'Bb4 - D5 - F5 - - D5', 'B4 - D5 - G5 - - -',
      'G5 - Eb5 C5 - G5 Ab5 G5', 'Ab5 - Eb5 C5 - Ab4 C5 Eb5', 'F5 - D5 Bb4 - F5 G5 F5', 'D5 - B4 - G4 - - -'],
  },
  'the-hater': {
    bpm: 172, chords: 'Em C Am B', arp: true,
    bass: 'xoxoxoxoxoxoxoxo', k: 'x..xx...x..xx...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx',
    mel: ['E5 E5 . E5 G5 - E5 -', 'B5 - A5 - G5 - F#5 -', 'E5 E5 . E5 G5 - B5 -', 'C6 - B5 - A5 - - -',
      'E6 - D6 - B5 - G5 -', 'C6 - B5 - A5 - E5 -', 'E5 G5 B5 - E6 - B5 -', 'D#6 - - - B5 - F#5 -'],
  },
};

// ---------------------------------------------------------------- compile

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = n => {
  const m = /^([A-G])([#b]?)(\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
};
const hz = m => 440 * 2 ** ((m - 69) / 12);

function compile(t) {
  const chords = t.chords.split(' ').map(c => {
    const m = /^([A-G][#b]?)(m?)$/.exec(c);
    const root = midi(m[1] + '2');
    return { root, tones: [0, m[2] ? 3 : 4, 7].map(i => root + i) };
  });
  const bars = t.mel.length;
  const notes = new Map(); // step -> { m, len }
  t.mel.forEach((bar, b) => {
    const tok = bar.split(' ');
    if (tok.length !== 8) throw new Error(`bar needs 8 tokens: ${bar}`);
    tok.forEach((n, i) => {
      if (n === '-' || n === '.') return;
      let len = 1;
      for (let j = b * 8 + i + 1; ; j++) {
        const next = t.mel[Math.floor(j / 8) % bars].split(' ')[j % 8];
        if (next !== '-' || j >= bars * 8) break;
        len++;
      }
      notes.set((b * 8 + i) * 2, { m: midi(n), len: len * 2 });
    });
  });
  return { ...t, chords, notes, total: bars * 16 };
}

const COMPILED = Object.fromEntries(Object.entries(TRACKS).map(([k, t]) => [k, compile(t)]));

// ---------------------------------------------------------------- synth

let out = null, echo = null;

function ensureChain(g) {
  if (out) return;
  const { ac, musicBus } = g;
  out = ac.createBiquadFilter();
  out.type = 'lowpass'; out.frequency.value = 4200;
  out.connect(musicBus);
  echo = ac.createDelay(1);
  echo.delayTime.value = 0.19;
  const fb = ac.createGain(); fb.gain.value = 0.22;
  echo.connect(fb).connect(echo);
  echo.connect(out);
}

function voice(ac, type, freq, t, dur, vol, dest) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.setValueAtTime(vol * 0.7, t + Math.max(0.01, dur * 0.5));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g);
  for (const d of dest) g.connect(d);
  o.start(t); o.stop(t + dur + 0.02);
}

function drum(g, kind, t) {
  const { ac, noiseBuf } = g;
  if (kind === 'k') {
    const o = ac.createOscillator(), gn = ac.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gn.gain.setValueAtTime(0.5, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(gn).connect(out);
    o.start(t); o.stop(t + 0.15);
    return;
  }
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
  src.buffer = noiseBuf;
  const dur = kind === 's' ? 0.11 : 0.03;
  f.type = kind === 's' ? 'bandpass' : 'highpass';
  f.frequency.value = kind === 's' ? 1800 : 7000;
  gn.gain.setValueAtTime(kind === 's' ? 0.22 : 0.06, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(gn).connect(out);
  src.start(t, Math.random() * 0.3); src.stop(t + dur);
}

function scheduleStep(g, tr, i, t, sd) {
  const s = i % 16;
  const ch = tr.chords[Math.floor(i / 16) % tr.chords.length];
  for (const k of ['k', 's', 'h']) if (tr[k][s] === 'x') drum(g, k, t);
  const b = tr.bass[s];
  if (b !== '.') {
    const m = ch.root + (b === 'o' ? 12 : b === 'f' ? 7 : 0);
    voice(g.ac, 'triangle', hz(m), t, sd * 1.8, 0.32, [out]);
  }
  if (tr.arp) voice(g.ac, 'square', hz(ch.tones[s % 3] + 24), t, sd * 0.8, 0.025, [out]);
  const n = tr.notes.get(i);
  if (n) voice(g.ac, 'square', hz(n.m), t, sd * n.len * 0.95, 0.07, [out, echo]);
}

// ---------------------------------------------------------------- sequencer

let enabled = true, want = null, playing = null, timer = null, step = 0, nextT = 0;

function tick() {
  const g = audioGraph();
  if (!g || !playing) return;
  const sd = 60 / playing.bpm / 4;
  while (nextT < g.ac.currentTime + 0.15) {
    scheduleStep(g, playing, step, nextT, sd);
    step = (step + 1) % playing.total;
    nextT += sd;
  }
}

function start() {
  const g = audioGraph();
  if (!g || !enabled || !want) return;
  if (playing === COMPILED[want] && timer) return;
  ensureChain(g);
  playing = COMPILED[want];
  step = 0;
  nextT = g.ac.currentTime + 0.08;
  clearInterval(timer);
  timer = setInterval(tick, 25);
  tick();
}

function halt() { clearInterval(timer); timer = null; playing = null; }

onAudioUnlock(start);

export const music = {
  get enabled() { return enabled; },
  setEnabled(on) { enabled = on; if (on) start(); else halt(); },
  play(name) { want = COMPILED[name] ? name : 'title'; start(); },
  stop() { want = null; halt(); },
};

export const TRACK_NAMES = Object.keys(TRACKS);
