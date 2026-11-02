# Super Claude Boy

A tough-as-nails speedrun platformer in the spirit of Super Meat Boy, starring the Claude Code mascot.
The Hater has kidnapped Byte. Run, wall-jump, and dodge AI slop, saws, and angry protesters to get them back.

**Play:** https://mariotristan.github.io/super-claude-boy/

## Install on iPad

1. Open the link above in Safari.
2. Tap **Share → Add to Home Screen**.
3. Launch it from the home screen. It runs full-screen and works offline after the first load.

## Controls

| | Move | Jump | Restart | Pause |
|---|---|---|---|---|
| Touch | ◀ ▶ (left half of screen) | right half of screen | ↻ button | ❚❚ button |
| Keyboard | ← → / A D | Space / ↑ / W / Z | R | Esc / P |
| Gamepad | stick / D-pad | A | Y / X | Start |

Hold jump longer to jump higher. Jump into a wall, then jump again to wall-jump.

## Speedrunning

- The timer starts on your first input and runs on a fixed 120 Hz simulation, so times are fair and deterministic.
- Each level saves your best time and shows a **ghost** of that run.
- Beat the par time for an **A+**.

## Development

No build step. Serve the folder and open it:

```sh
python3 -m http.server 8080
# open http://localhost:8080/        (append ?play=3 to jump straight into level 3)
```

- `src/levels.js`: levels as ASCII maps (legend at the top of the file)
- `src/physics.js`: movement and collision (no DOM; also used by the solver)
- `node tools/solve.mjs`: brute-force check that every level is beatable, with an approximate best time
- `python3 tools/make-icons.py`: regenerates the PWA icons
- Bump `CACHE` in `sw.js` when you ship changes so installed copies update.
