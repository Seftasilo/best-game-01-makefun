// The game's rules and state, with no drawing and no browser in it: the player,
// the pools of bullets and shades, spawning, waves, the boss, blessings, combo,
// embers and the Lantern Surge. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (sound, announcements) without
// the world knowing about screens or sound. All randomness comes from the seeded
// generator handed in, so the same seed and the same inputs give the same game.

import {
  BLESSING_FALLBACKS,
  BLESSINGS,
  BOSS_FINAL,
  BULLET,
  COMBO,
  DROPS,
  ENEMIES,
  FIELD,
  ORB,
  PLAYER,
  STEP,
  SURGE,
  WAVES,
} from './config.js';
import { pick, range } from './random.js';

export const PHASE_IDLE = 'idle';
export const PHASE_FIGHT = 'fight';
export const PHASE_BLESSING = 'blessing';
export const PHASE_WON = 'won';
export const PHASE_OVER = 'over';

export const EVENT_KILL = 1;
export const EVENT_HIT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_BOSS = 16;
export const EVENT_BOSS_DEAD = 32;
export const EVENT_WON = 64;
export const EVENT_OVER = 128;
export const EVENT_SURGE = 256;
export const EVENT_HEAL = 512;
export const EVENT_SHIELD = 1024;
export const EVENT_ENRAGE = 2048;

const WALL = 28;
const MAX_PARTICLES = 400;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2 + 20,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    speed: PLAYER.speed,
    fireTimer: 0,
    damage: PLAYER.damage,
    fireRate: PLAYER.fireRate,
    shots: PLAYER.shots,
    pierce: PLAYER.pierce,
    magnet: PLAYER.magnet,
    shieldMax: PLAYER.shieldMax,
    shield: 0,
    invuln: 0,
    alive: true,
  };
  const state = {
    phase: PHASE_IDLE,
    time: 0,
    wave: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    embers: 0,
    surgeProgress: 0,
    surgeTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    waveTime: 0,
    banner: '',
    bannerTimer: 0,
    player,
    bullets: [],
    orbs: [],
    enemies: [],
    pickups: [],
    particles: [],
    texts: [],
    decorations: { rocks: [], pillars: [], lanterns: [], groundEmbers: [] },
    boss: null,
    shake: 0,
    blessings: [],
    blessingLevels: {},
    ambientTimer: 0,
    stats: { shotsFired: 0, hits: 0, wavesCleared: 0 },
  };

  function basePlayer() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2 + 20;
    player.angle = -Math.PI / 2;
    player.hp = PLAYER.maxHp;
    player.maxHp = PLAYER.maxHp;
    player.speed = PLAYER.speed;
    player.fireTimer = 0;
    player.damage = PLAYER.damage;
    player.fireRate = PLAYER.fireRate;
    player.shots = PLAYER.shots;
    player.pierce = PLAYER.pierce;
    player.magnet = PLAYER.magnet;
    player.shieldMax = PLAYER.shieldMax;
    player.shield = 0;
    player.invuln = 0;
    player.alive = true;
  }

  function buildDecorations() {
    const d = state.decorations;
    d.rocks = [];
    d.pillars = [];
    d.lanterns = [];
    d.groundEmbers = [];
    for (let i = 0; i < 14; i += 1) {
      d.rocks.push({
        x: range(random, 60, FIELD.width - 60),
        y: range(random, 90, FIELD.height - 60),
        r: range(random, 14, 42),
        points: 7,
        seed: random() * 10,
      });
    }
    for (let i = 0; i < 6; i += 1) {
      d.pillars.push({
        x: range(random, 80, FIELD.width - 80),
        y: range(random, 110, FIELD.height - 80),
        w: range(random, 22, 34),
        h: range(random, 60, 130),
        broken: random() < 0.5,
      });
    }
    for (let i = 0; i < 8; i += 1) {
      d.lanterns.push({
        x: range(random, 70, FIELD.width - 70),
        y: range(random, 100, FIELD.height - 70),
        phase: random() * Math.PI * 2,
      });
    }
    for (let i = 0; i < 26; i += 1) {
      d.groundEmbers.push({
        x: range(random, 40, FIELD.width - 40),
        y: range(random, 70, FIELD.height - 40),
        phase: random() * Math.PI * 2,
        size: range(random, 1.5, 3.5),
      });
    }
  }

  function reset() {
    basePlayer();
    state.phase = PHASE_IDLE;
    state.time = 0;
    state.wave = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.embers = 0;
    state.surgeProgress = 0;
    state.surgeTimer = 0;
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.waveTime = 0;
    state.banner = '';
    state.bannerTimer = 0;
    state.bullets = [];
    state.orbs = [];
    state.enemies = [];
    state.pickups = [];
    state.particles = [];
    state.texts = [];
    state.boss = null;
    state.shake = 0;
    state.blessings = [];
    state.blessingLevels = {};
    state.ambientTimer = 0;
    state.stats = { shotsFired: 0, hits: 0, wavesCleared: 0 };
    buildDecorations();
  }

  function addParticles(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const v = range(random, speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: range(random, life * 0.5, life),
        maxLife: life,
        size: range(random, size * 0.6, size * 1.4),
        color,
      });
    }
    if (state.particles.length > MAX_PARTICLES) {
      state.particles.splice(0, state.particles.length - MAX_PARTICLES);
    }
  }

  function addText(x, y, text, color, size) {
    state.texts.push({ x, y, vy: -46, life: 1.1, maxLife: 1.1, text, color, size: size || 18 });
  }

  function comboMultiplier() {
    return Math.min(COMBO.max, 1 + Math.min(state.combo, 20) * COMBO.perKill);
  }

  function waveComposition(wave) {
    const weights = [['mote', 10]];
    if (wave >= 2) weights.push(['skitter', 6]);
    if (wave >= 3) weights.push(['spitter', 4]);
    if (wave >= 4) weights.push(['wisp', 4]);
    if (wave >= 6) weights.push(['brute', 3]);
    let total = 0;
    for (const [, w] of weights) total += w;
    const queue = [];
    const count = WAVES.count(wave);
    for (let i = 0; i < count; i += 1) {
      let roll = random() * total;
      let kind = 'mote';
      for (const [k, w] of weights) {
        roll -= w;
        if (roll <= 0) {
          kind = k;
          break;
        }
      }
      queue.push(kind);
    }
    return queue;
  }

  function spawnEnemy(kind, x, y) {
    const def = ENEMIES[kind];
    const isBoss = kind === 'boss';
    const final = isBoss && state.wave === 10;
    const enemy = {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: final ? BOSS_FINAL.hp : def.hp,
      maxHp: final ? BOSS_FINAL.hp : def.hp,
      radius: def.radius,
      speed: final ? BOSS_FINAL.speed : def.speed,
      touch: def.touch,
      score: final ? BOSS_FINAL.score : def.score,
      embers: def.embers,
      shootTimer: def.shootEvery ? range(random, 1.2, def.shootEvery) : 0,
      blinkTimer: def.blinkEvery ? range(random, 1.5, def.blinkEvery) : 0,
      phase: random() * Math.PI * 2,
      flash: 0,
      wander: false,
      enraged: false,
      burstTimer: 3,
      summonTimer: 6,
      chargeState: 0,
      chargeTimer: 0,
      chargeX: 0,
      chargeY: 0,
    };
    state.enemies.push(enemy);
    if (isBoss) {
      state.boss = enemy;
      addParticles(x, y, '#ff2e4d', 40, 260, 0.9, 4);
      state.shake = Math.max(state.shake, 16);
    }
    return enemy;
  }

  function spawnAtEdge(kind) {
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const edge = Math.floor(random() * 4);
      if (edge === 0) {
        x = range(random, 60, FIELD.width - 60);
        y = WALL + 10;
      } else if (edge === 1) {
        x = FIELD.width - WALL - 10;
        y = range(random, 80, FIELD.height - 60);
      } else if (edge === 2) {
        x = range(random, 60, FIELD.width - 60);
        y = FIELD.height - WALL - 10;
      } else {
        x = WALL + 10;
        y = range(random, 80, FIELD.height - 60);
      }
      if (dist2(x, y, player.x, player.y) > 260 * 260) break;
    }
    return spawnEnemy(kind, x, y);
  }

  function beginWave(wave) {
    state.wave = wave;
    state.phase = PHASE_FIGHT;
    state.waveTime = 0;
    state.spawnQueue = waveComposition(wave);
    if (WAVES.bossWaves.includes(wave)) {
      state.spawnQueue.unshift('boss');
      state.spawnQueue.length = Math.max(1, state.spawnQueue.length - 4);
    }
    state.spawnTimer = 1.0;
    state.banner = WAVES.bossWaves.includes(wave) ? `WAVE ${wave} — THE GLOOM HERALD` : `WAVE ${wave}`;
    state.bannerTimer = 2.5;
  }

  function startRun() {
    reset();
    beginWave(1);
  }

  function rollBlessings() {
    const available = BLESSINGS.filter((b) => (state.blessingLevels[b.id] || 0) < b.max);
    for (let i = available.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = available[i];
      available[i] = available[j];
      available[j] = tmp;
    }
    const picks = available.slice(0, 3);
    while (picks.length < 3) picks.push(BLESSING_FALLBACKS[picks.length - available.length] || BLESSING_FALLBACKS[0]);
    state.blessings = picks.map((b) => ({ ...b, level: state.blessingLevels[b.id] || 0 }));
  }

  function applyBlessing(def) {
    const id = def.id;
    state.blessingLevels[id] = (state.blessingLevels[id] || 0) + 1;
    if (id === 'ember-rounds') player.damage *= 1.25;
    else if (id === 'swift-hands') player.fireRate *= 1.18;
    else if (id === 'twin-lantern') player.shots += 1;
    else if (id === 'windstep') player.speed *= 1.12;
    else if (id === 'heartwood') {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    } else if (id === 'piercing-light') player.pierce += 1;
    else if (id === 'ember-magnet') player.magnet *= 1.7;
    else if (id === 'aegis') {
      player.shieldMax += 1;
      player.shield = player.shieldMax;
    } else if (id === 'ember-hoard') state.score += 500;
    else if (id === 'mend') player.hp = Math.min(player.maxHp, player.hp + 40);
  }

  function chooseBlessing(index) {
    if (state.phase !== PHASE_BLESSING) return false;
    const def = state.blessings[index];
    if (!def) return false;
    applyBlessing(def);
    state.blessings = [];
    beginWave(state.wave + 1);
    return true;
  }

  function dropPickups(enemy) {
    for (let i = 0; i < enemy.embers; i += 1) {
      const angle = random() * Math.PI * 2;
      state.pickups.push({
        kind: 'ember',
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * range(random, 40, 130),
        vy: Math.sin(angle) * range(random, 40, 130),
        life: 12,
      });
    }
    const heartChance = enemy.kind === 'brute' ? DROPS.bruteHeartChance : DROPS.heartChance;
    if (enemy.kind === 'boss' || random() < heartChance) {
      state.pickups.push({
        kind: 'heart',
        x: enemy.x,
        y: enemy.y,
        vx: range(random, -60, 60),
        vy: range(random, -60, 60),
        life: 12,
      });
    }
  }

  function killEnemy(enemy, index) {
    const gained = Math.round(enemy.score * comboMultiplier());
    state.score += gained;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.kills += 1;
    addText(enemy.x, enemy.y - enemy.radius, `+${gained}`, '#ffc94d', enemy.kind === 'boss' ? 30 : 18);
    const colors = { mote: '#8b7bd8', skitter: '#ff5e8a', spitter: '#7ee081', wisp: '#cfe8ff', brute: '#ff7a45', boss: '#ff2e4d' };
    addParticles(enemy.x, enemy.y, colors[enemy.kind] || '#ffffff', enemy.kind === 'boss' ? 60 : 14, enemy.kind === 'boss' ? 380 : 220, 0.8, 4);
    dropPickups(enemy);
    state.enemies.splice(index, 1);
    if (enemy.kind === 'boss') {
      state.boss = null;
      state.shake = Math.max(state.shake, 22);
      addParticles(enemy.x, enemy.y, '#ffe08a', 50, 420, 1.2, 5);
      return EVENT_BOSS_DEAD;
    }
    return EVENT_KILL;
  }

  function hurtPlayer(damage) {
    if (player.invuln > 0 || !player.alive) return 0;
    if (player.shield > 0) {
      player.shield -= 1;
      player.invuln = 0.8;
      addParticles(player.x, player.y, '#7ee8ff', 18, 240, 0.6, 3);
      return EVENT_SHIELD;
    }
    player.hp -= damage;
    player.invuln = PLAYER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, 14);
    addParticles(player.x, player.y, '#ff5e5e', 22, 280, 0.7, 4);
    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      state.phase = PHASE_OVER;
      addParticles(player.x, player.y, '#ffd27a', 70, 380, 1.4, 5);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function fireBullets(aimX, aimY) {
    const surge = state.surgeTimer > 0;
    const rate = player.fireRate * (surge ? SURGE.rateMul : 1);
    player.fireTimer = 1 / rate;
    const baseAngle = Math.atan2(aimY - player.y, aimX - player.x);
    player.angle = baseAngle;
    const damage = player.damage * (surge ? SURGE.damageMul : 1);
    const mid = (player.shots - 1) / 2;
    for (let i = 0; i < player.shots; i += 1) {
      const angle = baseAngle + (i - mid) * BULLET.spread;
      state.bullets.push({
        x: player.x + Math.cos(angle) * (player.radius + 6),
        y: player.y + Math.sin(angle) * (player.radius + 6),
        vx: Math.cos(angle) * PLAYER.bulletSpeed,
        vy: Math.sin(angle) * PLAYER.bulletSpeed,
        damage,
        pierce: player.pierce,
        life: BULLET.life,
        struck: [],
      });
    }
    state.stats.shotsFired += 1;
    addParticles(
      player.x + Math.cos(baseAngle) * (player.radius + 8),
      player.y + Math.sin(baseAngle) * (player.radius + 8),
      '#ffcf5e',
      2,
      90,
      0.25,
      3,
    );
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
  }

  function stepIdle(dt) {
    state.ambientTimer -= dt;
    if (state.ambientTimer <= 0 && state.enemies.length < 6) {
      const mote = spawnEnemy('mote', range(random, 120, FIELD.width - 120), range(random, 140, FIELD.height - 120));
      mote.wander = true;
      const angle = random() * Math.PI * 2;
      mote.vx = Math.cos(angle) * 34;
      mote.vy = Math.sin(angle) * 34;
      state.ambientTimer = 1.4;
    }
    for (const e of state.enemies) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.x < WALL || e.x > FIELD.width - WALL) e.vx *= -1;
      if (e.y < 90 || e.y > FIELD.height - WALL) e.vy *= -1;
      e.phase += dt;
    }
  }

  function stepFight(dt, control, harmless) {
    let events = 0;
    state.waveTime += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.surgeTimer > 0) state.surgeTimer -= dt;
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    if (player.fireTimer > 0) player.fireTimer -= dt;

    // Movement.
    let mx = control.mx || 0;
    let my = control.my || 0;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    player.x = Math.min(FIELD.width - WALL, Math.max(WALL, player.x + mx * player.speed * dt));
    player.y = Math.min(FIELD.height - WALL, Math.max(WALL, player.y + my * player.speed * dt));

    // Firing.
    if (control.firing && player.alive && player.fireTimer <= 0) {
      fireBullets(control.aimX, control.aimY);
    } else if (control.firing) {
      player.angle = Math.atan2(control.aimY - player.y, control.aimX - player.x);
    }

    // Spawning.
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const kind = state.spawnQueue.shift();
        if (kind === 'boss') {
          spawnEnemy('boss', FIELD.width / 2, 130);
          events |= EVENT_BOSS;
        } else {
          spawnAtEdge(kind);
        }
        state.spawnTimer = WAVES.spawnInterval(state.wave);
      }
    }

    // Player bullets.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > FIELD.width || b.y < 0 || b.y > FIELD.height;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const e = state.enemies[j];
          if (b.struck.includes(e)) continue;
          const rr = e.radius + BULLET.radius;
          if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
            b.struck.push(e);
            e.hp -= b.damage;
            e.flash = 0.09;
            state.stats.hits += 1;
            const kb = e.kind === 'brute' ? 26 : e.kind === 'boss' ? 6 : 150;
            const d = Math.max(1, Math.hypot(b.vx, b.vy));
            e.vx += (b.vx / d) * kb;
            e.vy += (b.vy / d) * kb;
            addParticles(b.x, b.y, '#ffcf5e', 3, 140, 0.3, 3);
            if (e.hp <= 0) {
              events |= killEnemy(e, j);
            }
            if (b.pierce > 0) {
              b.pierce -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // Enemies.
    for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
      const e = state.enemies[j];
      if (e.flash > 0) e.flash -= dt;
      e.phase += dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / d;
      const ny = dy / d;
      // Knockback velocity decays.
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vx *= 1 - 6 * dt;
      e.vy *= 1 - 6 * dt;

      if (e.kind === 'mote') {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      } else if (e.kind === 'skitter') {
        const wobble = Math.sin(e.phase * 6) * 0.9;
        e.x += (nx - ny * wobble) * e.speed * dt;
        e.y += (ny + nx * wobble) * e.speed * dt;
      } else if (e.kind === 'spitter') {
        if (d > 300) {
          e.x += nx * e.speed * dt;
          e.y += ny * e.speed * dt;
        } else if (d < 220) {
          e.x -= nx * e.speed * dt;
          e.y -= ny * e.speed * dt;
        } else {
          e.x += -ny * e.speed * 0.6 * dt;
          e.y += nx * e.speed * 0.6 * dt;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && player.alive) {
          e.shootTimer = ENEMIES.spitter.shootEvery + random() * 0.5;
          state.orbs.push({
            x: e.x,
            y: e.y,
            vx: nx * ORB.speed,
            vy: ny * ORB.speed,
            damage: 8,
            life: ORB.life,
          });
          addParticles(e.x, e.y, '#c26bff', 4, 120, 0.3, 3);
        }
      } else if (e.kind === 'wisp') {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
        e.blinkTimer -= dt;
        if (e.blinkTimer <= 0) {
          addParticles(e.x, e.y, '#cfe8ff', 10, 160, 0.5, 3);
          e.x = player.x - nx * 130 + range(random, -50, 50);
          e.y = player.y - ny * 130 + range(random, -50, 50);
          e.x = Math.min(FIELD.width - WALL, Math.max(WALL, e.x));
          e.y = Math.min(FIELD.height - WALL, Math.max(WALL, e.y));
          addParticles(e.x, e.y, '#cfe8ff', 10, 160, 0.5, 3);
          e.blinkTimer = ENEMIES.wisp.blinkEvery + random();
        }
      } else if (e.kind === 'brute') {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      } else if (e.kind === 'boss') {
        if (!e.enraged && e.hp < e.maxHp * 0.5) {
          e.enraged = true;
          e.speed *= 1.35;
          events |= EVENT_ENRAGE;
          addParticles(e.x, e.y, '#ff2e4d', 40, 320, 0.9, 4);
          state.shake = Math.max(state.shake, 14);
        }
        e.burstTimer -= dt;
        e.summonTimer -= dt;
        if (e.chargeState === 1) {
          e.chargeTimer -= dt;
          if (e.chargeTimer <= 0) {
            e.chargeState = 2;
            e.chargeTimer = 0.5;
            const cd = Math.max(1, Math.hypot(e.chargeX - e.x, e.chargeY - e.y));
            e.vx = ((e.chargeX - e.x) / cd) * 520;
            e.vy = ((e.chargeY - e.y) / cd) * 520;
          }
        } else if (e.chargeState === 2) {
          e.chargeTimer -= dt;
          if (e.chargeTimer <= 0) {
            e.chargeState = 0;
            e.vx = 0;
            e.vy = 0;
          }
        } else {
          e.x += nx * e.speed * dt;
          e.y += ny * e.speed * dt;
          if (e.burstTimer <= 0) {
            e.burstTimer = e.enraged ? 2.8 : 3.6;
            const count = e.enraged ? 16 : 12;
            for (let k = 0; k < count; k += 1) {
              const angle = (k / count) * Math.PI * 2 + e.phase * 0.3;
              state.orbs.push({
                x: e.x,
                y: e.y,
                vx: Math.cos(angle) * ORB.speed,
                vy: Math.sin(angle) * ORB.speed,
                damage: 10,
                life: ORB.life,
              });
            }
            addParticles(e.x, e.y, '#ff2e4d', 12, 200, 0.4, 3);
          }
          if (e.summonTimer <= 0) {
            e.summonTimer = 7;
            for (let k = 0; k < 3; k += 1) {
              const angle = random() * Math.PI * 2;
              spawnEnemy('mote', e.x + Math.cos(angle) * 70, e.y + Math.sin(angle) * 70);
            }
          }
          const chargeEvery = e.enraged ? 6 : 9;
          if (state.waveTime > 4 && Math.floor(state.waveTime / chargeEvery) !== Math.floor((state.waveTime - dt) / chargeEvery)) {
            e.chargeState = 1;
            e.chargeTimer = 0.7;
            e.chargeX = player.x;
            e.chargeY = player.y;
          }
        }
      }

      // Shades stay inside the arena, so the boss never slides half off-screen.
      e.x = Math.min(FIELD.width - WALL - e.radius, Math.max(WALL + e.radius, e.x));
      e.y = Math.min(FIELD.height - WALL - e.radius, Math.max(WALL + e.radius, e.y));

      // Touch damage.
      if (player.alive && !harmless) {
        const rr = e.radius + player.radius - 2;
        if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
          events |= hurtPlayer(e.touch);
          if (!player.alive) break;
        }
      }
    }

    // Enemy separation so shades do not stack on one point.
    for (let a = 0; a < state.enemies.length; a += 1) {
      for (let b = a + 1; b < state.enemies.length; b += 1) {
        const ea = state.enemies[a];
        const eb = state.enemies[b];
        const rr = ea.radius + eb.radius;
        const d2 = dist2(ea.x, ea.y, eb.x, eb.y);
        if (d2 < rr * rr && d2 > 0.01) {
          const dd = Math.sqrt(d2);
          const push = (rr - dd) / 2;
          const ux = (eb.x - ea.x) / dd;
          const uy = (eb.y - ea.y) / dd;
          ea.x -= ux * push;
          ea.y -= uy * push;
          eb.x += ux * push;
          eb.y += uy * push;
        }
      }
    }

    // Enemy orbs.
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const o = state.orbs[i];
      o.life -= dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      let dead = o.life <= 0 || o.x < 0 || o.x > FIELD.width || o.y < 0 || o.y > FIELD.height;
      if (!dead && player.alive && !harmless) {
        const rr = o.damage && ORB.radius + player.radius - 2;
        if (dist2(o.x, o.y, player.x, player.y) < rr * rr) {
          events |= hurtPlayer(o.damage);
          dead = true;
        }
      }
      if (dead) state.orbs.splice(i, 1);
    }

    // Pickups.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const p = state.pickups[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
      const d = Math.max(1, Math.hypot(player.x - p.x, player.y - p.y));
      if (player.alive && d < player.magnet) {
        const pull = 620 * (1 - d / player.magnet) + 120;
        p.x += ((player.x - p.x) / d) * pull * dt;
        p.y += ((player.y - p.y) / d) * pull * dt;
      }
      if (player.alive && d < player.radius + 12) {
        if (p.kind === 'ember') {
          state.score += DROPS.emberScore;
          state.embers += 1;
          state.surgeProgress += 1;
          addParticles(p.x, p.y, '#ffb347', 6, 160, 0.4, 3);
          events |= EVENT_PICKUP;
          if (state.surgeProgress >= SURGE.embers && state.surgeTimer <= 0) {
            state.surgeProgress = 0;
            state.surgeTimer = SURGE.seconds;
            addText(player.x, player.y - 30, 'LANTERN SURGE!', '#ffe08a', 24);
            events |= EVENT_SURGE;
          }
        } else {
          player.hp = Math.min(player.maxHp, player.hp + DROPS.heartHeal);
          addText(p.x, p.y - 10, `+${DROPS.heartHeal} HP`, '#7ee081', 18);
          events |= EVENT_HEAL;
        }
        state.pickups.splice(i, 1);
      }
    }

    // Wave cleared?
    if (player.alive && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      state.stats.wavesCleared += 1;
      if (state.wave >= WAVES.total) {
        state.phase = PHASE_WON;
        events |= EVENT_WON;
      } else {
        state.phase = PHASE_BLESSING;
        player.shield = player.shieldMax;
        rollBlessings();
        events |= EVENT_WAVE_CLEAR;
      }
    }
    return events;
  }

  /**
   * One fixed step. `control` is {mx, my, aimX, aimY, firing} in logical
   * coordinates; pass null outside a fight. With `harmless` set, shades drift
   * but nothing touches the player and nothing scores (the title backdrop).
   */
  function step(dt, control, harmless) {
    state.time += dt;
    updateParticles(dt);
    state.shake = Math.max(0, state.shake - dt * 36);
    if (state.phase === PHASE_IDLE) {
      stepIdle(dt);
      return 0;
    }
    if (state.phase !== PHASE_FIGHT) return 0;
    return stepFight(dt, control || { mx: 0, my: 0, aimX: player.x + 1, aimY: player.y, firing: false }, harmless);
  }

  reset();
  return { state, reset, startRun, beginWave, chooseBlessing, rollBlessings, step };
}

// Re-exported so headless runs can stage scenes without a browser.
export { STEP };
