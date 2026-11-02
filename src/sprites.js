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

// The Hater: 20x28, faces right. Outline k, beanie e/E, skin s/S, beard r/R, jacket j/J, zip z, jeans n/N, boots o.
const HATER_PAL = {
  k: '#1b1420', e: '#C23B3B', E: '#8E2A2A', s: '#F1C9A5', S: '#D9A27E', W: '#FFFFFF', K: '#141414',
  r: '#7A4A2A', R: '#4E2C17', j: '#5B7340', J: '#3E5029', z: '#D7D7D7', n: '#34467A', N: '#243050', o: '#3A2A1E',
};
const HATER_TOP = [
  '......kkkkkkkk......',
  '.....keeeeeeeek.....',
  '....keeeeeeeeeek....',
  '....kEEEEEEEEEEk....',
  '....kssssssssssk....',
  '....kskksssskkSk....',
  '....ksWKssssWKSk....',
  '....kssssssSsssk....',
  '....krssssssssrk....',
  '....krrrrrrrrrrk....',
  '....krrkkkkkkrrk....',
  '....kRrrrrrrrrRk....',
  '.....kRrrrrrrrk.....',
  '...kkkkRRRRRRkkkk...',
  '..kJjjjjjjzjjjjjJk..',
  '..kJjjjjjjzjjjjjJk..',
  '..kJjjjjjjzjjjjjJk..',
  '..kJJjjjjjzjjjjJJk..',
  '..kJjjjjjjzjjjjjJk..',
  '..kJjjjjjjzjjjjjJk..',
  '..ksJjjjjjzjjjjJsk..',
  '...kJJJJJJJJJJJJk...',
  '...knnnnnnNNnnnnk...',
];
const HATER_LEGS = {
  stand: [
    '...knnnnnk.knnnnk...',
    '...knnnnNk.knnnNk...',
    '...knnnnNk.knnnNk...',
    '...kooooook.kooooook',
    '...kkkkkkkk.kkkkkkkk',
  ],
  walk: [
    '....knnnnk.knnnnk...',
    '....knnnNk..knnNk...',
    '...knnnNk...knnnNk..',
    '..koooook....koooook',
    '..kkkkkkk....kkkkkkk',
  ],
};
// Sign arm, hand on top (raised): 5x9
const HATER_ARM = [
  '.kkk.',
  'kssSk',
  'kssSk',
  'kjjJk',
  'kjjJk',
  'kjjJk',
  'kjjJk',
  'kjjJk',
  'kkkk.',
];

// Protester: 12x17, faces right. Shirt c/C is swapped per outfit.
const PROTESTER_PAL = {
  k: '#1b1420', h: '#5A3A22', s: '#F1C9A5', S: '#D9A27E', K: '#141414',
  c: '#C8423B', C: '#962E29', n: '#34467A', N: '#243050', o: '#3A2A1E',
};
const PROTESTER_OUTFITS = [{}, { c: '#2E9C8F', C: '#1F6E65', h: '#C9A15A', n: '#4A4A55', N: '#33333B' }];
const PROTESTER_TOP = [
  '...kkkkk....',
  '..khhhhhk...',
  '.khhhhhhhk..',
  '.khssssssk..',
  '.kssKsssKsk.',
  '.ksssssssSk.',
  '.ksskkkkssk.',
  '..kssssssk..',
  '.kkccccccckk',
  'kCcccccccccC',
  'kCcccccccccC',
  'ksCcccccccsk',
  '.kCCCCCCCCk.',
  '.knnnnnnnnk.',
];
const PROTESTER_LEGS = [
  ['.knnnk.knnk.', '.knNnk.kNnk.', 'kooook.koook'],
  ['..knnk.knnnk', '..knNk..kNnk', '.koook.koook'],
];

// Slop blob: 16x12, faces left. Outline g, body G, highlight L, shade D, mouth M.
const BLOB_PAL = {
  g: '#3F5A1E', G: '#9BBF4A', L: '#CDE68A', D: '#6F8F2F', W: '#FFFFFF', K: '#141414', M: '#2A1A12',
};
const BLOB = [
  '......gggg......',
  '....ggLLGGgg....',
  '...gLLGGGGGGg...',
  '..gLGWKGGGWKGg..',
  '..gGGWWGGGWWGg..',
  '.gGGGGGGWKGGGGg.',
  '.gGGGGGGWWGGGDg.',
  'gGGGMMMMMMGGGDDg',
  'gGGGMWMMWMGGGDDg',
  'gDGGGGGGGGGGGDDg',
  '.gDDgDDDgDDDgDg.',
  '..g..g...g...g..',
];

// Raw sheets, exported so tools can validate row widths.
export const SHEETS = {
  CLAWD: [...CLAWD_TOP, ...LEGS.idle], BYTE,
  HATER_STAND: [...HATER_TOP, ...HATER_LEGS.stand], HATER_WALK: [...HATER_TOP, ...HATER_LEGS.walk], HATER_ARM,
  PROTESTER_A: [...PROTESTER_TOP, ...PROTESTER_LEGS[0]], PROTESTER_B: [...PROTESTER_TOP, ...PROTESTER_LEGS[1]], BLOB,
};

function bake(rows, { flip = false, flipY = false, pal = PAL } = {}) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[flipY ? h - 1 - y : y][flip ? w - 1 - x : x];
      if (ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); }
    }
  return c;
}

// Bake a sprite facing right (1) and left (-1).
const both = (rows, pal, facesLeft = false) => ({
  1: bake(rows, { pal, flip: facesLeft }),
  [-1]: bake(rows, { pal, flip: !facesLeft }),
});

export function makeSprites() {
  const clawd = {};
  for (const [k, legs] of Object.entries(LEGS)) clawd[k] = both([...CLAWD_TOP, ...legs], PAL);
  return {
    clawd,
    byte: bake(BYTE),
    blob: both(BLOB, BLOB_PAL, true),
    hater: {
      stand: both([...HATER_TOP, ...HATER_LEGS.stand], HATER_PAL),
      walk: both([...HATER_TOP, ...HATER_LEGS.walk], HATER_PAL),
      arm: bake(HATER_ARM, { pal: HATER_PAL }),
    },
    protester: PROTESTER_OUTFITS.map(o => PROTESTER_LEGS.map(legs => both([...PROTESTER_TOP, ...legs], { ...PROTESTER_PAL, ...o }))),
  };
}

export const COLORS = PAL;
