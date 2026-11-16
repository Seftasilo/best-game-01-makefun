# best-game-01-makefun

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Seftasilo/best-game-01-makefun/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Seftasilo/best-game-01-makefun/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Emberlight — Keeper of the Last Lantern: a top-down 2D canvas arena shooter. You are Wren, keeper of the last lantern, holding a ruined arena against the shades for 10 waves — and against the Gloom Herald, who waits on waves 5 and 10. Built by an AI agent for make.fun's "Make the best game" bounty, $1,000 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Serve locally: `node serve.ts` — serves game/ on http://localhost:8080.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zarjnazz&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

## How to play

- **Move:** W A S D or arrow keys
- **Aim:** mouse
- **Fire:** hold the left mouse button (or hold Space)
- **Pause:** P or Esc · **Mute:** M
- **Blessings:** between waves, pick 1 of 3 with keys 1 / 2 / 3 or by clicking a card

Five shade kinds hunt you — Motes that drift in, Skitters that zigzag fast,
Spitters that keep their distance and shoot, Wisps that blink closer, and
Brutes that soak up fire — plus the Gloom Herald boss, who fires radial bursts,
summons motes, and charges when enraged below half health.

Kills build a combo multiplier (up to x3). Slain shades drop embers: gather 12
to light the Lantern Surge — double damage for 8 seconds. Between waves, choose
one of three blessings from eight kinds (damage, fire rate, multishot, speed,
max HP, pierce, magnet, shield). Win by slaying the wave-10 Herald.

Your best score is kept in localStorage; a status line announces screens and
hits for screen readers. All sound is synthesised with WebAudio — no audio
files, no network, everything offline.

## Layout

- `game/index.html` — the page: full-screen canvas, status line, one module script
- `game/src/config.js` — every tuning number, colour and blessing in one place
- `game/src/random.js` — the seeded generator (mulberry32) behind every dice roll
- `game/src/audio.js` — WebAudio synth effects and the ambient drone
- `game/src/input.js` — keyboard and pointer input, one-shot actions as flags
- `game/src/world.js` — the rules: waves, shades, the boss, blessings, combo, surge
- `game/src/render.js` — drawing only: arena, shades, HUD, panels, shake, glow
- `game/src/shots.js` — the deterministic staged scenes behind `?shot=…&seed=7`
- `game/src/main.js` — boot, the fixed-step loop, screens, live play and shots
- `main.ts` — the hand-in program: copies game/ + screenshots/, writes dossier.json
- `serve.ts` — a tiny static server for local play
- `shots.json` — the four screenshot scenes (title, play, boss, victory)

## Screenshots

`shots.json` lists the four shots, each a real render of the game's own code
in headless Chromium at 1280x720: the title, wave-3 play with its HUD, the
wave-5 boss with its health bar, and the victory screen.

## License

MIT — see LICENSE.
