// The screenshot scenes behind ?shot=title|play|boss|victory|over. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (kite the nearest shade at lantern range, aim at it, keep
// firing), so the frame is what a real game looks like and the same seed always
// gives the same frame. The victory scene plays wave 10 with a strong blessing
// build, as a run that earned one would; the over scene stands still and never
// fires, as a player caught out would.

import { FIELD, STEP } from './config.js';
import { PHASE_FIGHT, PHASE_OVER, PHASE_WON } from './world.js';
import { SCREEN_BLESSING, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const BOSS_SECONDS = 45;
const VICTORY_LIMIT_SECONDS = 180;
const OVER_LIMIT_SECONDS = 120;
const KITE_NEAR = 170;
const KITE_FAR = 300;

/** The nearest shade, or null when the arena is empty. */
function nearestEnemy(state) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** The nearest enemy orb, or null when none is close enough to matter. */
function nearestOrb(state) {
  let best = null;
  let bestD = Infinity;
  for (const o of state.orbs) {
    const d = (o.x - state.player.x) ** 2 + (o.y - state.player.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return bestD < 110 * 110 ? best : null;
}

/**
 * One autopilot step: move to keep the nearest shade at lantern range (back off
 * when it closes in, close in when it hangs back, strafe while it sits at range),
 * aim at it and keep the lantern firing. An orb closing in takes priority: step
 * sideways out of its path.
 */
export function autopilot(state) {
  const player = state.player;
  const enemy = nearestEnemy(state);
  if (!enemy) {
    return { mx: 0, my: 0, aimX: player.x + 1, aimY: player.y, firing: false };
  }
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const nx = dx / d;
  const ny = dy / d;
  let mx = 0;
  let my = 0;
  const orb = nearestOrb(state);
  if (orb) {
    // Step sideways out of the orb's path: perpendicular to its travel.
    const od = Math.max(1, Math.hypot(orb.vx, orb.vy));
    const side = (orb.vx * -ny + orb.vy * nx) > 0 ? 1 : -1;
    mx = (-orb.vy / od) * side;
    my = (orb.vx / od) * side;
  } else if (d < KITE_NEAR) {
    mx = -nx;
    my = -ny;
  } else if (d > KITE_FAR) {
    mx = nx;
    my = ny;
  } else {
    // Strafe: circle the shade, flipping with the world's clock.
    const side = Math.sin(state.time * 2.1) > 0 ? 1 : -1;
    mx = -ny * side;
    my = nx * side;
  }
  // Keep the fight in the open: a pull toward the centre that grows near the
  // walls, so the pilot orbits mid-arena instead of getting pinned in a corner.
  const pullX = (FIELD.width / 2 - player.x) / (FIELD.width / 2);
  const pullY = (FIELD.height / 2 - player.y) / (FIELD.height / 2);
  mx += pullX * 0.9;
  my += pullY * 0.9;
  return { mx, my, aimX: enemy.x, aimY: enemy.y, firing: true };
}

/** The control for a player who never moves and never fires. */
function idleControl(state) {
  return { mx: 0, my: 0, aimX: state.player.x + 1, aimY: state.player.y, firing: false };
}

/** The strong build a run earns by wave 10: every blessing stacked high. */
function strongBuild(world) {
  const p = world.state.player;
  p.damage = 34;
  p.fireRate = 7;
  p.shots = 3;
  p.pierce = 2;
  p.maxHp = 220;
  p.hp = 220;
  p.speed = 280;
  p.magnet = 220;
  p.shieldMax = 2;
  p.shield = 2;
}

/**
 * Set `world` to the named scene (title, play, boss, victory or over; any other
 * name is title) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    world.startRun();
    world.beginWave(3);
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      if (state.phase !== PHASE_FIGHT) break;
      // Stop mid-wave, once the fight is visibly under way: kills on the board,
      // shades still closing in, embers on the floor.
      if (state.waveTime >= 10 && state.kills >= 8) break;
      world.step(STEP, autopilot(state), false);
    }
    const screen = state.phase === PHASE_OVER ? SCREEN_OVER : state.phase === 'blessing' ? SCREEN_BLESSING : SCREEN_PLAY;
    return { screen, best: state.score };
  }
  if (name === 'boss') {
    world.startRun();
    world.beginWave(5);
    for (let i = 0; i < BOSS_SECONDS / STEP; i += 1) {
      if (state.phase !== PHASE_FIGHT) break;
      if (state.boss && state.boss.hp <= state.boss.maxHp * 0.7 && state.waveTime >= 6) break;
      world.step(STEP, autopilot(state), false);
    }
    const screen = state.phase === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY;
    return { screen, best: state.score };
  }
  if (name === 'victory') {
    world.startRun();
    strongBuild(world);
    // The staged scene stands for a full run: nine waves cleared to reach wave 10,
    // so the win panel counts the tenth when the Herald falls.
    world.state.stats.wavesCleared = 9;
    world.beginWave(10);
    for (let i = 0; i < VICTORY_LIMIT_SECONDS / STEP; i += 1) {
      if (state.phase === PHASE_WON) break;
      if (state.phase !== PHASE_FIGHT) {
        // A cleared wave offers a blessing: take the first and carry on.
        if (state.phase === 'blessing') world.chooseBlessing(0);
        else break;
      }
      world.step(STEP, autopilot(state), false);
    }
    return { screen: state.phase === PHASE_WON ? SCREEN_WON : SCREEN_PLAY, best: state.score };
  }
  if (name === 'over') {
    world.startRun();
    world.beginWave(1);
    for (let i = 0; i < OVER_LIMIT_SECONDS / STEP; i += 1) {
      if (state.phase === PHASE_OVER) break;
      world.step(STEP, idleControl(state), false);
    }
    return { screen: state.phase === PHASE_OVER ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  world.reset();
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
