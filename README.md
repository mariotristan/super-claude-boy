# Super Claude Boy

A tough-as-nails speedrun platformer in the spirit of Super Meat Boy, starring the Claude Code mascot.
The Hater has kidnapped Byte. Run, wall-jump, and dodge AI slop, saws, and angry protesters to get them back.

**Play:** https://mariotristan.github.io/super-claude-boy/

![Title screen](docs/screenshots/title.png)

| | |
|---|---|
| ![The Slop Pit](docs/screenshots/slop-pit.png) | ![Hallucination Sawmill](docs/screenshots/sawmill.png) |
| ![Boss level: The Hater](docs/screenshots/the-hater.png) | ![Intro scene](docs/screenshots/intro.png) |

![Level select](docs/screenshots/level-select.png)

## About

Super Claude Boy is a fan-made love letter to two things:

- **[Super Meat Boy](https://supermeatboy.com/)** (Team Meat, 2010). It inspired the brutal-but-fair level design, instant respawns, wall jumps, the trail the hero leaves on every surface, the kidnapped friend, and the obsession with shaving milliseconds off a run.
- **The Claude Code mascot**, the little orange pixel creature in the terminal, recast as a platform hero. His friend Byte stands in for Bandage Girl.

The villains poke fun at the AI conversation from both sides. **AI slop** shows up as the hazards: oozing purple goo, glitchy "hallucinated" saws, and blobs with too many eyes. **The Hater** and his sign-waving protesters stand in for the people who want no AI anywhere, ever. It's all in good fun.

The game was built with [Claude Code](https://claude.com/claude-code) as a small experiment in making a complete, polished, installable game with no engine and no build step.

**Music:** every track is an original chiptune composed for this game and synthesized live in the browser with the Web Audio API (`src/music.js`). There are no audio files and no third-party music or samples, so there are no licensing strings attached.

*Super Claude Boy is an unofficial fan project. It is not affiliated with or endorsed by Anthropic or Team Meat. Super Meat Boy is a trademark of Team Meat; Claude and Claude Code are trademarks of Anthropic.*

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
Die more than three times on a level and the game starts showing tips for it.

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
- `src/music.js`: the soundtrack, written as note patterns (one track per level plus the title theme)
- `src/physics.js`: movement and collision (no DOM; also used by the solver)
- `node tools/solve.mjs`: brute-force check that every level is beatable, with an approximate best time
- `python3 tools/make-icons.py`: regenerates the PWA icons
- Bump `CACHE` in `sw.js` when you ship changes so installed copies update.
