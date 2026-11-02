// Pixel-art sprites defined as strings and baked into offscreen canvases.

const PAL = {
  O: '#D97757', D: '#B0553A', H: '#F2A585', K: '#141414', W: '#FFFFFF',
  B: '#5BA4E6', b: '#3A78B5', P: '#FF8FB1',
  G: '#9BBF4A', g: '#5E7A2E', M: '#3B2A1E',
  h: '#5A3A22', s: '#F1C9A5', R: '#C8423B', n: '#2F3E66',
};

const CLAWD_TOP = [
  '..HHHHHHHHHH..',
  '..OOOOOOOOOO..',
  '..OOOKOOOOKO..',
  '..OOOKOOOOKO..',
  '..OOOOOOOOOO..',
  'OOOOOOOOOOOOOO',
  'OOOOOOOOOOOOOO',
  '..OOOOOOOOOO..',
  '..OOOOOOOOOO..',
  '..DDDDDDDDDD..',
];
const LEGS = {
  idle: ['..D.D....D.D..', '..D.D....D.D..'],
  run:  ['...D.D..D.D...', '..D...DD...D..'],
  air:  ['..D.D....D.D..', '..............'],
};

const BYTE = [
  '...BBBB...',
  '..BBBBBB..',
  '.BBKBBKBB.',
  '.BBKBBKBB.',
  '.BBBBBBBB.',
  '.BPBBBBPB.',
  '..BBBBBB..',
  '..bb..bb..',
];

const BLOB = [
  '.....gggg.....',
  '...ggGGGGgg...',
  '..gGWKGGWKGg..',
  '.gGGGGGGGGGGg.',
  '.gGGWKGGGGGGg.',
  'gGGGGGGGGGGGGg',
  'gGGGGMMMMGGGGg',
  'gGGGGGGGGGGGGg',
  '.gGgGGgGGgGGg.',
  '..g..g..g..g..',
];

const PROTESTER = [
  '...hhhh...',
  '..hsssshh.',
  '..sKssKs..',
  '..ssssss..',
  '..sMMMMs..',
  '...ssss...',
  '..RRRRRR..',
  '.sRRRRRRs.',
  '.sRRRRRRs.',
  '..RRRRRR..',
  '..nnnnnn..',
  '..nn..nn..',
  '..nn..nn..',
  '..nn..nn..',
  '.KKK..KKK.',
  '..........',
];

function bake(rows, flip = false) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][flip ? w - 1 - x : x];
      if (ch !== '.') { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); }
    }
  return c;
}

export function makeSprites() {
  const clawd = {};
  for (const [k, legs] of Object.entries(LEGS)) {
    clawd[k] = { 1: bake([...CLAWD_TOP, ...legs]), [-1]: bake([...CLAWD_TOP, ...legs], true) };
  }
  return {
    clawd,
    byte: bake(BYTE),
    blob: { 1: bake(BLOB, true), [-1]: bake(BLOB) },
    protester: { 1: bake(PROTESTER), [-1]: bake(PROTESTER, true) },
  };
}

export const COLORS = PAL;
