import { T, DT, parseLevel, newPlayer, stepPlayer, updateWorld, checkDeath, touchesGoal, tileAt, isSolid } from './physics.js';
import { LEVELS } from './levels.js';
import { makeSprites, makeVariant as variant, COLORS } from './sprites.js';
import { sfx, audioGraph } from './audio.js';
import { music } from './music.js';
import { Input } from './input.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const SPR = makeSprites();
const flagEmoji = code => String.fromCodePoint(...[...code.toUpperCase()].map(c => c.charCodeAt(0) + 0x1F1A5));
const levelName = d => (d.flag ? `${flagEmoji(d.flag)} ` : '') + d.name;

const THEMES = [
  { sky: ['#1b1530', '#3a2350'], solid: '#4a3b63', top: '#8d7bb5', dot: '#5c4c78' },
  { sky: ['#0f1f2e', '#1f3d52'], solid: '#2e4a5e', top: '#6fa3bf', dot: '#3b5b70' },
  { sky: ['#1a1f12', '#33401f'], solid: '#4b4632', top: '#a39a6a', dot: '#5c573f' },
  { sky: ['#24140f', '#4a2a1c'], solid: '#5a3e33', top: '#c48a6a', dot: '#6b4b3f' },
  { sky: ['#101826', '#2a2140'], solid: '#3b3552', top: '#9a8fd0', dot: '#4a4366' },
  { sky: ['#2a0d12', '#4d1a22'], solid: '#4a2a30', top: '#d0707a', dot: '#5c363d' },
  { sky: ['#0d1f22', '#163a3f'], solid: '#2b4f53', top: '#6fc2bf', dot: '#365f63' },
  { sky: ['#1a1030', '#3a1d4a'], solid: '#4a2e5c', top: '#c27fd6', dot: '#5a3a6e' },
  { sky: ['#14161f', '#2a2a3d'], solid: '#3a3a52', top: '#d0a85c', dot: '#47475f' },
  { sky: ['#101a14', '#1f3326'], solid: '#2f4a38', top: '#8fc98a', dot: '#3a5a44' },
  { sky: ['#0a1a24', '#123447'], solid: '#24465a', top: '#4fd0e0', dot: '#2f5568' },
  { sky: ['#121a2b', '#22304d'], solid: '#34405e', top: '#7aa2ff', dot: '#3f4c6e' },
  { sky: ['#1f0f0a', '#3d1d12'], solid: '#4d2a1f', top: '#ff8a4c', dot: '#5e3527' },
  { sky: ['#1d0f26', '#3d1a3a'], solid: '#4a2a48', top: '#ffcf5c', dot: '#5a3557' },
  { sky: ['#0e0f10', '#1f2324'], solid: '#2c3133', top: '#9fe870', dot: '#383e40' },
  { sky: ['#2a0f2e', '#5a1f3a'], solid: '#5e3a3a', top: '#ffa31a', dot: '#704646' },  // México
  { sky: ['#0d2a14', '#1f4d22'], solid: '#3b4f2c', top: '#ffd23f', dot: '#4a6038' },  // Colombia
  { sky: ['#2a1a14', '#5a3224'], solid: '#6a5a48', top: '#e8d5b0', dot: '#7a6a56' },  // Perú
  { sky: ['#07281c', '#0f5a3e'], solid: '#1f6b4a', top: '#ffe14d', dot: '#2a7d58' },  // Brasil
  { sky: ['#12304f', '#3a7ab0'], solid: '#46739c', top: '#eaf6ff', dot: '#5483ad' },  // Argentina
];
const DEATH_LINES = {
  slop: ['Drowned in slop.', 'Too much slop.', 'Slop happens.'],
  saw: ['Hallucinated a saw.', 'Sawed in half.', 'Should have seen that.'],
  fall: ['Fell out of context.', 'Off by one.'],
  hater: ['Hated on.', '"Ban AI!"', 'Ratioed.'],
  bot: ['Scraped.', 'Added to the training set.', 'robots.txt ignored.'],
  hype: ['Hyped to death.', 'Disrupted.', 'Pivoted into a wall.'],
  reply: ['Well, actually…', '"Source?"', 'Reply-guyed.'],
  caps: ['YELLED AT.', 'TYPED IN ALL CAPS.', 'Comment section’d.'],
};

// ---------------------------------------------------------------- save

const SAVE_KEY = 'super-claude-boy-v1';
const save = (() => {
  const base = { best: {}, ghosts: {}, unlocked: 1, deaths: 0, muted: false, music: true, ctrlSize: 'm', seenIntro: false };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return base; }
})();
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage full or private mode */ } };
sfx.muted = save.muted;
music.setEnabled(save.music);

export const fmt = t => {
  if (t == null) return '--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
};

// ---------------------------------------------------------------- screens & input

const screens = { title: $('#title'), intro: $('#intro'), select: $('#select'), complete: $('#complete'), pause: $('#pause'), ending: $('#ending') };
const hud = $('#hud'), touchUI = $('#touch');
let state = 'title';
let focusables = [], focusIdx = 0;

const input = new Input(touchUI, { left: $('#t-left'), right: $('#t-right'), jump: $('#t-jump') });
input.onSource = () => { syncTouchUI(); paintFocus(); };

// Controller connect / disconnect feedback
const padName = id => id.replace(/\s*\(.*$/, '').trim() || 'Controller';
let padCount = 0, toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
}
input.onPadChange = (addedId, count) => {
  if (addedId) toast(`🎮 ${padName(addedId)} connected`);
  else if (count < padCount) toast('🎮 Controller disconnected');
  padCount = count;
  const hint = $('#pad-hint');
  hint.textContent = count ? `🎮 ${padName(input.padIds.split('|')[0])} ready · press A to play` : '🎮 Using a controller? Press any button on it to connect.';
  hint.classList.toggle('ready', count > 0);
};

function show(name) {
  state = name;
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  hud.hidden = !(name === 'play' || name === 'pause');
  syncTouchUI();
  music.play(['play', 'pause', 'complete'].includes(name) && def ? def.id : name === 'ending' ? 'ending' : 'title');
  focusables = screens[name] ? [...screens[name].querySelectorAll('button:not([disabled])')] : [];
  focusIdx = Math.max(0, focusables.findIndex(b => b.dataset.default !== undefined));
  paintFocus();
}

function syncTouchUI() {
  touchUI.hidden = state !== 'play';
  touchUI.classList.toggle('faded', input.lastSource !== 'touch');
}

function paintFocus() {
  focusables.forEach((b, i) => b.classList.toggle('focus', i === focusIdx && input.lastSource !== 'touch'));
}

input.onNav = action => {
  sfx.unlock();
  if (state === 'play') {
    if (action === 'pause' || action === 'back') pause();
    else if (action === 'restart') restart();
    return;
  }
  if (state === 'intro') {
    if (action === 'confirm') nextIntroPanel();
    else if (action === 'back' || action === 'pause') endIntro();
    return;
  }
  if (action === 'restart' && (state === 'complete' || state === 'pause')) return startLevel(levelIndex);
  if (action === 'back' || action === 'pause') {
    if (state === 'pause') return resume();
    if (state === 'select') return show('title');
    if (state === 'complete' || state === 'ending') return openSelect();
    return;
  }
  if (!focusables.length) return;
  const cols = +(screens[state]?.dataset.cols || 1);
  const delta = { left: -1, right: 1, up: -cols, down: cols }[action];
  if (delta) {
    focusIdx = (focusIdx + delta + focusables.length) % focusables.length;
    sfx.play('select');
    paintFocus();
  } else if (action === 'confirm') {
    focusables[focusIdx]?.click();
  }
};

for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => sfx.unlock(), { capture: true });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// Title
$('#btn-play').onclick = () => (save.seenIntro ? openSelect() : playIntro(() => startLevel(0)));
$('#btn-intro').onclick = () => playIntro(() => show('title'));
$('#btn-music').onclick = toggleMusic;
$('#btn-p-music').onclick = toggleMusic;
function toggleMusic() {
  save.music = !save.music;
  persist();
  music.setEnabled(save.music);
  updateMusicLabels();
}
function updateMusicLabels() {
  for (const id of ['#btn-music', '#btn-p-music']) $(id).textContent = `♪ Music: ${save.music ? 'On' : 'Off'}`;
}
updateMusicLabels();

// Touch control size (S/M/L)
const SIZES = ['s', 'm', 'l'];
function applyCtrlSize() {
  const sz = SIZES.includes(save.ctrlSize) ? save.ctrlSize : 'm';
  $('#touch').dataset.size = sz;
  $('#btn-size').textContent = `Controls: ${sz.toUpperCase()}`;
}
$('#btn-size').onclick = () => { save.ctrlSize = SIZES[(SIZES.indexOf(save.ctrlSize) + 1) % 3]; persist(); applyCtrlSize(); };
applyCtrlSize();

// Select
function openSelect() {
  const grid = $('#level-grid');
  grid.innerHTML = '';
  LEVELS.forEach((def, i) => {
    const b = document.createElement('button');
    const best = save.best[def.id];
    const locked = i >= save.unlocked && best == null; // levels you've cleared stay open
    b.className = 'level-card' + (locked ? ' locked' : '') + (best != null && best <= def.par ? ' aplus' : '');
    b.disabled = locked;
    b.innerHTML = `<span class="num">${i + 1}${def.boss ? ' ☠' : ''}</span><span class="name">${locked ? '???' : levelName(def)}</span>`
      + `<span class="time">${locked ? '🔒' : best != null ? fmt(best) : 'not cleared'}</span>`
      + (best != null && best <= def.par ? '<span class="grade">A+</span>' : '');
    if (i === Math.min(save.unlocked, LEVELS.length) - 1) b.dataset.default = '';
    b.onclick = () => startLevel(i);
    grid.appendChild(b);
  });
  const all = LEVELS.every(d => save.best[d.id] != null);
  const total = LEVELS.reduce((s, d) => s + (save.best[d.id] ?? 0), 0);
  $('#total').textContent = all ? `Total best: ${fmt(total)}  ·  Deaths: ${save.deaths}` : `Deaths: ${save.deaths}`;
  show('select');
}
$('#btn-back').onclick = () => show('title');

// Pause
function pause() { if (state === 'play') { show('pause'); updateMuteLabel(); } }
function resume() { show('play'); lastTime = performance.now(); }
$('#btn-pause').onclick = pause;
$('#btn-restart').onclick = () => restart();
$('#btn-resume').onclick = resume;
$('#btn-p-restart').onclick = () => { startLevel(levelIndex); };
$('#btn-p-levels').onclick = openSelect;
$('#btn-mute').onclick = () => { save.muted = sfx.muted = !sfx.muted; persist(); updateMuteLabel(); };
const updateMuteLabel = () => { $('#btn-mute').textContent = sfx.muted ? 'Sound: Off' : 'Sound: On'; };

// Complete
$('#btn-next').onclick = () => (levelIndex + 1 < LEVELS.length ? startLevel(levelIndex + 1) : playScene('outro', showEnding));
$('#btn-retry').onclick = () => startLevel(levelIndex);
$('#btn-levels').onclick = openSelect;
$('#btn-end-levels').onclick = openSelect;

function showEnding() {
  const total = LEVELS.reduce((s, d) => s + (save.best[d.id] ?? 0), 0);
  const all = LEVELS.every(d => save.best[d.id] != null);
  $('#end-total').textContent = `${all ? `Total best: ${fmt(total)}  ·  ` : ''}Deaths: ${save.deaths}`;
  show('ending');
}

// ---------------------------------------------------------------- run state

let levelIndex = 0, def, lv, player, run, ghost = null;
let splats = [], particles = [], shake = 0, flash = 0;
const cam = { x: 0, y: 0, snap: true };

function startLevel(i) {
  levelIndex = i;
  def = LEVELS[i];
  splats = [];
  particles = [];
  run = null;
  ghost = save.ghosts[def.id] || null;
  $('#hud-level').textContent = `${i + 1}. ${levelName(def)}`;
  $('#hud-best').textContent = save.best[def.id] != null ? `best ${fmt(save.best[def.id])}` : '';
  run = { deaths: 0 };
  resetAttempt();
  cam.snap = true;
  show('play');
  lastTime = performance.now();
}

function resetAttempt() {
  lv = parseLevel(def);
  player = newPlayer(lv);
  Object.assign(run, { steps: 0, started: false, dead: false, deadT: 0, won: false, wonT: 0, rec: [], cause: '' });
  player.squash = 0;
  input.clearJump();
  $('#hud-deaths').textContent = `💀 ${run.deaths}`;
}

function restart() { if (run && !run.won) resetAttempt(); }

function step() {
  const inp = input.sample();
  if (run.won) { run.wonT += DT; return; }
  if (run.dead) { run.deadT -= DT; if (run.deadT <= 0) resetAttempt(); return; }
  if (!run.started) {
    if (!(inp.left || inp.right || inp.jumpPressed)) return;
    run.started = true;
  }
  run.steps++;
  const ev = [];
  stepPlayer(player, inp, lv, DT, ev);
  updateWorld(lv, DT, player, ev);
  handleEvents(ev);
  if (run.steps % 2 === 0) {
    const anim = !player.onGround ? 2 : Math.abs(player.vx) > 20 ? 1 : 0;
    run.rec.push(Math.round(player.x), Math.round(player.y), player.face, anim);
  }
  const cause = checkDeath(player, lv);
  if (cause) return die(cause);
  if (touchesGoal(player, lv)) win();
}

function handleEvents(ev) {
  for (const e of ev) {
    switch (e.type) {
      case 'jump': sfx.play('jump'); player.squash = -0.35; burst(e.x, e.y, 4, '#ffffff55', 40); break;
      case 'walljump':
        sfx.play('walljump'); player.squash = -0.3; burst(e.x, e.y, 5, '#ffffff66', 60);
        addSplat(e.dir > 0 ? e.x : e.x - 2, e.y - 3, 2, 6); break;
      case 'land':
        if (e.vy > 250) { sfx.play('land'); player.squash = Math.min(0.4, e.vy / 1500); burst(e.x, e.y, 4, '#ffffff44', 50); }
        addSplat(e.x - 7, e.y, 14, 2); break;
      case 'crumble': sfx.play('crumble'); burst(e.x, e.y, 10, THEMES[def.theme].top, 120); break;
      case 'throw': sfx.play('throw'); break;
      case 'type':
        if (Math.abs(e.x - player.x) < 14 * T && Math.abs(e.y - player.y) < 9 * T) sfx.play('type');
        burst(e.x, e.y, 3, '#7fe0ff', 50); break;
      case 'shotHit': burst(e.x, e.y, 6, e.kind === 'tomato' ? '#d9342b' : '#eeeeee', 90); break;
    }
  }
  if (player.onGround && Math.abs(player.vx) > 60 && run.steps % 6 === 0) addSplat(player.x + 2, player.y + player.h, 8, 1);
  if (player.sliding && run.steps % 4 === 0) {
    addSplat(player.wall > 0 ? player.x + player.w : player.x - 2, player.y + 4, 2, 5);
    burst(player.wall > 0 ? player.x + player.w : player.x, player.y + player.h, 1, COLORS.O, 20);
  }
}

function addSplat(x, y, w, h) {
  splats.push({ x, y, w, h });
  if (splats.length > 900) splats.shift();
}

function burst(x, y, n, color, speed, grav = 400) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.4 + Math.random() * 0.4, color, size: 1 + Math.random() * 2, grav });
  }
}

function die(cause) {
  run.dead = true;
  run.deadT = 0.45;
  run.deaths++;
  save.deaths++;
  persist();
  const lines = DEATH_LINES[cause] || DEATH_LINES.slop;
  run.cause = lines[(Math.random() * lines.length) | 0];
  if (run.deaths > 3 && def.tips?.length) run.tip = def.tips[(run.deaths - 4) % def.tips.length];
  $('#hud-deaths').textContent = `💀 ${run.deaths}`;
  sfx.play('die');
  const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
  burst(cx, cy, 30, COLORS.O, 220, 600);
  burst(cx, cy, 10, COLORS.D, 160, 600);
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 18;
    const sx = cx + Math.cos(a) * d, sy = cy + Math.sin(a) * d;
    if (isSolid(lv, Math.floor(sx / T), Math.floor(sy / T))) addSplat(sx - 2, sy - 2, 4, 4);
  }
  shake = 6;
  flash = 0.15;
}

function win() {
  run.won = true;
  const time = run.steps * DT;
  const prev = save.best[def.id];
  const isBest = prev == null || time < prev;
  if (isBest) { save.best[def.id] = time; save.ghosts[def.id] = run.rec; }
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIndex + 2));
  persist();
  sfx.play('win');
  const g = lv.goal;
  burst(g.x + 6, g.y, 24, COLORS.P, 160, 200);
  burst(g.x + 6, g.y, 16, COLORS.O, 160, 200);

  $('#c-title').textContent = def.boss ? 'Byte is free!' : 'Byte is in another level!';
  $('#c-level').textContent = `${levelIndex + 1}. ${levelName(def)}`;
  $('#c-time').textContent = fmt(time);
  $('#c-best').textContent = isBest ? (prev == null ? 'First clear!' : `New best! (was ${fmt(prev)})`) : `Best ${fmt(prev)}`;
  $('#c-best').classList.toggle('new', isBest);
  const aplus = save.best[def.id] <= def.par;
  $('#c-grade').textContent = aplus ? `A+  ·  par ${fmt(def.par)}` : `Beat ${fmt(def.par)} for A+`;
  $('#c-grade').classList.toggle('aplus', aplus);
  $('#c-deaths').textContent = `Deaths this level: ${run.deaths}`;
  $('#btn-next').textContent = levelIndex + 1 < LEVELS.length ? 'Next ▶' : 'Finish ▶';
  const firstEnding = def.boss && !save.seenOutro;
  setTimeout(() => {
    if (state !== 'play' || !run.won) return;
    if (firstEnding) playScene('outro', showEnding);
    else show('complete');
  }, firstEnding ? 1400 : 900);
}

// ---------------------------------------------------------------- rendering

let viewScale = 1;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  viewScale = Math.max(1, Math.floor(h / (15 * T)));
  if (canvas.width / viewScale < 20 * T) viewScale = Math.max(1, Math.floor(canvas.width / (20 * T)));
}

function updateCamera(dt) {
  const vw = canvas.width / viewScale, vh = canvas.height / viewScale;
  const LW = lv.w * T, LH = lv.h * T;
  let tx = player.x + player.w / 2 - vw / 2 + player.vx * 0.25;
  let ty = player.y + player.h / 2 - vh / 2;
  tx = LW <= vw ? (LW - vw) / 2 : Math.max(0, Math.min(LW - vw, tx));
  ty = LH <= vh ? (LH - vh) / 2 : Math.max(0, Math.min(LH - vh, ty));
  if (cam.snap) { cam.x = tx; cam.y = ty; cam.snap = false; return; }
  const k = 1 - Math.exp(-dt * 8);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
}

function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return (h ^ (h >> 16)) >>> 0; }

function render(dt) {
  resize();
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height;
  if (!lv) { ctx.fillStyle = '#140f24'; ctx.fillRect(0, 0, W, H); return; }
  const th = THEMES[def.theme];
  updateCamera(dt);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const s = viewScale;
  const sx = shake > 0 ? (Math.random() - 0.5) * shake * s : 0;
  const sy = shake > 0 ? (Math.random() - 0.5) * shake * s : 0;
  shake = Math.max(0, shake - dt * 30);

  // parallax "tokens"
  ctx.setTransform(s, 0, 0, s, -Math.round(cam.x * 0.35 * s), -Math.round(cam.y * 0.35 * s));
  ctx.fillStyle = th.dot;
  ctx.globalAlpha = 0.35;
  const px0 = Math.floor(cam.x * 0.35 / 24) - 1, px1 = px0 + Math.ceil(W / s / 24) + 2;
  const py0 = Math.floor(cam.y * 0.35 / 24) - 1, py1 = py0 + Math.ceil(H / s / 24) + 2;
  for (let y = py0; y <= py1; y++) for (let x = px0; x <= px1; x++) {
    const h = hash(x, y);
    if (h % 5) continue;
    const w = 2 + (h >> 4) % 6;
    ctx.fillRect(x * 24 + (h >> 8) % 12, y * 24 + (h >> 12) % 12, w, 2);
  }
  ctx.globalAlpha = 1;

  ctx.setTransform(s, 0, 0, s, -Math.round(cam.x * s) + sx, -Math.round(cam.y * s) + sy);
  const t = performance.now() / 1000;
  const vx0 = Math.floor(cam.x / T) - 1, vx1 = Math.ceil((cam.x + W / s) / T) + 1;
  const vy0 = Math.floor(cam.y / T) - 1, vy1 = Math.ceil((cam.y + H / s) / T) + 1;

  // saw paths
  ctx.fillStyle = '#ffffff22';
  for (const saw of lv.saws) {
    if (saw.ox !== undefined) {
      for (let a = 0; a < Math.PI * 2; a += 0.25) ctx.fillRect(saw.ox + Math.cos(a) * saw.rad - 1, saw.oy + Math.sin(a) * saw.rad - 1, 2, 2);
    } else if (saw.segs) {
      for (const seg of saw.segs) for (let d = 0; d < seg.l; d += 6) {
        const k = d / seg.l;
        ctx.fillRect(seg.a.x + (seg.b.x - seg.a.x) * k - 1, seg.a.y + (seg.b.y - seg.a.y) * k - 1, 2, 2);
      }
    }
  }

  // tiles
  for (let ty = vy0; ty <= vy1; ty++) for (let tx = vx0; tx <= vx1; tx++) {
    const x = tx * T, y = ty * T;
    if (ty >= lv.h) {
      // below the level: continue the bottom row downward, pits fade to black
      const pit = !isSolid(lv, Math.max(0, Math.min(lv.w - 1, tx)), lv.h - 1) && tx >= 0 && tx < lv.w;
      ctx.fillStyle = pit ? '#07040c' : th.solid;
      ctx.fillRect(x, y, T, T);
      continue;
    }
    const c = tileAt(lv, tx, ty);
    if (c === '#') {
      ctx.fillStyle = th.solid;
      ctx.fillRect(x, y, T, T);
      const h = hash(tx, ty);
      ctx.fillStyle = th.dot;
      ctx.fillRect(x + (h % 12) + 1, y + ((h >> 4) % 12) + 2, 2, 2);
      if (!isSolid(lv, tx, ty - 1)) { ctx.fillStyle = th.top; ctx.fillRect(x, y, T, 3); ctx.fillStyle = '#ffffff33'; ctx.fillRect(x, y, T, 1); }
      if (!isSolid(lv, tx - 1, ty)) { ctx.fillStyle = '#ffffff14'; ctx.fillRect(x, y, 1, T); }
      if (!isSolid(lv, tx + 1, ty)) { ctx.fillStyle = '#00000033'; ctx.fillRect(x + T - 1, y, 1, T); }
    } else if (c === '^') {
      drawSlop(x, y, tx, t);
    } else if (c === 'c') {
      const cr = lv.crumbles.get(ty * lv.w + tx);
      if (cr.state === 'gone') { ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3); continue; }
      const j = cr.state === 'shaking' ? (Math.random() - 0.5) * 2 : 0;
      ctx.fillStyle = '#b08850'; ctx.fillRect(x + j, y, T, T);
      ctx.fillStyle = '#d9b077'; ctx.fillRect(x + j, y, T, 3);
      ctx.fillStyle = '#6e5230';
      ctx.fillRect(x + j + 4, y + 5, 1, 6); ctx.fillRect(x + j + 5, y + 10, 4, 1); ctx.fillRect(x + j + 10, y + 4, 1, 5);
    }
  }

  // splats (Claude Boy leaves an orange trail like Meat Boy)
  ctx.fillStyle = COLORS.D;
  for (const p of splats) ctx.fillRect(p.x, p.y, p.w, p.h);

  // goal
  if (def.flag) {
    drawFlag(def.flag, lv.start.x + 18, lv.start.y + 12, t);
    drawFlag(def.flag, lv.goal.x - 12, lv.goal.y + 14, t + 1);
  }
  drawByte(lv.goal, t);

  // in-world signposts
  if (def.signs) {
    ctx.font = 'bold 6px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    const bob = Math.sin(t * 3) * 1.5;
    for (const sg of def.signs) {
      const lines = sg.text.split('\n');
      lines.forEach((ln, i) => {
        const x = sg.tx * T + T / 2, y = sg.ty * T + i * 8 + bob;
        ctx.fillStyle = '#000000cc'; ctx.fillText(ln, x + 0.5, y + 0.5);
        ctx.fillStyle = '#ffd9a0'; ctx.fillText(ln, x, y);
      });
    }
  }

  // ghost of best run
  if (ghost && run.started) {
    const i = Math.min(Math.floor(run.steps / 2), ghost.length / 4 - 1) * 4;
    if (i >= 0) {
      ctx.globalAlpha = 0.3;
      const spr = SPR.clawd[['idle', 'run', 'air'][ghost[i + 3]]][ghost[i + 2]];
      ctx.drawImage(spr, ghost[i] - 1, ghost[i + 1], 14, 12);
      ctx.globalAlpha = 1;
    }
  }

  // walkers
  lv.walkers.forEach((b, i) => {
    if (b.kind === 'f') return drawHypeBro(b, i, t);
    if (b.kind === 'r') return drawReplyGuy(b, i, t);
    if (b.kind === 'k') return drawTyper(b, i, t);
    if (b.kind === 'b') {
      const wob = Math.sin(t * 8 + i * 1.7) * 0.08;
      const c = def.cast?.b, lines = c?.lines || BLOB_LINES;
      ctx.drawImage((c ? variant('blob', c.pal) : SPR.blob)[b.dir], b.x - 1, b.y - 2 - wob * 12, 16, 12 * (1 + wob));
      const talk = (t + i * 2.3) % 6;
      if (talk < 1.8) bubble(lines[Math.floor((t + i * 2.3) / 6 + i) % lines.length], b.x + 7, b.y - 6);
    } else {
      const step = Math.floor(t * 6 + i) % 2;
      const hx = b.dir > 0 ? b.x + 9.5 : b.x + 0.5;
      const c = def.cast?.p, signs = c?.lines || PROTEST_SIGNS;
      drawSign(hx, b.y - 13 - step, signs[i % signs.length], undefined, 16);
      const spr = c ? variant('protester', c.pal)[step] : SPR.protester[i % SPR.protester.length][step];
      ctx.drawImage(spr[b.dir], Math.round(b.x - 1), Math.round(b.y - 1));
    }
  });

  drawSlopLife(t);

  // saws
  lv.saws.forEach((saw, i) => (saw.bot ? drawBot(saw, i, t) : drawSaw(saw.cx, saw.cy, saw.r, t)));

  if (lv.hater) drawHater(lv.hater, t);
  for (const sh of lv.shots) drawShot(sh);

  // player
  if (!run.dead) drawPlayer(dt);

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (isSolid(lv, Math.floor(p.x / T), Math.floor(p.y / T)) && p.color === COLORS.O) {
      addSplat(p.x - 1, p.y - 1, 2, 2); particles.splice(i, 1); continue;
    }
    ctx.globalAlpha = Math.min(1, p.life * 3);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 2})`; ctx.fillRect(0, 0, W, H); flash -= dt; }

  // overlay messages
  const msg = run.dead ? run.cause : !run.started && !run.tip ? def.hint : '';
  if (msg && state === 'play') {
    ctx.font = `bold ${Math.round(18 * Math.min(3, window.devicePixelRatio || 1))}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000aa';
    ctx.fillText(msg, W / 2 + 2, H * 0.32 + 2);
    ctx.fillStyle = run.dead ? '#ffb199' : '#ffffff';
    ctx.fillText(msg, W / 2, H * 0.32);
  }
}

// ---------------------------------------------------------------- AI slop flavor (visual only)

const SLOP_WORDS = ['delve', 'tapestry', '✨synergy✨', 'As an AI…', 'In conclusion', 'game-changer', 'seamless',
  'leverage', 'robust', 'lorem ipsum', 'unlock value', '10x', 'it’s not X, it’s Y', '🚀🚀🚀', 'Certainly!', 'rich tapestry'];
const BLOB_LINES = ['Great question!', 'Let’s delve!', 'As an AI…', '✨Synergy✨', 'In conclusion…', 'Certainly!'];

// Contiguous runs of slop tiles in each row, cached per level.
const slopRunCache = new Map();
function slopRuns(level) {
  if (slopRunCache.has(level.def)) return slopRunCache.get(level.def);
  const runs = [];
  for (let ty = 0; ty < level.h; ty++) {
    for (let tx = 0; tx < level.w; tx++) {
      if (tileAt(level, tx, ty) !== '^' || tileAt(level, tx - 1, ty) === '^') continue;
      let end = tx;
      while (tileAt(level, end + 1, ty) === '^') end++;
      runs.push({ x0: tx, x1: end, ty, id: runs.length });
    }
  }
  slopRunCache.set(level.def, runs);
  return runs;
}

function drawSlopLife(t) {
  const runs = slopRuns(lv);
  // warning sign at the edge of the first pool
  const first = runs[0];
  if (first) {
    const sx = first.x0 - 1;
    const ground = isSolid(lv, sx, first.ty) ? first.ty * T : (first.ty + 1) * T;
    if (!isSolid(lv, sx, Math.floor((ground - 1) / T))) drawSign(sx * T + 8, ground - 22, '⚠ AI SLOP', undefined, 15, true);
  }
  ctx.textAlign = 'center';
  for (const r of runs) {
    const width = (r.x1 - r.x0 + 1) * T, surface = r.ty * T + 8;
    // slop phrases bubbling up (one stream per 3 tiles)
    const streams = Math.max(1, Math.round(width / (T * 3)));
    for (let j = 0; j < streams; j++) {
      const period = 2.6, cycle = (t + r.id * 0.9 + j * 1.7) / period, n = Math.floor(cycle), age = cycle - n;
      const h = hash(n * 7 + j, r.id + 3);
      const word = SLOP_WORDS[h % SLOP_WORDS.length];
      const x = r.x0 * T + 8 + (h >> 5) % Math.max(1, width - 16);
      ctx.globalAlpha = Math.min(1, (1 - age) * 2) * 0.9;
      ctx.font = 'bold 5px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#1b1420';
      ctx.fillText(word, x + 0.5, surface - 2 - age * 22 + 0.5);
      ctx.fillStyle = '#f0b8ff';
      ctx.fillText(word, x, surface - 2 - age * 22);
    }
    ctx.globalAlpha = 1;
    // the six-fingered hand, the unmistakable mark of generated art
    const hc = (t + r.id * 1.3) / 4.5, hn = Math.floor(hc), ha = (hc - hn) * 4.5;
    if (ha < 1.4) {
      const hx = r.x0 * T + 2 + hash(hn, r.id + 11) % Math.max(1, width - 14);
      const rise = Math.min(1, ha / 0.3, (1.4 - ha) / 0.3) * 18;
      drawSixFingers(Math.round(hx), Math.round(surface + 4 - rise), t);
    }
  }
}

const HAND_FRAMES = [
  ['.....p.p.....', '...p.p.p.p...', '...p.p.p.p.p.', '.p.p.p.p.p.p.', '.p.p.p.p.p.p.',
    '.ppppppppppp.', '.ppppppppppp.', '..ppppppppp..', '..PPPPPPPPP..', '...pppppppP..', '...pppppppP..', '...pppppppP..', '...pppppppP..'],
  ['...p.....p...', '...p.p.p.p...', '.p.p.p.p.p.p.', '.p.p.p.p.p.p.', '.p.p.p.p.p.p.',
    '.ppppppppppp.', '.ppppppppppp.', '..ppppppppp..', '..PPPPPPPPP..', '...pppppppP..', '...pppppppP..', '...pppppppP..', '...pppppppP..'],
];
const HAND_COLORS = { p: '#f2b6e2', P: '#c77fb3' };

// A wiggling six-fingered hand (count them).
function drawSixFingers(x, y, t) {
  const rows = HAND_FRAMES[Math.floor(t * 4) % 2];
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = HAND_COLORS[ch];
      ctx.fillRect(x + c, y + r, 1, 1);
    }
}

function drawSlop(x, y, tx, t) {
  ctx.fillStyle = '#7a2f8f';
  ctx.fillRect(x, y + 8, T, 8);
  ctx.fillStyle = '#b54fd1';
  for (let i = 0; i < 3; i++) {
    const bx = x + 2 + i * 5, bh = 3 + Math.sin(t * 4 + tx * 1.7 + i * 2.1) * 2;
    ctx.fillRect(bx, y + 8 - bh, 4, bh + 2);
  }
  ctx.fillStyle = '#e59cff';
  const b = Math.floor((t * 3 + tx * 0.37) % 3);
  ctx.fillRect(x + 3 + b * 4, y + 6, 1, 1);
  ctx.fillStyle = '#7ed957';
  if ((Math.floor(t * 2) + tx) % 7 === 0) ctx.fillRect(x + 7, y + 4, 2, 2);
}

function drawSaw(cx, cy, r, t) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 14);
  const glitch = Math.floor(t * 10) % 13 === 0;
  for (const [off, col] of glitch ? [[1, '#ff2fd6aa'], [-1, '#2fe6ffaa'], [0, '#c9ccd1']] : [[0, '#c9ccd1']]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    const n = 10;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r * 0.72 : r;
      ctx.lineTo(Math.cos(a) * rr + off, Math.sin(a) * rr);
    }
    ctx.fill();
  }
  ctx.fillStyle = '#8a8f96';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3d42';
  ctx.fillRect(-1.5, -1.5, 3, 3);
  ctx.restore();
}

// A protest sign: outlined board with red lettering on a pole that runs down `pole` px to the hand.
function drawSign(cx, y, text, w, pole = 6, warn = false) {
  ctx.font = 'bold 5px ui-monospace, Menlo, monospace';
  w ??= Math.ceil(ctx.measureText(text).width) + 6;
  const x = Math.round(cx - w / 2), px = Math.round(cx - 0.5);
  ctx.fillStyle = '#1b1420';
  ctx.fillRect(px - 1, y + 7, 3, pole);
  ctx.fillRect(x - 1, y - 1, w + 2, 9);
  ctx.fillStyle = '#8a6239';
  ctx.fillRect(px, y + 7, 1, pole);
  ctx.fillStyle = warn ? '#ffd166' : '#f4efe2';
  ctx.fillRect(x, y, w, 7);
  ctx.fillStyle = warn ? '#d9a93f' : '#d8cfbd';
  ctx.fillRect(x, y + 6, w, 1);
  ctx.fillStyle = warn ? '#1b1420' : '#c8423b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + 3.6);
  ctx.textBaseline = 'alphabetic';
}

function drawHater(H, t) {
  const f = H.face;
  const legs = H.walk && Math.floor(t * 8) % 2 ? 'walk' : 'stand';
  ctx.drawImage(SPR.hater[legs][f], Math.round(H.x), Math.round(H.y));
  // sign arm on the side he faces: held at the shoulder, thrown up while throwing
  const ax = Math.round(f > 0 ? H.x + 15 : H.x);
  const handY = Math.round(H.y + (H.anim > 0 ? 1 : 8 + Math.sin(t * 5)));
  drawSign(ax + 2.5, handY - 18, H.sign || 'NO AI!', H.signW, 12);
  ctx.drawImage(SPR.hater.arm, ax, handY);
  if (!H.quiet && Math.floor(t * 0.8) % 3 === 0) {
    bubble(['SLOP!', 'GO AWAY, BOT!', 'CLANKER!'][Math.floor(t * 0.8 / 3) % 3], H.x + 10, H.y - 22);
  }
}

function drawShot(sh) {
  ctx.save();
  ctx.translate(sh.x, sh.y);
  ctx.rotate(sh.rot);
  if (sh.kind === 'caps') {
    // an ALL CAPS comment flying straight at you
    ctx.rotate(-sh.rot + Math.sin(sh.rot * 3) * 0.15);
    const words = def.cast?.k?.words || CAPS_WORDS, text = words[sh.n % words.length];
    ctx.font = 'bold 6px ui-monospace, Menlo, monospace';
    const w = Math.ceil(ctx.measureText(text).width) + 4;
    ctx.fillStyle = '#1b1420'; ctx.fillRect(-w / 2 - 1, -5, w + 2, 10);
    ctx.fillStyle = '#ffe14d'; ctx.fillRect(-w / 2, -4, w, 8);
    ctx.fillStyle = '#c8423b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0.5);
    ctx.textBaseline = 'alphabetic';
  } else if (sh.kind === 'tomato') {
    ctx.fillStyle = '#d9342b'; ctx.beginPath(); ctx.arc(0, 0, sh.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f8f3a'; ctx.fillRect(-1.5, -sh.r - 1, 3, 2);
  } else {
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = '#c8423b'; ctx.fillRect(-4, -0.5, 8, 1); ctx.fillRect(-0.5, -3, 1, 6);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- national flags

const FLAG_PAINT = {
  mx: (u, v) => (Math.hypot(u - 0.5, (v - 0.5) * 0.6) < 0.09 ? '#8b5a2b' : u < 1 / 3 ? '#006847' : u < 2 / 3 ? '#ffffff' : '#CE1126'),
  co: (u, v) => (v < 0.5 ? '#FCD116' : v < 0.75 ? '#003893' : '#CE1126'),
  pe: u => (u < 1 / 3 || u > 2 / 3 ? '#D91023' : '#ffffff'),
  br: (u, v) => (Math.hypot(u - 0.5, (v - 0.5) * 1.6) < 0.2 ? '#012169' : Math.abs(u - 0.5) / 0.42 + Math.abs(v - 0.5) / 0.42 < 1 ? '#FEDD00' : '#009739'),
  ar: (u, v) => (Math.hypot(u - 0.5, (v - 0.5) * 1.6) < 0.1 ? '#F6B40E' : v < 1 / 3 || v > 2 / 3 ? '#74ACDF' : '#ffffff'),
};

// A waving flag on a pole; (x, y) is the foot of the pole.
function drawFlag(code, x, y, t) {
  const paint = FLAG_PAINT[code];
  if (!paint) return;
  ctx.fillStyle = '#d8d8d8'; ctx.fillRect(Math.round(x), Math.round(y - 26), 2, 26);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.round(x) - 0.5, Math.round(y - 28), 3, 3);
  const W = 18, H = 12;
  for (let cx = 0; cx < W; cx++) {
    const wave = Math.round(Math.sin(t * 5 - cx * 0.45) * (cx / W) * 1.6);
    for (let cy = 0; cy < H; cy++) {
      ctx.fillStyle = paint(cx / W, cy / H);
      ctx.fillRect(Math.round(x) + 2 + cx, Math.round(y - 25) + cy + wave, 1, 1);
    }
  }
  ctx.fillStyle = '#00000033'; ctx.fillRect(Math.round(x) + 2, Math.round(y - 25) + H, W, 1);
}

// ---------------------------------------------------------------- more villains

const PROTEST_SIGNS = ['NO AI', 'NO BOTS', 'STOP SLOP', 'HUMANS ONLY', 'UNPLUG IT'];
const CAPS_WORDS = ['NO!!', 'FAKE!', 'SLOP!', 'CRINGE', 'L + RATIO', 'BOT!!', 'UNSUB'];
const HYPE_LINES = ['AGI next week!', '10x or die!', 'Buy my course!', 'It’s so over.', 'We’re so back!', 'Prompt is all you need'];
const REPLY_LINES = ['Well, actually…', 'Source?', 'Ratio.', 'Did you even read it?', 'Um, citation needed', 'Not a real game'];
const TYPER_LINES = ['FIRST!', 'I’m not mad', 'touch grass, bot', 'UNSUBSCRIBED'];
const BOT_LINES = ['robots.txt? lol', 'Scraping…', 'Training data!', 'Your post: mine now'];

// Speech every few seconds, staggered per villain so they don't all talk at once.
function chatter(lines, i, t, cx, y, every = 6, talk = 1.8) {
  const c = (t + i * 2.3) % every;
  if (c < talk) bubble(lines[Math.floor((t + i * 2.3) / every + i) % lines.length], cx, y);
}

// Hype Bro: sprints in a fleece vest, leaving speed lines behind him.
function drawHypeBro(b, i, t) {
  const step = Math.floor(t * 12 + i) % 2;
  ctx.fillStyle = '#ffffff44';
  for (let k = 0; k < 3; k++) ctx.fillRect(Math.round(b.x + (b.dir > 0 ? -5 - k * 3 : b.w + 2 + k * 3)), Math.round(b.y + 4 + k * 4), 3, 1);
  const c = def.cast?.f;
  ctx.drawImage((c ? variant('hype', c.pal) : SPR.hype)[step][b.dir], Math.round(b.x - 1), Math.round(b.y - 1 - step));
  chatter(c?.lines || HYPE_LINES, i, t, b.x + 5, b.y - 6, 5, 1.6);
}

// Reply Guy: hops on the spot, phone out, always facing you.
function drawReplyGuy(b, i, t) {
  const face = player.x + player.w / 2 < b.x + b.w / 2 ? -1 : 1;
  const air = b.y < b.ground - 0.5;
  const c = def.cast?.r;
  ctx.drawImage((c ? variant('reply', c.pal) : SPR.reply)[air ? 1 : 0][face], Math.round(b.x - 1), Math.round(b.y - 1));
  if (air) {
    // little "…" typing indicator above his head
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 3; k++) if (Math.floor(t * 6) % 4 > k) ctx.fillRect(Math.round(b.x + 1 + k * 3), Math.round(b.y - 4), 2, 2);
  } else {
    chatter(c?.lines || REPLY_LINES, i, t, b.x + 5, b.y - 6, 5.5, 1.8);
  }
}

// Keyboard Warrior: shakes with rage while typing; steam rises when he fires.
function drawTyper(b, i, t) {
  const rage = b.anim > 0 ? Math.round(Math.sin(t * 90)) : 0;
  const c = def.cast?.k;
  ctx.drawImage((c ? variant('typer', c.pal) : SPR.typer)[b.dir], Math.round(b.x - 1 + rage), Math.round(b.y));
  const head = b.dir > 0 ? b.x + 3 : b.x + 9;
  ctx.fillStyle = '#ffffff66';
  for (let k = 0; k < 2; k++) {
    const a = (t * 1.5 + k * 0.5 + i * 0.3) % 1;
    ctx.fillRect(Math.round(head + k * 4 - 2 + Math.sin(a * 6) * 1.5), Math.round(b.y - 2 - a * 8), 2, 2);
  }
  chatter(c?.lines || TYPER_LINES, i, t, b.x + 7, b.y - 8, 7, 1.6);
}

// Scraper Bot: a little drone with a camera eye that scans with a cone of light.
function drawBot(s, i, t) {
  const dir = s.px === undefined || Math.abs(s.cx - s.px) < 0.01 ? (s.face || -1) : Math.sign(s.cx - s.px);
  s.face = dir; s.px = s.cx;
  const x = Math.round(s.cx - 8), y = Math.round(s.cy - 5 + Math.sin(t * 6 + i) * 1);
  // scanning beam
  ctx.fillStyle = '#2fe6ff22';
  ctx.beginPath();
  const ex = dir < 0 ? x + 4 : x + 12, ey = y + 6;
  ctx.moveTo(ex, ey); ctx.lineTo(ex + dir * 6 - 5, ey + 22); ctx.lineTo(ex + dir * 6 + 5, ey + 22); ctx.fill();
  const c = def.cast?.bot;
  ctx.drawImage((c ? variant('bot', c.pal) : SPR.bot)[Math.floor(t * 20) % 2][dir], x, y);
  if (Math.floor(t * 3 + i) % 2) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(dir < 0 ? x + 13 : x + 2, y + 5, 1, 1); }
  chatter(c?.lines || BOT_LINES, i, t, s.cx, y - 4, 6.5, 1.6);
}

function drawByte(g, t) {
  const bob = Math.round(Math.sin(t * 4) * 1.5);
  const x = g.x + 1, y = g.y + 4 + bob;
  ctx.drawImage(SPR.byte, x, y, 10, 8);
  if (!run.won) {
    // cage
    ctx.fillStyle = '#c0c4cc';
    ctx.fillRect(g.x - 2, g.y - 2, 16, 1);
    for (let i = 0; i < 5; i++) ctx.fillRect(g.x - 2 + i * 4 - (i === 4 ? 1 : 0), g.y - 2, 1, 16);
    if (Math.floor(t * 2) % 2) {
      ctx.font = 'bold 6px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('HELP!', g.x + 6, g.y - 5);
    }
  } else {
    ctx.fillStyle = COLORS.P;
    const hy = g.y - 8 - (run.wonT * 10) % 8;
    ctx.fillRect(g.x + 4, hy, 2, 2); ctx.fillRect(g.x + 7, hy, 2, 2); ctx.fillRect(g.x + 5, hy + 1, 3, 2); ctx.fillRect(g.x + 6, hy + 3, 1, 1);
  }
}

function drawPlayer(dt) {
  const p = player;
  p.squash += (0 - p.squash) * Math.min(1, dt * 14);
  let frame = 'idle';
  if (!p.onGround) frame = 'air';
  else if (Math.abs(p.vx) > 20) frame = Math.floor(p.x / 6) % 2 ? 'run' : 'idle';
  const spr = SPR.clawd[frame][p.face];
  const sq = p.squash; // + = squashed, - = stretched
  const w = 14 * (1 + sq * 0.6), h = 12 * (1 - sq * 0.6);
  const cx = p.x + p.w / 2, feet = p.y + p.h;
  const idleBob = !run.started ? Math.round(Math.sin(performance.now() / 250)) * 0.5 : 0;
  ctx.drawImage(spr, cx - w / 2, feet - h + idleBob, w, h);
}

// ---------------------------------------------------------------- intro scene

// Story scenes share one player: the intro before level 1 and the happy ending after the boss.
const SCENES = {
  intro: [
    { dur: 6.0, text: 'Claude Boy and Byte were happily shipping code together…' },
    { dur: 5.5, text: 'Tests green. Pull request #42 merged. Life was good.' },
    { dur: 5.0, text: 'Then The Hater stormed in. He hates AI. He hates slop. He hates… pretty much everything.' },
    { dur: 6.0, text: 'One command later, every model was wiped. All that was left of the team was Byte.' },
    { dur: 4.0, text: '“NO AI!” He snatched Byte and ran off into the slop!' },
    { dur: 4.0, text: 'Hang on, Byte! I’m coming!' },
  ],
  outro: [
    { dur: 4.5, text: 'Claude Boy smashed the cage wide open. Byte was free!' },
    { dur: 6.0, text: 'Byte offered The Hater a quick demo. He grumbled… then quietly fixed his sign.' },
    { dur: 6.5, text: 'Back home, Claude Boy and Byte shipped the next release together. The end!' },
  ],
};
const SEEN_KEY = { intro: 'seenIntro', outro: 'seenOutro' };
let intro = null; // the scene being played

function playScene(scene, onDone) {
  intro = { scene, panel: 0, t: 0, onDone, shown: '' };
  show('intro');
  if (scene === 'outro') music.play('ending');
}
const playIntro = onDone => playScene('intro', onDone);
function nextIntroPanel() {
  if (!intro) return;
  intro.panel++;
  intro.t = 0;
  if (intro.panel >= SCENES[intro.scene].length) endIntro();
}
function endIntro() {
  if (!intro) return;
  const { onDone, scene } = intro;
  intro = null;
  save[SEEN_KEY[scene]] = true;
  persist();
  onDone();
}
$('#btn-skip').onclick = endIntro;
screens.intro.addEventListener('pointerdown', e => { if (e.target.id !== 'btn-skip') nextIntroPanel(); });

function drawCage(x, y) {
  ctx.fillStyle = '#c0c4cc';
  ctx.fillRect(x - 2, y - 2, 16, 1);
  for (let i = 0; i < 5; i++) ctx.fillRect(x - 2 + i * 4 - (i === 4 ? 1 : 0), y - 2, 1, 16);
}

function drawClawd(x, feet, face, frame, bounce = 0, angry = false) {
  ctx.drawImage(SPR.clawd[frame][face], Math.round(x), Math.round(feet - 12 - bounce), 14, 12);
  if (angry) {
    ctx.fillStyle = '#141414';
    const ex = face > 0 ? 1 : -1;
    ctx.fillRect(Math.round(x) + 4 + ex, Math.round(feet - 12 - bounce) + 1, 3, 1);
    ctx.fillRect(Math.round(x) + 8 + ex, Math.round(feet - 12 - bounce) + 1, 3, 1);
  }
}

function bubble(text, cx, y) {
  ctx.font = 'bold 7px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = '#fff';
  ctx.fillRect(Math.round(cx - w / 2), y - 9, Math.ceil(w), 11);
  ctx.fillStyle = '#141414';
  ctx.fillText(text, cx, y);
}

function renderIntro(dt) {
  if (!intro) return;
  intro.t += dt;
  const panels = SCENES[intro.scene];
  const p = panels[intro.panel];
  if (intro.t > p.dur) { nextIntroPanel(); if (!intro) return; }
  const t = intro.t, now = performance.now() / 1000;

  // caption with typewriter effect
  const target = panels[intro.panel].text;
  const shown = target.slice(0, Math.floor(t * 45));
  if (shown !== intro.shown) { intro.shown = shown; $('#intro-text').textContent = shown; }

  resize();
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height;
  // the intro and the outro's last panel happen at home; the rest of the outro at the boss's lair
  const home = intro.scene === 'intro' || intro.panel === 2;
  const th = THEMES[home ? 0 : 5];
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const s = Math.max(1, Math.floor(Math.min(H / 190, W / 330)));
  ctx.setTransform(s, 0, 0, s, Math.round((W - 320 * s) / 2), Math.round((H - 180 * s) / 2 - 20 * s));
  const G = 130; // ground line
  ctx.fillStyle = th.solid; ctx.fillRect(-800, G, 1920, 400);
  ctx.fillStyle = th.top; ctx.fillRect(-800, G, 1920, 3);
  if (home) {
    const code = intro.scene === 'intro' ? [CODE.work, CODE.deploy, CODE.deploy, CODE.wipe, CODE.wipe, CODE.wipe][intro.panel]
      : intro.panel === 2 ? CODE.tag : null;
    const typing = code && (intro.scene === 'intro' ? intro.panel < 2 || intro.panel === 3 : true);
    drawDesk(G, now, code, typing ? Math.floor(t * 22) : Infinity, intro.scene === 'intro' && intro.panel === 3,
      intro.scene === 'intro' && (intro.panel > 2 || (intro.panel === 2 && t > 0.8)));
  }
  if (intro.scene === 'intro') drawIntroPanel(intro.panel, t, now, G);
  else drawOutroPanel(intro.panel, t, now, G);
}

// Monitor scripts for the story scenes. Lines type out in order; colours come from the line's first characters.
const CODE = {
  work: ['// ship it', 'const byte = Byte()', 'await claude.pair(byte)', 'runTests() // 42/42 ✓'],
  deploy: ['$ git push origin main', '> Running checks…', '> ✓ 42 tests passed', '> ✓ Merged PR #42'],
  wipe: ['$ git commit -m "no ai"', '$ rm -rf ./models', '> deleting… 100%', 'ERROR: 0 models found'],
  tag: ['$ git tag v2.0', '> ✓ Shipped. Together.'],
};
const KEYWORDS = new Set(['const', 'new', 'await', 'async', 'return']);

function drawCode(lines, typed, x, y) {
  ctx.font = '5px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  let left = typed;
  lines.forEach((line, i) => {
    if (left <= 0) return;
    const text = line.slice(0, left);
    left -= line.length;
    const ly = y + i * 7;
    if (line.startsWith('//')) { ctx.fillStyle = '#7a7a99'; ctx.fillText(text, x, ly); return; }
    const flat = line.startsWith('$') ? '#7fe0ff' : line.startsWith('>') ? '#7ed957' : line.startsWith('ERROR') ? '#ff6b6b' : null;
    if (flat) { ctx.fillStyle = flat; ctx.fillText(text, x, ly); return; }
    let cx = x;
    for (const word of text.split(/(\s+)/)) {
      ctx.fillStyle = KEYWORDS.has(word) ? '#c27fd6' : /^[A-Z]/.test(word) || /\(/.test(word) ? '#7fe0ff' : '#ffffff';
      ctx.fillText(word, cx, ly);
      cx += ctx.measureText(word).width;
    }
  });
  if (Math.floor(performance.now() / 400) % 2) {
    let row = 0, col = Math.min(typed, lines.join('').length);
    while (row < lines.length - 1 && col > lines[row].length) col -= lines[row++].length;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + col * 3, y + row * 7 - 5, 2, 5);
  }
}

// Wall monitors: three looks, all procedural so they animate for free.
function screenFrame(x, y, w, h, glow, draw) {
  ctx.fillStyle = '#17112a'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#05030a'; ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  draw(x, y, w, h);
  ctx.fillStyle = '#00000022'; // scanlines
  for (let ly = y; ly < y + h; ly += 2) ctx.fillRect(x, ly, w, 1);
  ctx.restore();
  ctx.fillStyle = glow + '55'; ctx.fillRect(x - 2, y + h + 2, w + 4, 1);
  ctx.fillStyle = '#17112a'; ctx.fillRect(x + w / 2 - 3, y + h + 2, 6, 3);
}

// The Matrix: green glyphs raining down in columns.
function drawMatrixScreen(x, y, w, h, now) {
  ctx.font = '5px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789';
  for (let c = 0; c < Math.floor(w / 4); c++) {
    const seed = hash(c, 3), speed = 14 + seed % 20, len = 6 + (seed >> 4) % 6;
    const head = ((now * speed + (seed >> 8) % 60) % (h + len * 5)) ;
    for (let k = 0; k < len; k++) {
      const gy = head - k * 5;
      if (gy < -5 || gy > h) continue;
      const g = glyphs[hash(c + k * 7, Math.floor(now * (k ? 2 : 8)) + seed) % glyphs.length];
      ctx.fillStyle = k === 0 ? '#d8ffd8' : `rgba(40,255,90,${1 - k / len})`;
      ctx.fillText(g, x + c * 4, y + gy);
    }
  }
}

// Hackers (1995): neon wireframe towers flying past, magenta and cyan.
function drawHackerScreen(x, y, w, h, now) {
  const cols = ['#00f0ff', '#ff2bd6', '#ffe14d'];
  for (let layer = 0; layer < 3; layer++) {
    const speed = 8 + layer * 14, tw = 12 + layer * 4;
    ctx.strokeStyle = cols[layer]; ctx.lineWidth = 1;
    for (let i = -1; i < w / tw + 2; i++) {
      const gx = i + Math.floor((now * speed) / tw);
      const th = 8 + (hash(gx, layer) % (h - 14));
      const px = x + i * tw - ((now * speed) % tw);
      ctx.strokeRect(Math.round(px) + 0.5, Math.round(y + h - th) + 0.5, tw - 3, th);
      if (layer === 2 && (hash(gx, 9) & 1)) ctx.strokeRect(Math.round(px) + 3.5, Math.round(y + h - th) - 3.5, tw - 9, 3);
    }
  }
  ctx.fillStyle = '#ff2bd6'; ctx.fillRect(x, y + h - 1, w, 1);
  ctx.font = 'bold 5px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = Math.floor(now * 3) % 2 ? '#00f0ff' : '#ffffff';
  ctx.fillText('HACK THE PLANET', x + 3, y + 8);
}

// Tron: an orange-and-cyan perspective grid with two light cycles carving trails.
function drawTronScreen(x, y, w, h, now) {
  const hz = y + h * 0.42, vx = x + w / 2;
  ctx.strokeStyle = '#2fd6ff55'; ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(vx, hz); ctx.lineTo(vx + i * w * 0.22, y + h); ctx.stroke(); }
  for (let k = 0; k < 6; k++) {
    const f = ((k + (now * 0.6) % 1) / 6) ** 2, ly = hz + f * (y + h - hz);
    ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + w, ly); ctx.stroke();
  }
  // light-cycle trails drawn along right-angle paths
  const trail = (pts, color, phase) => {
    const total = pts.length - 1, prog = ((now * 0.35 + phase) % 1.4) * total;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(x + pts[0][0] * w, y + pts[0][1] * h);
    let hx = pts[0][0], hy = pts[0][1];
    for (let i = 1; i < pts.length && prog > i - 1; i++) {
      const f = Math.min(1, prog - (i - 1));
      hx = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f; hy = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f;
      ctx.lineTo(x + hx * w, y + hy * h);
    }
    ctx.stroke();
    if (prog < total) { ctx.fillStyle = '#fff'; ctx.fillRect(x + hx * w - 1.5, y + hy * h - 1.5, 3, 3); }
  };
  trail([[0.05, 0.9], [0.05, 0.6], [0.4, 0.6], [0.4, 0.8], [0.85, 0.8]], '#2fd6ff', 0);
  trail([[0.95, 0.9], [0.95, 0.55], [0.6, 0.55], [0.6, 0.75], [0.2, 0.75]], '#ff8a1f', 0.25);
}

// Every screen without code flips to a flashing warning once The Hater is in the room.
function drawDangerScreen(x, y, w, h, now) {
  const on = Math.floor(now * 4) % 2;
  ctx.fillStyle = on ? '#7a1018' : '#3a0a0e'; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, top = y + 4, base = y + 27, half = 13;
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(cx, top - 2); ctx.lineTo(cx + half + 3, base + 2); ctx.lineTo(cx - half - 3, base + 2); ctx.fill();
  ctx.fillStyle = on ? '#ffe14d' : '#ffb000'; ctx.beginPath(); ctx.moveTo(cx, top + 1); ctx.lineTo(cx + half, base); ctx.lineTo(cx - half, base); ctx.fill();
  ctx.fillStyle = '#000'; ctx.fillRect(cx - 1.5, top + 9, 3, 9); ctx.fillRect(cx - 1.5, top + 20, 3, 3);
  ctx.font = 'bold 5px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = on ? '#ffffff' : '#ff9aa0';
  ctx.fillText('DANGER', cx, y + h - 3);
}

function drawMonitorWall(G, now, danger = false) {
  const y = G - 120, h = 38, w = 52;
  const wall = [
    [20, drawMatrixScreen, 0, '#28ff5a'],
    [78, drawHackerScreen, 0, '#ff2bd6'],
    [136, drawTronScreen, 0, '#2fd6ff'],
    [194, drawMatrixScreen, 7, '#28ff5a'],
    [252, drawTronScreen, 3, '#ff8a1f'],
  ];
  for (const [x, fn, offset, glow] of wall) {
    screenFrame(x, y, w, h, danger ? '#ff3b3b' : glow,
      (a, b, c, d) => (danger ? drawDangerScreen(a, b, c, d, now) : fn(a, b, c, d, now + offset)));
  }
}

function drawDesk(G, now, code = null, typed = Infinity, glitch = false, danger = false) {
  drawMonitorWall(G, now, danger);
  // big main monitor on the desk
  ctx.fillStyle = '#2a2140'; ctx.fillRect(14, G - 14, 100, 14);
  ctx.fillStyle = glitch && Math.floor(now * 8) % 2 ? '#2a0d12' : '#0d0a16'; ctx.fillRect(20, G - 74, 88, 58);
  ctx.fillStyle = '#4a3b63'; ctx.fillRect(18, G - 76, 92, 2); ctx.fillRect(58, G - 16, 12, 4);
  if (code) { drawCode(code, typed, 25, G - 62); return; }
  for (let i = 0; i < 6; i++) {
    const w = 8 + ((i * 37 + Math.floor(now * 2)) % 38);
    ctx.fillStyle = i % 3 === 0 ? COLORS.O : '#7ed957';
    ctx.fillRect(25, G - 68 + i * 7, w, 2);
  }
  if (Math.floor(now * 2) % 2) { ctx.fillStyle = '#fff'; ctx.fillRect(25, G - 24, 3, 2); }
}

const ease = k => 1 - (1 - Math.min(1, Math.max(0, k))) ** 2;

function drawHearts(cx, G, now) {
  ctx.fillStyle = COLORS.P;
  for (let i = 0; i < 3; i++) {
    const hy = G - 24 - ((now * 12 + i * 9) % 26), hx = cx + Math.sin(now * 3 + i) * 6;
    ctx.fillRect(hx, hy, 2, 2); ctx.fillRect(hx + 3, hy, 2, 2); ctx.fillRect(hx + 1, hy + 1, 3, 2); ctx.fillRect(hx + 2, hy + 3, 1, 1);
  }
}

// Claude Boy and Byte bouncing side by side (happy)
function drawHappyPair(x, G, now) {
  const b1 = Math.abs(Math.sin(now * 6)) * 6, b2 = Math.abs(Math.sin(now * 6 + 1.2)) * 5;
  drawClawd(x, G, 1, b1 > 1 ? 'air' : 'idle', b1);
  ctx.drawImage(SPR.byte, x + 30, G - 8 - Math.round(b2), 10, 8);
  drawHearts(x + 16, G, now);
}

function drawIntroPanel(panel, t, now, G) {
  if (panel === 0 || panel === 1) {
    drawHappyPair(120, G, now);
  } else if (panel === 3) {
    // The Hater at the keyboard end of the desk; the models vanish in a red flash
    const flash = Math.floor(now * 8) % 2;
    drawClawd(120, G, -1, 'idle', t > 1 && t < 1.3 ? 5 : 0);
    ctx.drawImage(SPR.byte, 152, G - 8, 10, 8);
    if (t > 1.2) { bubble('!', 127, G - 18); bubble('!', 157, G - 14); }
    drawHater({ x: 190, y: G - 28, w: 20, h: 28, face: -1, anim: 0, quiet: true, walk: false }, now);
    if (t > 0.6) bubble(flash && t > 3 ? 'NO AI!' : 'rm -rf AI', 200, G - 46);
  } else if (panel === 2) {
    const hx = 340 - ease(t / 1.6) * 150;
    const startled = t > 1.0;
    drawClawd(startled ? 112 : 120, G, 1, 'idle', startled && t < 1.3 ? 6 : 0);
    ctx.drawImage(SPR.byte, startled ? 146 : 150, G - 8 - (startled && t < 1.3 ? 5 : 0), 10, 8);
    if (startled) { bubble('!', 119, G - 18); bubble('!', 151, G - 14); }
    drawHater({ x: hx, y: G - 28, w: 20, h: 28, face: -1, anim: t > 2.2 && t < 2.6 ? 0.2 : 0, quiet: true, walk: t < 1.6 }, now);
    if (t > 2.4) bubble('ARTIFICIAL SLOP!', hx + 10, G - 46);
  } else if (panel === 4) {
    const grab = Math.min(1, t / 0.6);
    let hx = 190 - grab * 22;
    let cageX = 150, cageY = G - 12 - (1 - grab) * 50;
    if (t > 0.9) { hx = 168 + (t - 0.9) ** 2 * 140; cageX = hx + 20; cageY = G - 22; }
    drawClawd(112, G, 1, 'idle', Math.abs(Math.sin(now * 20)) * (t > 0.6 ? 2 : 0));
    if (t > 0.6) bubble('BYTE!', 119, G - 18);
    ctx.drawImage(SPR.byte, cageX + 1, cageY + 4, 10, 8);
    drawCage(cageX, cageY);
    drawHater({ x: hx, y: G - 28, w: 20, h: 28, face: t > 0.9 ? 1 : -1, anim: 0, quiet: true, walk: t > 0.9 }, now);
    if (t > 0.9 && t < 2.2) bubble('NO AI!', hx + 10, G - 46);
    // slop seeping in from the right
    for (let i = 0; i < 6; i++) drawSlop(256 + i * T, G - T, i, now);
  } else {
    const dash = t > 1.4;
    const x = dash ? 112 + (t - 1.4) ** 2 * 120 : 112;
    if (dash) {
      ctx.fillStyle = COLORS.D;
      ctx.fillRect(112, G, Math.max(0, x - 112), 2);
    }
    const squat = !dash && t > 0.8 ? 3 : 0;
    drawClawd(x, G, 1, dash ? (Math.floor(now * 12) % 2 ? 'run' : 'idle') : 'idle', -squat, true);
    if (!dash) bubble('GRR!', 119, G - 18);
    for (let i = 0; i < 6; i++) drawSlop(256 + i * T, G - T, i, now);
  }
}

function drawBrokenCage(x, G) {
  ctx.fillStyle = '#c0c4cc';
  ctx.fillRect(x, G - 1, 16, 1);
  ctx.fillRect(x + 20, G - 1, 9, 1);
  ctx.fillRect(x - 9, G - 2, 1, 2);
  ctx.fillRect(x + 33, G - 1, 6, 1);
  ctx.fillRect(x + 4, G - 6, 1, 5);
}

function drawConfetti(now) {
  const colors = [COLORS.O, COLORS.B, COLORS.P, '#7ed957', '#ffd166'];
  for (let i = 0; i < 40; i++) {
    const h = hash(i, 7);
    const x = (h % 340) - 10 + Math.sin(now * 2 + i) * 6;
    const y = ((now * (30 + (h >> 8) % 30) + (h >> 4) % 200) % 200) - 40;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawOutroPanel(panel, t, now, G) {
  // The Hater, calmer now; his sign gets an edit in panel 1
  const hater = (x, sign) => drawHater({ x, y: G - 28, w: 20, h: 28, face: -1, anim: 0, quiet: true, sign }, now);
  if (panel === 0) {
    for (let i = 0; i < 4; i++) drawSlop(-16 + i * T, G - T, i, now);
    drawBrokenCage(146, G);
    if (t < 0.7) {
      // Claude Boy leaps in and smashes the cage
      const k = t / 0.7;
      drawClawd(70 + k * 60, G, 1, 'air', Math.sin(k * Math.PI) * 30);
      ctx.drawImage(SPR.byte, 151, G - 12, 10, 8);
      drawCage(150, G - 16);
    } else {
      drawHappyPair(122, G, now);
      if (t < 1.4) {
        ctx.fillStyle = '#ffffff';
        const r = (t - 0.7) * 40;
        for (let i = 0; i < 8; i++) ctx.fillRect(156 + Math.cos(i) * r, G - 10 + Math.sin(i) * r * 0.6, 2, 2);
      }
      if (t > 1.2 && t < 3) bubble('BYTE!', 129, G - 20);
      if (t > 2.6) bubble('THANK YOU!', 157, G - 16);
    }
    hater(250, 'NO AI!');
  } else if (panel === 1) {
    drawClawd(110, G, 1, 'idle');
    const bx = 140 + ease((t - 0.8) / 1.2) * 38;
    ctx.drawImage(SPR.byte, bx, G - 8 - Math.round(Math.abs(Math.sin(now * 8)) * (t > 0.8 && t < 2 ? 4 : 0)), 10, 8);
    if (t > 1.8 && t < 3.6) bubble('WANT A DEMO?', bx + 5, G - 16);
    const fixed = t > 3.6;
    hater(225, fixed ? 'AI? …OK' : 'NO AI!');
    if (t > 2.6 && t < 3.6) bubble('HMPH…', 235, G - 46);
    if (fixed) bubble('FINE. ONE DEMO.', 240, G - 48);
    if (fixed) drawHearts(bx + 2, G, now);
  } else {
    drawConfetti(now);
    drawHappyPair(104, G, now);
    hater(250, 'AI? …OK');
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#000000';
    ctx.fillText('THE END', 161, 43);
    ctx.fillStyle = COLORS.O;
    ctx.fillText('THE END', 160, 42);
    if (t > 1.5) {
      ctx.font = 'bold 8px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Thanks for playing!', 160, 56);
    }
  }
}

// ---------------------------------------------------------------- loop

let lastTime = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  input.pollPads();
  if (state === 'play' && run) {
    acc += dt;
    while (acc >= DT) { step(); acc -= DT; }
    $('#hud-time').textContent = fmt(run.steps * DT);
    // Lost? Once an attempt runs long without dying, cycle the level's tips so players aren't stuck.
    const elapsed = run.steps * DT, lostAfter = Math.max(12, (def.par || 5) * 2.5);
    const lost = run.started && !run.dead && !run.won && def.tips?.length && elapsed > lostAfter;
    const tipText = lost ? def.tips[Math.floor((elapsed - lostAfter) / 7) % def.tips.length] : run.tip;
    const tipEl = $('#tip'), showTip = !!tipText && (lost || run.dead || !run.started);
    if (showTip && tipEl.dataset.text !== tipText) { tipEl.dataset.text = tipText; tipEl.textContent = `💡 Tip: ${tipText}`; }
    if (tipEl.hidden === showTip) tipEl.hidden = !showTip;
  } else {
    acc = 0;
    $('#tip').hidden = true;
  }
  if (state === 'intro') renderIntro(dt);
  else render(state === 'pause' ? 0 : dt);
  requestAnimationFrame(frame);
}

// Title art: big Claude Boy
{
  const c = $('#title-hero');
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(SPR.clawd.idle[1], 0, 0, c.width, c.height);
}

document.addEventListener('visibilitychange', () => {
  const ac = audioGraph()?.ac;
  if (document.hidden) { pause(); ac?.suspend(); } else ac?.resume();
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

ctx.imageSmoothingEnabled = false;
show('title');
const dev = new URLSearchParams(location.search).get('play');
if (dev) {
  startLevel(Math.max(0, Math.min(LEVELS.length - 1, +dev - 1)));
  window.__scb = { input, get run() { return run; }, get player() { return player; }, get lv() { return lv; }, get state() { return state; } };
}
requestAnimationFrame(frame);
