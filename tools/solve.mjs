// Brute-force reachability check for every level using the real physics.
// Ignores moving hazards (moving saws, walkers, the Hater) and treats crumbling
// blocks as solid, so it validates level geometry and reports a near-optimal time.
// Usage: node tools/solve.mjs [levelIndex]
import { LEVELS } from '../src/levels.js';
import { parseLevel, newPlayer, stepPlayer, checkDeath, touchesGoal, DT } from '../src/physics.js';

const HOLD = 4; // physics steps per decision
const ACTIONS = [];
for (const dir of [-1, 0, 1]) for (const jump of [false, true]) ACTIONS.push({ dir, jump });

function solve(def) {
  const widths = new Set(def.map.map(r => r.length));
  if (widths.size > 1) return { ok: false, msg: `uneven rows: ${[...widths]}` };
  const lv = parseLevel(def);
  lv.walkers = []; lv.hater = null; lv.saws = lv.saws.filter(s => !s.path && s.ox === undefined);

  const seen = new Set();
  let frontier = [{ p: newPlayer(lv), held: false }];
  for (let depth = 1; depth < 2000 && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const a of ACTIONS) {
        const p = { ...node.p };
        let alive = true, won = false;
        for (let i = 0; i < HOLD; i++) {
          const inp = { left: a.dir < 0, right: a.dir > 0, jump: a.jump, jumpPressed: a.jump && !node.held && i === 0 };
          stepPlayer(p, inp, lv, DT, []);
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

const only = process.argv[2];
LEVELS.forEach((def, i) => {
  if (only !== undefined && +only !== i) return;
  const t0 = Date.now();
  const r = solve(def);
  const ms = Date.now() - t0;
  console.log(`${i + 1}. ${def.name.padEnd(24)} ${r.ok ? `OK  best≈${r.time.toFixed(2)}s par=${def.par}` : 'FAIL ' + r.msg}  (${ms}ms)`);
});
