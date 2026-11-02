// Core simulation: level parsing, player movement, world objects, hazards.
// Pure logic (no DOM) so it can run in Node for the level solver.

export const T = 16;          // tile size in world pixels
export const DT = 1 / 120;    // fixed physics step

export const P = {
  w: 12, h: 12,
  runMax: 230,
  accelGround: 3000, accelAir: 2000,
  friction: 2600, airDrag: 600,
  gravity: 2000, gravityRelease: 2.6,
  maxFall: 720, wallSlideMax: 130,
  jumpV: 520,
  wallJumpVX: 250, wallJumpVY: 470, wallJumpLock: 0.12,
  coyote: 0.08, buffer: 0.1,
  crumbleTime: 0.35, crumbleRespawn: 2.5,
  shotGravity: 700,
};

// ---------------------------------------------------------------- level

export function parseLevel(def) {
  const rows = def.map;
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const lv = {
    def, w, h, grid: [], start: null, goal: null,
    saws: [], walkers: [], crumbles: new Map(), hater: null, shots: [], time: 0,
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ch = rows[y][x] ?? '.';
      switch (ch) {
        case 'S': lv.start = { x: x * T + (T - P.w) / 2, y: (y + 1) * T - P.h }; ch = '.'; break;
        case 'G': lv.goal = { x: x * T + 2, y: (y + 1) * T - 14, w: 12, h: 14 }; ch = '.'; break;
        case 'o': lv.saws.push({ cx: x * T + T / 2, cy: y * T + T / 2, r: 11 }); ch = '.'; break;
        case 'b': case 'p': lv.walkers.push(makeWalker(ch, x, y)); ch = '.'; break;
        case 'H': lv.hater = { x: x * T - 2, y: (y + 1) * T - 28, w: 20, h: 28, cool: 1.5, face: -1, anim: 0 }; ch = '.'; break;
        case 'c': lv.crumbles.set(y * w + x, { state: 'idle', timer: 0 }); break;
      }
      lv.grid.push(ch);
    }
  }
  for (const s of def.saws || []) {
    const saw = { r: s.r || 11, speed: s.speed || 60, cx: 0, cy: 0 };
    if (s.orbit) {
      saw.ox = s.orbit[0] * T + T / 2; saw.oy = s.orbit[1] * T + T / 2;
      saw.rad = s.radius * T; saw.phase = s.phase || 0;
    } else {
      saw.path = s.path.map(([tx, ty]) => ({ x: tx * T + T / 2, y: ty * T + T / 2 }));
      saw.loop = !!s.loop;
      const pts = saw.loop ? [...saw.path, saw.path[0]] : saw.path;
      saw.segs = [];
      saw.len = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
        saw.segs.push({ a: pts[i], b: pts[i + 1], l });
        saw.len += l;
      }
    }
    lv.saws.push(saw);
  }
  positionSaws(lv);
  return lv;
}

function makeWalker(kind, x, y) {
  const w = kind === 'b' ? 14 : 10;
  const h = kind === 'b' ? 10 : 16;
  return { kind, x: x * T + (T - w) / 2, y: (y + 1) * T - h, w, h, dir: -1, speed: kind === 'b' ? 35 : 55 };
}

export function tileAt(lv, tx, ty) {
  if (tx < 0 || tx >= lv.w || ty < 0) return '#';
  if (ty >= lv.h) return '.';
  return lv.grid[ty * lv.w + tx];
}

export function isSolid(lv, tx, ty) {
  const c = tileAt(lv, tx, ty);
  if (c === '#') return true;
  if (c === 'c') return lv.crumbles.get(ty * lv.w + tx).state !== 'gone';
  return false;
}

export function overlapsSolid(lv, x, y, w, h) {
  const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
  const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.001) / T);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (isSolid(lv, tx, ty)) return true;
  return false;
}

const overlap = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

// ---------------------------------------------------------------- player

export function newPlayer(lv) {
  return {
    x: lv.start.x, y: lv.start.y, w: P.w, h: P.h, vx: 0, vy: 0,
    onGround: false, wall: 0, sliding: false, coyote: 0, buffer: 0, lock: 0, face: 1,
  };
}

// inp: { left, right, jump (held), jumpPressed (edge) }. Pushes events into ev.
export function stepPlayer(p, inp, lv, dt, ev) {
  p.wall = 0;
  if (!p.onGround) {
    if (overlapsSolid(lv, p.x - 2, p.y + 2, 2, p.h - 4)) p.wall = -1;
    else if (overlapsSolid(lv, p.x + p.w, p.y + 2, 2, p.h - 4)) p.wall = 1;
  }
  if (inp.jumpPressed) p.buffer = P.buffer; else if (p.buffer > 0) p.buffer -= dt;
  p.coyote = p.onGround ? P.coyote : p.coyote - dt;
  if (p.lock > 0) p.lock -= dt;

  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (dir) {
    const prevAbs = Math.abs(p.vx);
    let a = p.onGround ? P.accelGround : P.accelAir;
    if (p.lock > 0) a *= 0.2;
    if (p.vx * dir < 0) a += p.onGround ? P.friction : P.airDrag;
    p.vx += dir * a * dt;
    if (Math.abs(p.vx) > P.runMax) {
      p.vx = Math.sign(p.vx) * Math.max(P.runMax, prevAbs - P.airDrag * dt);
    }
    p.face = dir;
  } else {
    const f = (p.onGround ? P.friction : P.airDrag) * dt;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }

  if (p.buffer > 0) {
    if (p.coyote > 0) {
      p.vy = -P.jumpV; p.buffer = 0; p.coyote = 0; p.onGround = false;
      ev.push({ type: 'jump', x: p.x + p.w / 2, y: p.y + p.h });
    } else if (p.wall) {
      p.vy = -P.wallJumpVY; p.vx = -p.wall * P.wallJumpVX;
      p.lock = P.wallJumpLock; p.buffer = 0; p.face = -p.wall;
      ev.push({ type: 'walljump', x: p.wall > 0 ? p.x + p.w : p.x, y: p.y + p.h / 2, dir: p.wall });
    }
  }

  let g = P.gravity;
  if (p.vy < 0 && !inp.jump) g *= P.gravityRelease;
  p.vy += g * dt;
  p.sliding = p.wall !== 0 && dir === p.wall && p.vy > 0;
  if (p.sliding && p.vy > P.wallSlideMax) p.vy = Math.max(P.wallSlideMax, p.vy - 3000 * dt);
  else if (p.vy > P.maxFall) p.vy = P.maxFall;

  const wasGround = p.onGround;
  const fallSpeed = p.vy;
  moveX(p, p.vx * dt, lv);
  p.onGround = false;
  moveY(p, p.vy * dt, lv);
  if (p.onGround && !wasGround) ev.push({ type: 'land', x: p.x + p.w / 2, y: p.y + p.h, vy: fallSpeed });
  if (p.onGround) triggerCrumbles(p, lv);
}

function moveX(p, dx, lv) {
  p.x += dx;
  if (!overlapsSolid(lv, p.x, p.y, p.w, p.h)) return;
  if (dx > 0) p.x = Math.floor((p.x + p.w) / T) * T - p.w;
  else if (dx < 0) p.x = (Math.floor(p.x / T) + 1) * T;
  p.vx = 0;
}

function moveY(p, dy, lv) {
  p.y += dy;
  if (!overlapsSolid(lv, p.x, p.y, p.w, p.h)) return;
  if (dy > 0) { p.y = Math.floor((p.y + p.h) / T) * T - p.h; p.onGround = true; }
  else if (dy < 0) p.y = (Math.floor(p.y / T) + 1) * T;
  p.vy = 0;
}

function triggerCrumbles(p, lv) {
  const ty = Math.floor((p.y + p.h + 1) / T);
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.001) / T);
  for (let tx = x0; tx <= x1; tx++) {
    if (tileAt(lv, tx, ty) !== 'c') continue;
    const c = lv.crumbles.get(ty * lv.w + tx);
    if (c.state === 'idle') { c.state = 'shaking'; c.timer = P.crumbleTime; }
  }
}

// ---------------------------------------------------------------- world

export function positionSaws(lv) {
  for (const s of lv.saws) {
    if (s.ox !== undefined) {
      const a = s.phase + lv.time * s.speed;
      s.cx = s.ox + Math.cos(a) * s.rad;
      s.cy = s.oy + Math.sin(a) * s.rad;
    } else if (s.path) {
      let d = lv.time * s.speed;
      if (s.loop) d %= s.len;
      else { d %= 2 * s.len; if (d > s.len) d = 2 * s.len - d; }
      for (const seg of s.segs) {
        if (d <= seg.l || seg === s.segs[s.segs.length - 1]) {
          const k = seg.l ? Math.min(1, d / seg.l) : 0;
          s.cx = seg.a.x + (seg.b.x - seg.a.x) * k;
          s.cy = seg.a.y + (seg.b.y - seg.a.y) * k;
          break;
        }
        d -= seg.l;
      }
    }
  }
}

export function updateWorld(lv, dt, p, ev) {
  lv.time += dt;
  positionSaws(lv);

  for (const [i, c] of lv.crumbles) {
    const tx = i % lv.w, ty = (i / lv.w) | 0;
    if (c.state === 'shaking') {
      c.timer -= dt;
      if (c.timer <= 0) {
        c.state = 'gone'; c.timer = P.crumbleRespawn;
        ev.push({ type: 'crumble', x: tx * T + T / 2, y: ty * T + T / 2 });
      }
    } else if (c.state === 'gone') {
      c.timer -= dt;
      if (c.timer <= 0 && !overlap(p.x, p.y, p.w, p.h, tx * T, ty * T, T, T)) c.state = 'idle';
    }
  }

  for (const b of lv.walkers) {
    const nx = b.x + b.dir * b.speed * dt;
    const ahead = b.dir > 0 ? nx + b.w : nx;
    const tx = Math.floor(ahead / T);
    const blocked = isSolid(lv, tx, Math.floor((b.y + b.h / 2) / T));
    const noFloor = !isSolid(lv, tx, Math.floor((b.y + b.h + 1) / T));
    if (blocked || noFloor) b.dir *= -1; else b.x = nx;
  }

  const H = lv.hater;
  if (H) {
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    const hcx = H.x + H.w / 2, hy = H.y + 6;
    H.face = pcx < hcx ? -1 : 1;
    H.cool -= dt;
    if (H.anim > 0) H.anim -= dt;
    if (H.cool <= 0 && Math.abs(pcx - hcx) < 18 * T) {
      H.cool = 1.1;
      H.anim = 0.25;
      const tx = pcx + Math.max(-60, Math.min(60, p.vx * 0.35));
      const dx = tx - hcx, dy = pcy - hy;
      const flight = Math.max(0.55, Math.min(1.1, Math.abs(dx) / 220));
      lv.shots.push({
        x: hcx, y: hy, r: 5, rot: 0,
        vx: dx / flight, vy: dy / flight - 0.5 * P.shotGravity * flight,
        kind: lv.shots.length % 2 ? 'tomato' : 'sign',
      });
      ev.push({ type: 'throw' });
    }
  }
  for (let i = lv.shots.length - 1; i >= 0; i--) {
    const s = lv.shots[i];
    s.vy += P.shotGravity * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.rot += dt * 12;
    if (isSolid(lv, Math.floor(s.x / T), Math.floor(s.y / T)) || s.y > lv.h * T + 32) {
      ev.push({ type: 'shotHit', x: s.x, y: s.y, kind: s.kind });
      lv.shots.splice(i, 1);
    }
  }
}

// Returns a cause string if the player dies this step, else null.
export function checkDeath(p, lv) {
  if (p.y > lv.h * T + 8) return 'fall';
  const hx = p.x + 2, hy = p.y + 2, hw = p.w - 4, hh = p.h - 3;
  const x0 = Math.floor(hx / T), x1 = Math.floor((hx + hw) / T);
  const y0 = Math.floor(hy / T), y1 = Math.floor((hy + hh) / T);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (tileAt(lv, tx, ty) === '^' && overlap(hx, hy, hw, hh, tx * T + 2, ty * T + 7, 12, 9)) return 'slop';
  for (const s of lv.saws) {
    const cx = Math.max(hx, Math.min(s.cx, hx + hw)), cy = Math.max(hy, Math.min(s.cy, hy + hh));
    const r = s.r - 1;
    if ((cx - s.cx) ** 2 + (cy - s.cy) ** 2 < r * r) return 'saw';
  }
  for (const b of lv.walkers)
    if (overlap(hx, hy, hw, hh, b.x + 1, b.y + 1, b.w - 2, b.h - 1)) return b.kind === 'b' ? 'slop' : 'hater';
  const H = lv.hater;
  if (H && overlap(hx, hy, hw, hh, H.x + 2, H.y + 2, H.w - 4, H.h - 2)) return 'hater';
  for (const s of lv.shots) {
    const cx = Math.max(hx, Math.min(s.x, hx + hw)), cy = Math.max(hy, Math.min(s.y, hy + hh));
    if ((cx - s.x) ** 2 + (cy - s.y) ** 2 < s.r * s.r) return 'hater';
  }
  return null;
}

export function touchesGoal(p, lv) {
  const g = lv.goal;
  return overlap(p.x, p.y, p.w, p.h, g.x, g.y, g.w, g.h);
}
