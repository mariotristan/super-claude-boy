import { T, DT, parseLevel, newPlayer, stepPlayer, updateWorld, checkDeath, touchesGoal, tileAt, isSolid } from './physics.js';
import { LEVELS } from './levels.js';
import { makeSprites, COLORS } from './sprites.js';
import { sfx } from './audio.js';
import { Input } from './input.js';

const $ = s => document.querySelector(s);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const SPR = makeSprites();

const THEMES = [
  { sky: ['#1b1530', '#3a2350'], solid: '#4a3b63', top: '#8d7bb5', dot: '#5c4c78' },
  { sky: ['#0f1f2e', '#1f3d52'], solid: '#2e4a5e', top: '#6fa3bf', dot: '#3b5b70' },
  { sky: ['#1a1f12', '#33401f'], solid: '#4b4632', top: '#a39a6a', dot: '#5c573f' },
  { sky: ['#24140f', '#4a2a1c'], solid: '#5a3e33', top: '#c48a6a', dot: '#6b4b3f' },
  { sky: ['#101826', '#2a2140'], solid: '#3b3552', top: '#9a8fd0', dot: '#4a4366' },
  { sky: ['#2a0d12', '#4d1a22'], solid: '#4a2a30', top: '#d0707a', dot: '#5c363d' },
];
const DEATH_LINES = {
  slop: ['Drowned in slop.', 'Too much slop.', 'Slop happens.'],
  saw: ['Hallucinated a saw.', 'Sawed in half.', 'Should have seen that.'],
  fall: ['Fell out of context.', 'Off by one.'],
  hater: ['Hated on.', '"Ban AI!"', 'Ratioed.'],
};

// ---------------------------------------------------------------- save

const SAVE_KEY = 'super-claude-boy-v1';
const save = (() => {
  const base = { best: {}, ghosts: {}, unlocked: 1, deaths: 0, muted: false };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return base; }
})();
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* storage full or private mode */ } };
sfx.muted = save.muted;

export const fmt = t => {
  if (t == null) return '--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
};

// ---------------------------------------------------------------- screens & input

const screens = { title: $('#title'), select: $('#select'), complete: $('#complete'), pause: $('#pause'), ending: $('#ending') };
const hud = $('#hud'), touchUI = $('#touch');
let state = 'title';
let focusables = [], focusIdx = 0;

const input = new Input(touchUI, { left: $('#t-left'), right: $('#t-right'), jump: $('#t-jump') });
input.onSource = () => { syncTouchUI(); paintFocus(); };

function show(name) {
  state = name;
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  hud.hidden = !(name === 'play' || name === 'pause');
  syncTouchUI();
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
  if (state === 'title' && (action === 'confirm')) return openSelect();
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
$('#btn-play').onclick = () => openSelect();
screens.title.addEventListener('pointerdown', e => { if (e.target === screens.title) openSelect(); });

// Select
function openSelect() {
  const grid = $('#level-grid');
  grid.innerHTML = '';
  LEVELS.forEach((def, i) => {
    const b = document.createElement('button');
    const locked = i >= save.unlocked;
    const best = save.best[def.id];
    b.className = 'level-card' + (locked ? ' locked' : '') + (best != null && best <= def.par ? ' aplus' : '');
    b.disabled = locked;
    b.innerHTML = `<span class="num">${i + 1}${def.boss ? ' ☠' : ''}</span><span class="name">${locked ? '???' : def.name}</span>`
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
$('#btn-next').onclick = () => (levelIndex + 1 < LEVELS.length ? startLevel(levelIndex + 1) : showEnding());
$('#btn-retry').onclick = () => startLevel(levelIndex);
$('#btn-levels').onclick = openSelect;
$('#btn-end-levels').onclick = openSelect;

function showEnding() {
  const total = LEVELS.reduce((s, d) => s + (save.best[d.id] ?? 0), 0);
  $('#end-total').textContent = `Total best: ${fmt(total)}  ·  Deaths: ${save.deaths}`;
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
  $('#hud-level').textContent = `${i + 1}. ${def.name}`;
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
  $('#c-level').textContent = `${levelIndex + 1}. ${def.name}`;
  $('#c-time').textContent = fmt(time);
  $('#c-best').textContent = isBest ? (prev == null ? 'First clear!' : `New best! (was ${fmt(prev)})`) : `Best ${fmt(prev)}`;
  $('#c-best').classList.toggle('new', isBest);
  const aplus = save.best[def.id] <= def.par;
  $('#c-grade').textContent = aplus ? `A+  ·  par ${fmt(def.par)}` : `Beat ${fmt(def.par)} for A+`;
  $('#c-grade').classList.toggle('aplus', aplus);
  $('#c-deaths').textContent = `Deaths this level: ${run.deaths}`;
  $('#btn-next').textContent = levelIndex + 1 < LEVELS.length ? 'Next ▶' : 'Finish ▶';
  setTimeout(() => { if (state === 'play' && run.won) show('complete'); }, 900);
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
  drawByte(lv.goal, t);

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
  for (const b of lv.walkers) {
    if (b.kind === 'b') {
      const wob = Math.sin(t * 8 + b.x * 0.1) * 0.08;
      ctx.drawImage(SPR.blob[b.dir], b.x, b.y - wob * 10, 14, 10 * (1 + wob));
    } else {
      const bob = Math.floor(t * 6 + b.x) % 2;
      ctx.drawImage(SPR.protester[b.dir], b.x, b.y - bob, 10, 16);
      drawSign(b.x + 5, b.y - 9 - bob, 'NO AI', 18);
    }
  }

  // saws
  for (const saw of lv.saws) drawSaw(saw.cx, saw.cy, saw.r, t);

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
  const msg = run.dead ? run.cause : !run.started ? def.hint : '';
  if (msg && state === 'play') {
    ctx.font = `bold ${Math.round(18 * Math.min(3, window.devicePixelRatio || 1))}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000aa';
    ctx.fillText(msg, W / 2 + 2, H * 0.32 + 2);
    ctx.fillStyle = run.dead ? '#ffb199' : '#ffffff';
    ctx.fillText(msg, W / 2, H * 0.32);
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

function drawSign(cx, y, text, w) {
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(cx - 0.5, y + 6, 1, 6);
  ctx.fillStyle = '#f4efe2';
  ctx.fillRect(cx - w / 2, y, w, 7);
  ctx.fillStyle = '#c8423b';
  ctx.font = 'bold 5px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + 3.8);
  ctx.textBaseline = 'alphabetic';
}

function drawHater(H, t) {
  const x = H.x, y = H.y, f = H.face;
  // legs
  ctx.fillStyle = '#2b2b3a'; ctx.fillRect(x + 4, y + 20, 5, 8); ctx.fillRect(x + 11, y + 20, 5, 8);
  // coat
  ctx.fillStyle = '#4d5b3a'; ctx.fillRect(x + 2, y + 9, 16, 13);
  ctx.fillStyle = '#3a4529'; ctx.fillRect(x + 9, y + 9, 2, 13);
  // head + beard
  ctx.fillStyle = COLORS.s; ctx.fillRect(x + 5, y, 10, 9);
  ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x + 5, y + 5, 10, 5); ctx.fillRect(x + 4, y, 12, 2);
  // angry eyes
  ctx.fillStyle = '#141414';
  const ex = f > 0 ? 1 : 0;
  ctx.fillRect(x + 7 + ex, y + 3, 2, 2); ctx.fillRect(x + 11 + ex, y + 3, 2, 2);
  ctx.fillRect(x + 6 + ex, y + 2, 3, 1); ctx.fillRect(x + 11 + ex, y + 2, 3, 1);
  // arm + sign (raised while throwing)
  const raise = H.anim > 0 ? -8 : Math.sin(t * 5) * 1.5;
  const ax = f > 0 ? x + 18 : x - 2;
  ctx.fillStyle = '#4d5b3a'; ctx.fillRect(ax, y + 8 + raise, 4, 8);
  drawSign(ax + 2, y - 10 + raise, 'NO AI!', 26);
  // speech
  if (Math.floor(t * 0.8) % 3 === 0) {
    ctx.font = 'bold 6px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(['SLOP!', 'GO AWAY BOT!', 'CLANKER!'][Math.floor(t * 0.8 / 3) % 3], x + 10, y - 24);
  }
}

function drawShot(sh) {
  ctx.save();
  ctx.translate(sh.x, sh.y);
  ctx.rotate(sh.rot);
  if (sh.kind === 'tomato') {
    ctx.fillStyle = '#d9342b'; ctx.beginPath(); ctx.arc(0, 0, sh.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f8f3a'; ctx.fillRect(-1.5, -sh.r - 1, 3, 2);
  } else {
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = '#c8423b'; ctx.fillRect(-4, -0.5, 8, 1); ctx.fillRect(-0.5, -3, 1, 6);
  }
  ctx.restore();
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
  } else acc = 0;
  render(state === 'pause' ? 0 : dt);
  requestAnimationFrame(frame);
}

// Title art: big Claude Boy
{
  const c = $('#title-hero');
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(SPR.clawd.idle[1], 0, 0, c.width, c.height);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
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
