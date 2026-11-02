// Tiny Web Audio synth. Must be unlocked from a user gesture on iOS.

let ac = null, master = null, noiseBuf = null;

function tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, freq) {
  const t = ac.currentTime;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + dur);
}

const SOUNDS = {
  jump: () => tone('square', 280, 560, 0.09, 0.18),
  walljump: () => tone('square', 380, 760, 0.08, 0.18),
  land: () => tone('triangle', 140, 60, 0.06, 0.25),
  die: () => { noise(0.35, 0.5, 900); tone('sawtooth', 220, 40, 0.35, 0.22); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f * 1.01, 0.14, 0.16, i * 0.08)),
  throw: () => tone('triangle', 600, 220, 0.14, 0.12),
  crumble: () => noise(0.18, 0.3, 400),
  splat: () => noise(0.08, 0.2, 1600),
  select: () => tone('square', 660, 700, 0.05, 0.12),
};

export const sfx = {
  muted: false,
  unlock() {
    if (!ac) {
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain();
        master.gain.value = 0.6;
        master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch { return; }
    }
    if (ac.state === 'suspended') ac.resume();
  },
  play(name) {
    if (!ac || this.muted || ac.state !== 'running') return;
    SOUNDS[name]?.();
  },
};
