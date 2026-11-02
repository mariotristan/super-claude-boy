// Brute-force reachability check for every level using the real physics.
// Moving saws and patrolling enemies are replayed on the same timeline the game uses
// (the world starts when the player first moves), so a path found here dodges them too.
// Keyboard Warriors fire on a fixed clock, so their shots are replayed too.
// Not modelled: The Hater's throws, and crumbling blocks (treated as solid).
// Usage: node tools/solve.mjs [levelIndex] [--static]   (--static ignores moving hazards)
import { LEVELS } from '../src/levels.js';
import { parseLevel, newPlayer, stepPlayer, updateWorld, checkDeath, touchesGoal, DT } from '../src/physics.js';

const HOLD = 4; // physics steps per decision
const MAX_DEPTH = 1500;
const ACTIONS = [];
for (const dir of [-1, 0, 1]) for (const jump of [false, true]) ACTIONS.push({ dir, jump });

// World state (walkers and saws) after each physics step, independent of the player.
function timeline(def, steps) {
  const lv = parseLevel(def);
  lv.hater = null;
  const far = { x: -1e6, y: -1e6, w: 1, h: 1 };
  const snaps = [];
  for (let i = 0; i < steps; i++) {
    updateWorld(lv, DT, far, []);
    snaps.push({
      walkers: lv.walkers.map(w => ({ ...w })),
      saws: lv.saws.map(s => ({ cx: s.cx, cy: s.cy, r: s.r, bot: s.bot })),
      shots: lv.shots.map(s => ({ x: s.x, y: s.y, r: s.r, kind: s.kind })),
    });
  }
  return snaps;
}

function solve(def, dynamic) {
  const widths = new Set(def.map.map(r => r.length));
  if (widths.size > 1) return { ok: false, msg: `uneven rows: ${[...widths]}` };
  const lv = parseLevel(def);
  lv.hater = null;
  const statics = lv.saws.filter(s => !s.path && s.ox === undefined);
  const snaps = dynamic ? timeline(def, MAX_DEPTH * HOLD) : null;
  if (!dynamic) { lv.walkers = lv.walkers.filter(w => w.kind === 'k'); lv.saws = statics; }

  const seen = new Set();
  let frontier = [{ p: newPlayer(lv), held: false }];
  for (let depth = 1; depth < MAX_DEPTH && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const a of ACTIONS) {
        const p = { ...node.p };
        let alive = true, won = false;
        for (let i = 0; i < HOLD; i++) {
          const inp = { left: a.dir < 0, right: a.dir > 0, jump: a.jump, jumpPressed: a.jump && !node.held && i === 0 };
          stepPlayer(p, inp, lv, DT, []);
          if (dynamic) {
            const snap = snaps[(depth - 1) * HOLD + i];
            lv.walkers = snap.walkers;
            lv.saws = snap.saws;
            lv.shots = snap.shots;
          }
          if (checkDeath(p, lv)) { alive = false; break; }
          if (touchesGoal(p, lv)) { won = true; break; }
        }
        if (won) return { ok: true, time: depth * HOLD * DT, states: seen.size };
        if (!alive) continue;
        const key = `${p.x >> 2},${p.y >> 2},${Math.round(p.vx / 60)},${Math.round(p.vy / 90)},${+p.onGround},${+(p.lock > 0)},${+a.jump},${+(p.coyote > 0)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ p, held: a.jump });
      }
    }
    frontier = next;
    if (seen.size > 4e6) break;
  }
  return { ok: false, msg: `unreachable (${seen.size} states)` };
}

const args = process.argv.slice(2);
const only = args.find(a => /^\d+$/.test(a));
const dynamic = !args.includes('--static');
let failed = 0;
LEVELS.forEach((def, i) => {
  if (only !== undefined && +only !== i) return;
  const t0 = Date.now();
  const r = solve(def, dynamic);
  if (!r.ok) failed++;
  const ms = Date.now() - t0;
  console.log(`${String(i + 1).padStart(2)}. ${def.name.padEnd(24)} ${r.ok ? `OK  best≈${r.time.toFixed(2)}s par=${def.par}` : 'FAIL ' + r.msg}  (${ms}ms)`);
});
process.exitCode = failed ? 1 : 0;
