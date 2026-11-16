// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Everything is drawn with gradients, glow and layered
// shapes: lantern light pools on a ruined arena floor, each shade kind with its
// own silhouette, the keeper's lantern throwing a warm cone toward the aim.

import { BLESSING_CARDS, FIELD, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BLESSING = 'blessing';
export const SCREEN_WON = 'won';

const PANEL = { width: 640, line: 32, bottom: 64 };

/** Deterministic wobble from the world's clock (never Math.random: a staged frame must repaint identically). */
function wobble(time, seed) {
  return Math.sin(time * 2.1 + seed * 1.7) * 0.5 + Math.sin(time * 3.7 + seed) * 0.5;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Convert client (CSS) pixels to logical field coordinates. */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
      y: (clientY - rect.top - view.y / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
    };
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function circle(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
  }

  function glowCircle(x, y, r, color, alpha) {
    const g = context.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = alpha;
    context.fillStyle = g;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawDecorations(state) {
    const d = state.decorations;
    const t = state.time;
    // Ground embers: tiny lights breathing on the floor.
    for (const g of d.groundEmbers) {
      const a = 0.35 + 0.3 * Math.sin(t * 1.6 + g.phase);
      context.globalAlpha = a;
      circle(g.x, g.y, g.size, PALETTE.ember);
      context.globalAlpha = 1;
    }
    // Rocks: dark polygons with a lit rim on the lantern side.
    for (const rock of d.rocks) {
      context.fillStyle = PALETTE.rock;
      context.beginPath();
      for (let i = 0; i < rock.points; i += 1) {
        const angle = (i / rock.points) * Math.PI * 2;
        const rr = rock.r * (0.75 + 0.25 * Math.sin(rock.seed + i * 2.3));
        const px = rock.x + Math.cos(angle) * rr;
        const py = rock.y + Math.sin(angle) * rr;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.strokeStyle = PALETTE.rockRim;
      context.lineWidth = 2;
      context.stroke();
    }
    // Ruined pillars: broken columns, their tops catching the light.
    for (const p of d.pillars) {
      const h = p.broken ? p.h * 0.55 : p.h;
      context.fillStyle = PALETTE.pillar;
      context.fillRect(p.x - p.w / 2, p.y - h / 2, p.w, h);
      context.fillStyle = PALETTE.pillarTop;
      context.fillRect(p.x - p.w / 2 - 3, p.y - h / 2 - 5, p.w + 6, 8);
      context.fillStyle = 'rgba(255,179,71,0.12)';
      context.fillRect(p.x - p.w / 2, p.y - h / 2, 4, h);
    }
    // Lantern posts: a post, a glowing orb, and a pool of warm light.
    for (const lamp of d.lanterns) {
      const flicker = 0.75 + 0.25 * Math.sin(t * 5 + lamp.phase) * Math.sin(t * 2.3 + lamp.phase);
      glowCircle(lamp.x, lamp.y - 26, 90 * flicker, 'rgba(255,179,71,0.55)', 0.5);
      context.fillStyle = PALETTE.lanternPost;
      context.fillRect(lamp.x - 3, lamp.y - 26, 6, 30);
      circle(lamp.x, lamp.y - 30, 9, PALETTE.lanternGlow);
      circle(lamp.x, lamp.y - 30, 4.5, PALETTE.emberCore);
    }
  }

  function drawField(state) {
    const sky = context.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Arena edge: a faint boundary ring.
    context.strokeStyle = PALETTE.arenaEdge;
    context.lineWidth = 3;
    context.strokeRect(28, 28, FIELD.width - 56, FIELD.height - 56);
    drawDecorations(state);

    // Pickups.
    for (const p of state.pickups) {
      const blink = p.life < 3 ? (Math.floor(p.life * 6) % 2 === 0 ? 1 : 0.35) : 1;
      context.globalAlpha = blink;
      if (p.kind === 'ember') {
        glowCircle(p.x, p.y, 22, 'rgba(255,157,46,0.6)', 0.8);
        context.fillStyle = PALETTE.ember;
        context.beginPath();
        context.moveTo(p.x, p.y - 9);
        context.lineTo(p.x + 7, p.y);
        context.lineTo(p.x, p.y + 9);
        context.lineTo(p.x - 7, p.y);
        context.closePath();
        context.fill();
        circle(p.x, p.y, 3, PALETTE.emberCore);
      } else {
        glowCircle(p.x, p.y, 24, 'rgba(255,77,109,0.6)', 0.8);
        context.fillStyle = PALETTE.heart;
        context.beginPath();
        context.moveTo(p.x, p.y + 8);
        context.bezierCurveTo(p.x - 12, p.y - 2, p.x - 7, p.y - 11, p.x, p.y - 4);
        context.bezierCurveTo(p.x + 7, p.y - 11, p.x + 12, p.y - 2, p.x, p.y + 8);
        context.fill();
      }
      context.globalAlpha = 1;
    }

    // Enemy bullets: violet orbs with a glow.
    for (const o of state.orbs) {
      glowCircle(o.x, o.y, 20, 'rgba(194,107,255,0.55)', 0.8);
      circle(o.x, o.y, 6, PALETTE.orb);
      circle(o.x - 2, o.y - 2, 2.5, '#eadcff');
    }

    // Enemies, each kind with its own silhouette.
    for (const e of state.enemies) {
      drawEnemy(e, state.time);
    }

    // Player bullets: glowing ember streaks.
    context.lineCap = 'round';
    for (const b of state.bullets) {
      const tail = 14;
      const d = Math.max(1, Math.hypot(b.vx, b.vy));
      const tx = b.x - (b.vx / d) * tail;
      const ty = b.y - (b.vy / d) * tail;
      const grad = context.createLinearGradient(b.x, b.y, tx, ty);
      grad.addColorStop(0, '#fff3c4');
      grad.addColorStop(1, 'rgba(255,157,46,0)');
      context.strokeStyle = grad;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(b.x, b.y);
      context.lineTo(tx, ty);
      context.stroke();
      circle(b.x, b.y, 3.5, PALETTE.bullet);
    }

    // Particles, additively so embers and bursts glow.
    context.globalCompositeOperation = 'lighter';
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      circle(p.x, p.y, p.size, p.color);
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';

    // Floating score text.
    for (const t of state.texts) {
      context.globalAlpha = Math.max(0, Math.min(1, t.life / t.maxLife));
      text(t.text, t.x, t.y, t.size, '#ffffff', 'center', '700');
      context.globalAlpha = 1;
    }

    // The keeper, when alive.
    const pl = state.player;
    if (pl.alive) drawPlayer(state);

    // Vignette: dark corners pull the eye to the arena.
    const vig = context.createRadialGradient(640, 360, 320, 640, 360, 760);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(4,2,12,0.55)');
    context.fillStyle = vig;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawPlayer(state) {
    const pl = state.player;
    const t = state.time;
    const blink = pl.invuln > 0 && Math.floor(pl.invuln * 12) % 2 === 0;
    if (blink) return;
    // Warm light around the lantern.
    const flicker = 0.9 + 0.1 * Math.sin(t * 6);
    glowCircle(pl.x, pl.y, 120 * flicker, 'rgba(255,179,71,0.4)', 0.55);
    // Aim cone: a soft wedge of light toward the mouse.
    context.save();
    context.translate(pl.x, pl.y);
    context.rotate(pl.angle);
    const cone = context.createLinearGradient(0, 0, 190, 0);
    cone.addColorStop(0, 'rgba(255,210,122,0.28)');
    cone.addColorStop(1, 'rgba(255,210,122,0)');
    context.fillStyle = cone;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(190, -26);
    context.lineTo(190, 26);
    context.closePath();
    context.fill();
    context.restore();
    // Cloak: a hooded figure, violet with a gold trim.
    const cloak = context.createLinearGradient(pl.x, pl.y - 18, pl.x, pl.y + 18);
    cloak.addColorStop(0, PALETTE.playerCloak);
    cloak.addColorStop(1, PALETTE.playerCloakDark);
    context.fillStyle = cloak;
    context.beginPath();
    context.moveTo(pl.x, pl.y - 18);
    context.quadraticCurveTo(pl.x + 16, pl.y, pl.x + 12, pl.y + 16);
    context.quadraticCurveTo(pl.x, pl.y + 20, pl.x - 12, pl.y + 16);
    context.quadraticCurveTo(pl.x - 16, pl.y, pl.x, pl.y - 18);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 1.5;
    context.stroke();
    // Face: a warm glow under the hood.
    circle(pl.x, pl.y - 4, 6.5, '#ffe9b0');
    circle(pl.x - 2.5, pl.y - 5, 1.2, '#2a1a4d');
    circle(pl.x + 2.5, pl.y - 5, 1.2, '#2a1a4d');
    // The lantern, held toward the aim.
    const lx = pl.x + Math.cos(pl.angle) * 20;
    const ly = pl.y + Math.sin(pl.angle) * 20;
    glowCircle(lx, ly, 26, 'rgba(255,179,71,0.8)', 0.9);
    context.fillStyle = '#3a2c12';
    context.fillRect(lx - 5, ly - 8, 10, 16);
    circle(lx, ly, 5.5, PALETTE.emberCore);
    // Shield ring when a charge is ready.
    if (pl.shield > 0) {
      context.strokeStyle = 'rgba(126,232,255,0.85)';
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(pl.x, pl.y, 26 + wobble(t, 3) * 2, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawEnemy(e, time) {
    const flash = e.flash > 0;
    const body = flash ? '#ffffff' : null;
    const bob = wobble(time, e.phase) * 2;
    const x = e.x;
    const y = e.y + bob;
    if (e.kind === 'mote') {
      glowCircle(x, y, e.radius * 2.2, 'rgba(139,123,216,0.35)', 0.7);
      const g = context.createRadialGradient(x - 4, y - 5, 2, x, y, e.radius);
      g.addColorStop(0, body || '#a99ae8');
      g.addColorStop(1, body || '#4a3a8a');
      context.fillStyle = g;
      context.beginPath();
      context.arc(x, y, e.radius, 0, Math.PI * 2);
      context.fill();
      circle(x - 4.5, y - 2, 2.4, PALETTE.moteEye);
      circle(x + 4.5, y - 2, 2.4, PALETTE.moteEye);
    } else if (e.kind === 'skitter') {
      context.fillStyle = body || PALETTE.skitter;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + time * 2 + e.phase;
        const rr = i % 2 === 0 ? e.radius + 6 : e.radius - 3;
        const px = x + Math.cos(angle) * rr;
        const py = y + Math.sin(angle) * rr;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      circle(x, y, 4, '#2a0a18');
    } else if (e.kind === 'spitter') {
      glowCircle(x, y, e.radius * 2, 'rgba(126,224,129,0.3)', 0.6);
      context.fillStyle = body || PALETTE.spitter;
      context.beginPath();
      context.moveTo(x, y - e.radius);
      context.lineTo(x + e.radius, y);
      context.lineTo(x, y + e.radius);
      context.lineTo(x - e.radius, y);
      context.closePath();
      context.fill();
      context.fillStyle = body || PALETTE.spitterBelly;
      context.beginPath();
      context.arc(x, y + 3, 6, 0, Math.PI * 2);
      context.fill();
      circle(x - 4, y - 4, 2, '#0e2a12');
      circle(x + 4, y - 4, 2, '#0e2a12');
    } else if (e.kind === 'wisp') {
      context.globalAlpha = 0.55 + 0.3 * Math.sin(time * 3 + e.phase);
      const g = context.createRadialGradient(x, y - 6, 2, x, y, e.radius + 8);
      g.addColorStop(0, body || '#ffffff');
      g.addColorStop(1, body || 'rgba(207,232,255,0.15)');
      context.fillStyle = g;
      context.beginPath();
      context.arc(x, y, e.radius, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x - e.radius * 0.8, y + 4);
      context.quadraticCurveTo(x - e.radius * 0.4, y + e.radius + 6 + bob * 2, x, y + e.radius * 0.7);
      context.quadraticCurveTo(x + e.radius * 0.4, y + e.radius + 6 - bob * 2, x + e.radius * 0.8, y + 4);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
      circle(x - 4, y - 2, 2, '#1c2a44');
      circle(x + 4, y - 2, 2, '#1c2a44');
    } else if (e.kind === 'brute') {
      glowCircle(x, y, e.radius * 1.8, 'rgba(255,122,69,0.3)', 0.6);
      context.fillStyle = body || PALETTE.bruteRock;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + 0.5;
        const px = x + Math.cos(angle) * e.radius;
        const py = y + Math.sin(angle) * e.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.fillStyle = body || PALETTE.brute;
      context.beginPath();
      context.arc(x, y, e.radius * 0.62, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#3d1408';
      context.beginPath();
      context.moveTo(x - 10, y - 4);
      context.lineTo(x - 2, y + 2);
      context.lineTo(x - 10, y + 8);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(x + 10, y - 4);
      context.lineTo(x + 2, y + 2);
      context.lineTo(x + 10, y + 8);
      context.closePath();
      context.fill();
    } else if (e.kind === 'boss') {
      drawBoss(e, time, body);
    }
    // A thin health arc over anything hurt.
    if (e.hp < e.maxHp && e.kind !== 'boss') {
      context.strokeStyle = 'rgba(0,0,0,0.5)';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(x, y, e.radius + 7, 0, Math.PI * 2);
      context.stroke();
      context.strokeStyle = PALETTE.danger;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, e.radius + 7, -Math.PI / 2, -Math.PI / 2 + (e.hp / e.maxHp) * Math.PI * 2);
      context.stroke();
    }
  }

  function drawBoss(e, time, body) {
    const x = e.x;
    const y = e.y;
    const telegraph = e.chargeState === 1;
    const pulse = 1 + 0.04 * Math.sin(time * 4);
    glowCircle(x, y, e.radius * 2.6, telegraph ? 'rgba(255,46,77,0.55)' : 'rgba(255,46,77,0.3)', 0.8);
    // Crown of spikes, slowly turning.
    context.fillStyle = PALETTE.bossSpike;
    context.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2 + time * 0.4;
      const tip = e.radius + 16;
      const base = e.radius - 6;
      const a1 = angle - 0.12;
      const a2 = angle + 0.12;
      context.moveTo(x + Math.cos(a1) * base, y + Math.sin(a1) * base);
      context.lineTo(x + Math.cos(angle) * tip, y + Math.sin(angle) * tip);
      context.lineTo(x + Math.cos(a2) * base, y + Math.sin(a2) * base);
    }
    context.fill();
    // Body: a dark mass with a burning core. A hit flashes a white ring, never
    // a white body: the Herald must stay readable as the Herald.
    const g = context.createRadialGradient(x, y, 4, x, y, e.radius * pulse);
    g.addColorStop(0, PALETTE.bossCore);
    g.addColorStop(0.45, '#5c1030');
    g.addColorStop(1, PALETTE.boss);
    context.fillStyle = g;
    context.beginPath();
    context.arc(x, y, e.radius * pulse, 0, Math.PI * 2);
    context.fill();
    if (body) {
      context.strokeStyle = 'rgba(255,255,255,0.85)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, e.radius * pulse - 2, 0, Math.PI * 2);
      context.stroke();
    }
    // The core eye.
    circle(x, y, 13 + 2 * Math.sin(time * 5), '#ffd7de');
    circle(x, y, 6, '#3d0210');
    // Enrage: red ring.
    if (e.enraged) {
      context.strokeStyle = 'rgba(255,46,77,0.9)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, e.radius + 12, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawHud(state, screen) {
    const pl = state.player;
    context.textBaseline = 'top';
    // Top-left: score, combo, embers.
    text(`SCORE ${state.score}`, 28, 18, 26, PALETTE.text, 'left', '700');
    const mult = Math.min(3, 1 + Math.min(state.combo, 20) * 0.1);
    if (state.combo >= 2) {
      text(`COMBO x${mult.toFixed(1)}`, 28, 50, 20, PALETTE.gold, 'left', '700');
    }
    text(`EMBERS ${state.embers}`, 28, 76, 18, PALETTE.ember, 'left', '700');
    // Top-centre: wave.
    text(`WAVE ${Math.max(1, state.wave)} / 10`, FIELD.width / 2, 18, 26, PALETTE.text, 'center', '700');
    // Surge timer bar under the wave.
    if (state.surgeTimer > 0) {
      const w = 180;
      const x = FIELD.width / 2 - w / 2;
      context.fillStyle = 'rgba(0,0,0,0.5)';
      context.fillRect(x, 52, w, 10);
      context.fillStyle = PALETTE.ember;
      context.fillRect(x, 52, w * (state.surgeTimer / 8), 10);
      text('LANTERN SURGE', FIELD.width / 2, 66, 15, PALETTE.emberCore, 'center', '700');
    }
    // Top-right: HP bar.
    const barW = 220;
    const barX = FIELD.width - 28 - barW;
    text('HP', barX - 34, 18, 22, PALETTE.text, 'left', '700');
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(barX, 20, barW, 18);
    const hpGrad = context.createLinearGradient(barX, 0, barX + barW, 0);
    hpGrad.addColorStop(0, '#ff5e5e');
    hpGrad.addColorStop(1, '#ffb347');
    context.fillStyle = hpGrad;
    context.fillRect(barX, 20, barW * Math.max(0, pl.hp / pl.maxHp), 18);
    text(`${Math.ceil(pl.hp)} / ${pl.maxHp}`, barX + barW / 2, 22, 13, '#ffffff', 'center', '700');
    if (pl.shieldMax > 0) {
      text(`SHIELD ${'◆'.repeat(pl.shield)}${'◇'.repeat(pl.shieldMax - pl.shield)}`, FIELD.width - 28, 48, 16, '#7ee8ff', 'right', '700');
    }
    // Boss bar, bottom centre.
    const boss = state.boss;
    if (boss) {
      const bw = 460;
      const bx = FIELD.width / 2 - bw / 2;
      const by = FIELD.height - 46;
      text('GLOOM HERALD', FIELD.width / 2, by - 26, 18, '#ff8ba0', 'center', '700');
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(bx, by, bw, 16);
      const bg = context.createLinearGradient(bx, 0, bx + bw, 0);
      bg.addColorStop(0, '#ff2e4d');
      bg.addColorStop(1, '#ff7a45');
      context.fillStyle = bg;
      context.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 16);
      context.strokeStyle = '#ffb3c0';
      context.lineWidth = 1.5;
      context.strokeRect(bx, by, bw, 16);
    }
    // Wave banner.
    if (state.bannerTimer > 0 && screen === SCREEN_PLAY) {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      text(state.banner, FIELD.width / 2, 150, 44, PALETTE.gold, 'center', '800');
      context.globalAlpha = 1;
    }
    // Hints, bottom-right, small.
    text('WASD move · Mouse aim · Hold click to fire · P pause · M mute', FIELD.width - 24, FIELD.height - 24, 14, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = 150 + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5,3,14,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center', '800');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 132 + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 34, 23, PALETTE.gold, 'center', '700');
  }

  function drawTitle(state, best) {
    drawPanel(
      'EMBERLIGHT',
      ['Keeper of the Last Lantern', '', 'Survive 10 waves of shades. Slay the Gloom Herald.', 'WASD to move · Mouse to aim · Hold click to fire', 'Between waves, choose a blessing to grow stronger.', best > 0 ? `Best score ${best}` : 'The last lantern is yours to keep.'],
      'Press Space or click to begin',
      PALETTE.lanternGlow,
    );
  }

  function drawBlessing(state) {
    context.fillStyle = 'rgba(5,3,14,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textBaseline = 'alphabetic';
    text('THE LANTERN OFFERS A BLESSING', FIELD.width / 2, 170, 40, PALETTE.gold, 'center', '800');
    text(`Wave ${state.wave} cleared — choose one`, FIELD.width / 2, 216, 22, PALETTE.muted, 'center');
    for (let i = 0; i < state.blessings.length; i += 1) {
      const card = BLESSING_CARDS[i];
      const b = state.blessings[i];
      if (!b) continue;
      context.fillStyle = PALETTE.panel;
      context.fillRect(card.x, card.y, card.w, card.h);
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.strokeRect(card.x, card.y, card.w, card.h);
      text(`[${i + 1}]`, card.x + card.w / 2, card.y + 34, 18, PALETTE.muted, 'center', '700');
      text(b.name, card.x + card.w / 2, card.y + 74, 24, PALETTE.text, 'center', '700');
      text(b.desc, card.x + card.w / 2, card.y + 112, 18, PALETTE.ember, 'center');
      const level = b.level || 0;
      text(level > 0 ? `Owned Lv ${level} → ${level + 1}` : 'New blessing', card.x + card.w / 2, card.y + 148, 16, PALETTE.muted, 'center');
    }
    text('Press 1, 2 or 3 — or click a card', FIELD.width / 2, 540, 22, PALETTE.gold, 'center', '700');
  }

  function drawOver(state, best) {
    drawPanel(
      'THE LIGHT FADES',
      [`The shades take the lantern on wave ${Math.max(1, state.wave)}.`, `Score ${state.score} · Best ${best}`, `Shades banished ${state.kills} · Embers gathered ${state.embers}`, ''],
      'Press Space or click to try again',
      PALETTE.danger,
    );
  }

  function drawWon(state, best) {
    drawPanel(
      'THE DAWN RETURNS',
      ['The Gloom Herald is banished. The lantern burns on.', `Score ${state.score} · Best ${best}`, `Shades banished ${state.kills} · Embers gathered ${state.embers}`, `Waves cleared ${state.stats.wavesCleared} / 10`],
      'Press Space or click to play again',
      PALETTE.gold,
    );
  }

  function drawPaused() {
    drawPanel('PAUSED', ['The shades wait in the dark.'], 'Press P to resume', PALETTE.panelEdge);
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake: a deterministic offset from the world's clock.
    const shake = state.shake;
    const sx = shake > 0 ? Math.sin(state.time * 91.7) * shake * 0.5 : 0;
    const sy = shake > 0 ? Math.cos(state.time * 113.3) * shake * 0.5 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_BLESSING) drawBlessing(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WON) drawWon(state, best);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toLogical };
}
