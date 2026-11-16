// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, blessing,
// paused, game over and victory.
//
// ?seed=N fixes the shade pattern. ?shot=title|play|boss|victory|over (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, BLESSING_CARDS, SHOT_SEED, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BOSS, EVENT_BOSS_DEAD, EVENT_ENRAGE, EVENT_HEAL, EVENT_HIT, EVENT_OVER, EVENT_PICKUP, EVENT_SHIELD, EVENT_SURGE, EVENT_WAVE_CLEAR, EVENT_WON, PHASE_BLESSING, PHASE_FIGHT, PHASE_OVER, PHASE_WON } from './world.js';
import {
  ACTION_BLESSING_1,
  ACTION_BLESSING_2,
  ACTION_BLESSING_3,
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import {
  SCREEN_BLESSING,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WON,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastHits = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.startDrone();
    world.startRun();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Wave 1. Survive 10 waves and slay the Gloom Herald.');
  }

  function endGame(won) {
    if (won) {
      screen = SCREEN_WON;
      audio.victory();
      announce(`Victory. Score ${world.state.score}. Best ${best}.`);
    } else {
      screen = SCREEN_OVER;
      audio.gameOver();
      announce(`Game over on wave ${world.state.wave}. Score ${world.state.score}. Best ${best}.`);
    }
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function handleEvents(events) {
    if (events & EVENT_BOSS) {
      audio.bossRoar();
      announce('The Gloom Herald appears.');
    }
    if (events & EVENT_ENRAGE) {
      audio.bossRoar();
      announce('The Gloom Herald is enraged.');
    }
    if (events & EVENT_BOSS_DEAD) audio.enemyDie();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HEAL) audio.heal();
    if (events & EVENT_SHIELD) audio.shieldBlock();
    if (events & EVENT_SURGE) {
      audio.surge();
      announce('Lantern Surge. Double damage.');
    }
    if (events & EVENT_WAVE_CLEAR) {
      audio.blessing();
      announce(`Wave ${world.state.wave} cleared. Choose a blessing.`);
    }
    if (events & EVENT_HIT) {
      audio.playerHit();
      announce(`Hit. ${Math.max(0, Math.ceil(world.state.player.hp))} health left.`);
    }
    if (events & EVENT_WON) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function pickBlessing(index) {
    if (screen !== SCREEN_BLESSING) return;
    if (world.chooseBlessing(index)) {
      audio.blessing();
      screen = SCREEN_PLAY;
      announce(`Blessing chosen. Wave ${world.state.wave}.`);
    }
  }

  function blessingCardAt(clientX, clientY) {
    const p = renderer.toLogical(clientX, clientY);
    for (let i = 0; i < BLESSING_CARDS.length; i += 1) {
      const c = BLESSING_CARDS[i];
      if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) return i;
    }
    return -1;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WON) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_BLESSING) {
      if (actions & ACTION_BLESSING_1) pickBlessing(0);
      else if (actions & ACTION_BLESSING_2) pickBlessing(1);
      else if (actions & ACTION_BLESSING_3) pickBlessing(2);
      else if (actions & ACTION_CONFIRM) {
        const aim = input.aim();
        const card = blessingCardAt(aim.x, aim.y);
        if (card >= 0) pickBlessing(card);
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    const aimClient = input.aim();
    const aim = renderer.toLogical(aimClient.x, aimClient.y);
    const events = world.step(STEP, { mx: move.x, my: move.y, aimX: aim.x, aimY: aim.y, firing: input.firing() }, false);
    // The hit sound fires on new hits: the world's hit counter is the tell.
    if (world.state.stats.hits > lastHits) {
      audio.hitEnemy();
      lastHits = world.state.stats.hits;
    }
    if (world.state.phase === PHASE_BLESSING) screen = SCREEN_BLESSING;
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting shades close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberlight. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
