// Emberlight — every tuning number and colour in one place.
//
// The playfield is a fixed 1280x720 logical area. The renderer scales it to the
// window, so no rule below depends on the screen size. All balance lives here so
// a wave, an enemy or a blessing can be retuned without touching the rules.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The seed the screenshot scenes use, so every staged frame repeats exactly. */
export const SHOT_SEED = 7;

export const PLAYER = {
  radius: 16,
  speed: 250,
  maxHp: 100,
  fireRate: 4.2,
  damage: 10,
  bulletSpeed: 640,
  shots: 1,
  pierce: 0,
  magnet: 100,
  invulnerable: 1.0,
  shieldMax: 0,
};

export const BULLET = { radius: 5, life: 1.2, spread: 0.14 };

/** Enemy bullets (spitter orbs and the boss's bursts). */
export const ORB = { radius: 6, speed: 190, life: 6 };

/** Enemy kinds, keyed by the id world.js spawns. */
export const ENEMIES = {
  mote: { hp: 12, speed: 62, radius: 13, touch: 8, score: 50, embers: 1 },
  skitter: { hp: 10, speed: 135, radius: 11, touch: 8, score: 80, embers: 1 },
  spitter: { hp: 18, speed: 78, radius: 14, touch: 8, score: 120, embers: 2, shootEvery: 2.4 },
  wisp: { hp: 16, speed: 95, radius: 12, touch: 10, score: 150, embers: 2, blinkEvery: 3.2 },
  brute: { hp: 70, speed: 40, radius: 26, touch: 16, score: 250, embers: 3 },
  boss: { hp: 950, speed: 46, radius: 48, touch: 20, score: 2000, embers: 12 },
};

/** The wave-10 boss is tougher than the wave-5 one. */
export const BOSS_FINAL = { hp: 1700, speed: 52, score: 5000 };

/** Waves: how many shades each wave sends, and when each kind joins the mix. */
export const WAVES = {
  total: 10,
  bossWaves: [5, 10],
  count: (wave) => Math.min(40, 8 + 5 * (wave - 1)),
  /** Seconds between spawns while a wave is still sending shades in. */
  spawnInterval: (wave) => Math.max(0.35, 0.9 - wave * 0.04),
};

/** Combo: each kill inside the window raises the multiplier, up to x3. */
export const COMBO = { window: 2.5, perKill: 0.1, max: 3.0 };

/** Embers: collect this many to light the Lantern Surge for this long. */
export const SURGE = { embers: 12, seconds: 8, damageMul: 2, rateMul: 1.5 };

/** Pickups: what a slain shade drops, and how a heart heals. */
export const DROPS = { heartChance: 0.04, bruteHeartChance: 0.15, heartHeal: 12, emberScore: 25 };

/** Blessings offered between waves: id, name, flavour, max level, and what a level does. */
export const BLESSINGS = [
  { id: 'ember-rounds', name: 'Ember Rounds', desc: '+25% bullet damage', max: 5 },
  { id: 'swift-hands', name: 'Swift Hands', desc: '+18% fire rate', max: 5 },
  { id: 'twin-lantern', name: 'Twin Lantern', desc: '+1 projectile per shot', max: 3 },
  { id: 'windstep', name: 'Windstep', desc: '+12% move speed', max: 5 },
  { id: 'heartwood', name: 'Heartwood', desc: '+25 max HP and heal 25', max: 5 },
  { id: 'piercing-light', name: 'Piercing Light', desc: 'Bullets pierce +1 shade', max: 3 },
  { id: 'ember-magnet', name: 'Ember Magnet', desc: '+70% ember pickup radius', max: 4 },
  { id: 'aegis', name: 'Aegis Shield', desc: '+1 shield charge, recharged each wave', max: 3 },
];
/** Fallbacks when every blessing is maxed out. */
export const BLESSING_FALLBACKS = [
  { id: 'ember-hoard', name: 'Ember Hoard', desc: '+500 score, right now', max: 99 },
  { id: 'mend', name: 'Mend', desc: 'Heal 40 HP', max: 99 },
];

/** The three blessing cards on the between-waves panel, in logical coordinates. */
export const BLESSING_CARDS = [
  { x: 170, y: 300, w: 280, h: 190 },
  { x: 500, y: 300, w: 280, h: 190 },
  { x: 830, y: 300, w: 280, h: 190 },
];

export const PALETTE = {
  backdrop: '#0a0a14',
  skyTop: '#171233',
  skyBottom: '#0b0918',
  ground: '#141126',
  arenaEdge: '#2c2350',
  rock: '#3a3357',
  rockRim: '#5a4f86',
  pillar: '#2e2847',
  pillarTop: '#453d68',
  lanternPost: '#241f3d',
  lanternGlow: '#ffb347',
  ember: '#ff9d2e',
  emberCore: '#ffe08a',
  player: '#ffd27a',
  playerCloak: '#7a5cff',
  playerCloakDark: '#4a34a8',
  bullet: '#ffcf5e',
  orb: '#c26bff',
  mote: '#8b7bd8',
  moteEye: '#ffe9a8',
  skitter: '#ff5e8a',
  spitter: '#7ee081',
  spitterBelly: '#2f6b34',
  wisp: '#cfe8ff',
  brute: '#ff7a45',
  bruteRock: '#5c3a2e',
  boss: '#2a0e2e',
  bossCore: '#ff2e4d',
  bossSpike: '#7a1f3d',
  heart: '#ff4d6d',
  panel: '#1b1533',
  panelEdge: '#4a3f7d',
  text: '#f2ecff',
  muted: '#a89fd0',
  gold: '#ffc94d',
  danger: '#ff5e5e',
  heal: '#7ee081',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberlight.best';
