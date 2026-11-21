// Moonvault — render.js
// All art is drawn in code: stone floors, crates, statues, shadow rugs, the
// glowing Moonstone, lantern guards with wall-clipped vision cones, and the
// HUD. Nothing is loaded from a file.

import { CONFIG } from './config.js';
import { mulberry32 } from './geometry.js';
import { GUARD_STATES } from './guard.js';

const TILE = CONFIG.TILE;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.worldY = CONFIG.HUD_H + 2;
    // Precomputed floor speckles so the stone reads as stone, not flat colour.
    const rng = mulberry32(20261121);
    this.speckles = [];
    for (let i = 0; i < 420; i++) {
      this.speckles.push({
        x: rng() * CONFIG.VIEW_W,
        y: rng() * (CONFIG.VIEW_H - CONFIG.HUD_H),
        r: 1 + rng() * 2.2,
        a: 0.04 + rng() * 0.08,
      });
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.canvas.width = Math.floor(vw * dpr);
    this.canvas.height = Math.floor(vh * dpr);
    this.canvas.style.width = `${vw}px`;
    this.canvas.style.height = `${vh}px`;
    this.scale = Math.min(vw / CONFIG.VIEW_W, vh / CONFIG.VIEW_H);
    this.offsetX = (vw - CONFIG.VIEW_W * this.scale) / 2;
    this.offsetY = (vh - CONFIG.VIEW_H * this.scale) / 2;
    this.dpr = dpr;
  }

  beginFrame() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0b0e18';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale,
      this.dpr * this.offsetX, this.dpr * this.offsetY);
  }

  // ---- world ------------------------------------------------------------

  drawWorld(game, time) {
    const ctx = this.ctx;
    const level = game.level;
    const C = CONFIG.COLORS;
    ctx.save();
    ctx.translate(0, this.worldY);

    // Floor: two-tone stone checker.
    for (let y = 0; y < level.rows; y++) {
      for (let x = 0; x < level.cols; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? C.floorA : C.floorB;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    // Speckles.
    ctx.fillStyle = '#9fb4ff';
    for (const s of this.speckles) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Shadow rugs: dark purple mats where you are hard to see.
    for (const rug of level.rugs) {
      ctx.fillStyle = C.rug;
      this.roundRect(rug.x, rug.y, rug.w, rug.h, 8);
      ctx.fill();
      ctx.strokeStyle = C.rugEdge;
      ctx.lineWidth = 2;
      this.roundRect(rug.x + 4, rug.y + 4, rug.w - 8, rug.h - 8, 6);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140, 120, 200, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rug.x + 8, rug.y + rug.h / 2);
      ctx.lineTo(rug.x + rug.w - 8, rug.y + rug.h / 2);
      ctx.stroke();
    }

    // Exit: a green glowing doorway.
    const ex = level.exit;
    const pulse = 0.55 + Math.sin(time * 2.4) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse * 0.35;
    ctx.fillStyle = C.exit;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#0e2b18';
    ctx.fillRect(ex.x - 22, ex.y - 26, 44, 52);
    ctx.strokeStyle = C.exit;
    ctx.lineWidth = 3;
    ctx.strokeRect(ex.x - 22, ex.y - 26, 44, 52);
    ctx.fillStyle = C.exit;
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', ex.x, ex.y - 32);

    // Loot: gold coins.
    for (const coin of level.loot) {
      if (coin.taken) continue;
      const bob = Math.sin(time * 3 + coin.x) * 2;
      ctx.fillStyle = '#8a6a1d';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y + bob + 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.loot;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3b0';
      ctx.font = 'bold 11px Georgia, serif';
      ctx.fillText('✦', coin.x, coin.y + bob + 4);
    }

    // The Moonstone: a pulsing cyan gem.
    if (!level.moonstone.taken) {
      const m = level.moonstone;
      const glow = 0.5 + Math.sin(time * 3.2) * 0.25;
      ctx.save();
      ctx.globalAlpha = glow * 0.5;
      ctx.fillStyle = C.moonstone;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 34 + Math.sin(time * 3.2) * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#0b3a44';
      ctx.beginPath();
      ctx.moveTo(m.x, m.y - 16);
      ctx.lineTo(m.x + 12, m.y);
      ctx.lineTo(m.x, m.y + 16);
      ctx.lineTo(m.x - 12, m.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.moonstone;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y - 11);
      ctx.lineTo(m.x + 8, m.y);
      ctx.lineTo(m.x, m.y + 11);
      ctx.lineTo(m.x - 8, m.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#eafcff';
      ctx.beginPath();
      ctx.arc(m.x - 3, m.y - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crates: wooden boxes with cross planks.
    for (const crate of level.crates) {
      ctx.fillStyle = C.crate;
      ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
      ctx.strokeStyle = C.crateEdge;
      ctx.lineWidth = 3;
      ctx.strokeRect(crate.x, crate.y, crate.w, crate.h);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(crate.x, crate.y);
      ctx.lineTo(crate.x + crate.w, crate.y + crate.h);
      ctx.moveTo(crate.x + crate.w, crate.y);
      ctx.lineTo(crate.x, crate.y + crate.h);
      ctx.stroke();
    }

    // Statues: stone pedestals with a robed figure.
    for (const st of level.statues) {
      ctx.fillStyle = '#565e75';
      ctx.fillRect(st.x - 4, st.y + st.h - 8, st.w + 8, 10);
      ctx.fillStyle = C.statue;
      ctx.beginPath();
      ctx.arc(st.x + st.w / 2, st.y + st.h / 2 - 4, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(st.x + st.w / 2 - 8, st.y + st.h / 2 - 2, 16, 16);
      ctx.strokeStyle = C.statueEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(st.x + st.w / 2, st.y + st.h / 2 - 4, 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Walls: deep indigo blocks with a lit top edge.
    for (const w of level.walls) {
      ctx.fillStyle = C.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = C.wallTop;
      ctx.fillRect(w.x, w.y, w.w, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
    }

    // Vision cones, drawn additively so they glow over the floor.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (game.eye) this.drawCone(game.eye.conePolygon(level), CONFIG.COLORS.eyeCone);
    for (const guard of game.guards) {
      const s = guard.suspicion;
      const color = s >= CONFIG.SUSPICION_CHASE ? C.coneHot
        : s >= CONFIG.SUSPICION_SUSPICIOUS ? C.coneWarm : C.coneCalm;
      this.drawCone(guard.conePolygon(level), color);
    }
    ctx.restore();

    // Watch-Eye camera body.
    if (game.eye) this.drawWatchEye(game.eye, time);

    // Guards, then the player on top.
    for (const guard of game.guards) this.drawGuard(guard, time);
    this.drawPlayer(game.player, game, time);

    // Floating score popups.
    ctx.font = 'bold 16px Georgia, serif';
    ctx.textAlign = 'center';
    for (const pop of game.popups) {
      ctx.globalAlpha = Math.max(0, pop.ttl / pop.maxTtl);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y - (pop.maxTtl - pop.ttl) * 22);
    }
    ctx.globalAlpha = 1;

    // Moonlight vignette: dark at the edges, lighter around the thief.
    const vig = ctx.createRadialGradient(
      game.player.x, game.player.y, 120,
      game.player.x, game.player.y, 620,
    );
    vig.addColorStop(0, 'rgba(5, 8, 18, 0)');
    vig.addColorStop(1, 'rgba(5, 8, 18, 0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, level.width, level.height);

    ctx.restore();
  }

  drawCone(points, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  drawWatchEye(eye, time) {
    const ctx = this.ctx;
    // Brass mount on the wall.
    ctx.fillStyle = '#8a6a2a';
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, 10, 0, Math.PI * 2);
    ctx.fill();
    // Lens: red while alarming, cyan while sweeping.
    ctx.fillStyle = eye.alarming ? '#ff4040' : '#7ef0ff';
    ctx.beginPath();
    ctx.arc(eye.x + Math.cos(eye.angle) * 6, eye.y + Math.sin(eye.angle) * 6, 4, 0, Math.PI * 2);
    ctx.fill();
    if (eye.alarming) {
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 13px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('ALARM!', eye.x, eye.y + 34);
    }
  }

  drawGuard(guard, time) {
    const ctx = this.ctx;
    const C = CONFIG.COLORS;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(guard.x, guard.y + 14, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lantern glow pool.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(guard.x, guard.y, 4, guard.x, guard.y, 74);
    glow.addColorStop(0, 'rgba(255, 190, 90, 0.20)');
    glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Body: crimson cloak.
    ctx.fillStyle = C.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.guardTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    // Helmet and face.
    ctx.fillStyle = '#5d1f1f';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.facing) * 4, guard.y - 3 + Math.sin(guard.facing) * 4, 3, 0, Math.PI * 2);
    ctx.fill();
    // Lantern held out front.
    const lx = guard.x + Math.cos(guard.facing) * 20;
    const ly = guard.y + Math.sin(guard.facing) * 20;
    ctx.fillStyle = '#ffcf6e';
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lx, ly, 5, 0, Math.PI * 2);
    ctx.stroke();

    // Suspicion ring: an arc that fills as the meter fills.
    if (guard.suspicion > 2) {
      const hot = guard.suspicion >= CONFIG.SUSPICION_CHASE;
      ctx.strokeStyle = hot ? '#ff5040' : '#ffa040';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 22, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
    // "?" while suspicious, "!" while chasing.
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    if (guard.state === GUARD_STATES.CHASE) {
      ctx.fillStyle = '#ff5040';
      ctx.fillText('!', guard.x, guard.y - 30);
    } else if (guard.state === GUARD_STATES.SUSPICIOUS || guard.state === GUARD_STATES.INVESTIGATE) {
      ctx.fillStyle = '#ffd75e';
      ctx.fillText('?', guard.x, guard.y - 30);
    }
  }

  drawPlayer(player, game, time) {
    const ctx = this.ctx;
    // Sprinting is loud: show the noise ring so the player can feel it.
    if (player.gait === 'sprint' && player.moving) {
      ctx.strokeStyle = 'rgba(255, 90, 70, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, CONFIG.GAITS.sprint.noise, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 13, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cloak: dark, with a teal trim that reads against the floor.
    const dim = player.gait === 'sneak' ? 0.75 : 1;
    ctx.globalAlpha = dim;
    ctx.fillStyle = CONFIG.COLORS.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CONFIG.COLORS.playerTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.stroke();
    // Hood and face, turned toward movement.
    ctx.fillStyle = '#39415c';
    ctx.beginPath();
    ctx.arc(player.x, player.y - 2, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2e8d5';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(Math.atan2(player.dirY, player.dirX)) * 4,
      player.y - 2 + Math.sin(Math.atan2(player.dirY, player.dirX)) * 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // A small crescent marks sneaking.
    if (player.gait === 'sneak') {
      ctx.fillStyle = '#2fd6c8';
      ctx.font = 'bold 12px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('~', player.x, player.y - 22);
    }
  }

  // ---- HUD --------------------------------------------------------------

  drawHUD(game) {
    const ctx = this.ctx;
    const C = CONFIG.COLORS;
    ctx.fillStyle = '#10141f';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.HUD_H);
    ctx.fillStyle = '#2a3350';
    ctx.fillRect(0, CONFIG.HUD_H - 2, CONFIG.VIEW_W, 2);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8ecf7';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillText(game.level.name, 18, 22);
    ctx.fillStyle = '#9aa5c4';
    ctx.font = '13px Georgia, serif';
    ctx.fillText(game.objectiveText(), 18, 46);

    // Suspicion meter: the hottest guard right now.
    const maxSuspicion = Math.max(0, ...game.guards.map((g) => g.suspicion));
    const mx = 560;
    ctx.fillStyle = '#9aa5c4';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.fillText('SUSPICION', mx, 18);
    ctx.fillStyle = '#1c2338';
    ctx.fillRect(mx, 30, 180, 12);
    const suspColor = maxSuspicion >= CONFIG.SUSPICION_CHASE ? '#ff5040'
      : maxSuspicion >= CONFIG.SUSPICION_SUSPICIOUS ? '#ffa040' : '#ffd75e';
    ctx.fillStyle = suspColor;
    ctx.fillRect(mx, 30, 180 * (maxSuspicion / 100), 12);
    ctx.strokeStyle = '#4a5578';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 0.5, 30.5, 180, 12);

    // Gait indicator.
    ctx.fillStyle = game.player.gait === 'sprint' ? '#ff9a7a'
      : game.player.gait === 'sneak' ? '#2fd6c8' : '#e8ecf7';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.fillText(`GAIT: ${CONFIG.GAITS[game.player.gait].label}`, mx, 56);

    // Score, loot, timer on the right.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8ecf7';
    ctx.font = 'bold 17px Georgia, serif';
    ctx.fillText(`Score ${game.score}`, CONFIG.VIEW_W - 18, 22);
    ctx.fillStyle = '#ffd75e';
    ctx.font = '14px Georgia, serif';
    const lootTaken = game.level.loot.filter((l) => l.taken).length;
    ctx.fillText(`✦ ${lootTaken}/${game.level.loot.length}   ⏱ ${game.levelTimeText()}`, CONFIG.VIEW_W - 18, 46);
    ctx.textBaseline = 'alphabetic';
  }

  // ---- screens ------------------------------------------------------------

  dimScreen(alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(6, 8, 16, ${alpha})`;
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
  }

  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10, 13, 24, 0.92)';
    this.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = '#4a5578';
    ctx.lineWidth = 2;
    this.roundRect(x, y, w, h, 14);
    ctx.stroke();
  }

  drawTitle(game, time) {
    this.drawWorld(game, time);
    this.dimScreen(0.62);
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    const cx = CONFIG.VIEW_W / 2;
    const glow = 0.75 + Math.sin(time * 1.8) * 0.25;
    ctx.save();
    ctx.globalAlpha = glow * 0.5;
    ctx.fillStyle = '#7ef0ff';
    ctx.beginPath();
    ctx.arc(cx, 250, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Moonstone emblem.
    ctx.fillStyle = '#7ef0ff';
    ctx.beginPath();
    ctx.moveTo(cx, 218);
    ctx.lineTo(cx + 22, 250);
    ctx.lineTo(cx, 282);
    ctx.lineTo(cx - 22, 250);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f2f5ff';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.shadowColor = '#7ef0ff';
    ctx.shadowBlur = 26;
    ctx.fillText('MOONVAULT', cx, 400);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e8ecf7';
    ctx.font = 'italic 22px Georgia, serif';
    ctx.fillText('A thief, three nights, one Moonstone.', cx, 448);
    ctx.fillStyle = '#9aa5c4';
    ctx.font = '16px Georgia, serif';
    ctx.fillText('Steal the Moonstone. Reach the EXIT unseen.', cx, 486);
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('— Press ENTER to begin —', cx, 560);
    ctx.fillStyle = '#9aa5c4';
    ctx.font = '15px Georgia, serif';
    ctx.fillText('Move: WASD / Arrows    •    Sneak: hold C    •    Sprint: hold Shift', cx, 620);
    ctx.fillText('Hide behind crates and statues. Shadow rugs make you hard to see.', cx, 648);
    ctx.fillText('Lantern Guards carry vision cones — orange means they suspect you.', cx, 676);
    ctx.fillStyle = '#6a7390';
    ctx.font = '13px Georgia, serif';
    ctx.fillText("Built for make.fun's Best Stealth Game bounty", cx, 780);
  }

  drawBriefing(game) {
    this.drawWorld(game, 0);
    this.dimScreen(0.55);
    const ctx = this.ctx;
    const cx = CONFIG.VIEW_W / 2;
    this.panel(cx - 360, 210, 720, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.fillText(game.level.name, cx, 268);
    ctx.fillStyle = '#e8ecf7';
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText(game.level.sub, cx, 306);
    ctx.fillStyle = '#c8d0e8';
    ctx.font = '16px Georgia, serif';
    const lines = [
      'Your job: slip past the Lantern Guards, steal the Moonstone,',
      'and reach the green EXIT without ever being caught.',
      '',
      'Sneak (C) to stay quiet and dim. Walk is the middle ground.',
      'Sprint (Shift) is fast — and loud enough to be heard through walls.',
      'Shadow rugs make you hard to see. A guard who half-sees you',
      'asks “?” and comes to look; a guard who is sure shouts “!” and chases.',
      'Break sight and the suspicion meter cools. Escape a close call: +50.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, cx, 348 + i * 26));
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('— Press ENTER to begin the night —', cx, 556);
  }

  drawCaught(game) {
    this.dimScreen(0.45);
    const ctx = this.ctx;
    const cx = CONFIG.VIEW_W / 2;
    ctx.fillStyle = 'rgba(120, 10, 10, 0.35)';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6a5a';
    ctx.font = 'bold 72px Georgia, serif';
    ctx.fillText('SPOTTED!', cx, 400);
    ctx.fillStyle = '#e8ecf7';
    ctx.font = '22px Georgia, serif';
    ctx.fillText('The Lantern Guards caught Wren in the light.', cx, 452);
    ctx.fillStyle = '#9aa5c4';
    ctx.font = '17px Georgia, serif';
    ctx.fillText(`Score so far: ${game.score}   •   Night ${game.levelIndex + 1} of 3`, cx, 492);
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('— Press R to try the night again —', cx, 560);
  }

  drawLevelComplete(game) {
    this.dimScreen(0.55);
    const ctx = this.ctx;
    const cx = CONFIG.VIEW_W / 2;
    this.panel(cx - 330, 240, 660, 320);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#58e08a';
    ctx.font = 'bold 38px Georgia, serif';
    ctx.fillText('Night Complete', cx, 300);
    ctx.fillStyle = '#e8ecf7';
    ctx.font = '18px Georgia, serif';
    const b = game.lastLevelBreakdown;
    const lines = [
      `Moonstone  +${CONFIG.MOONSTONE_VALUE}`,
      `Loot  +${b.loot * CONFIG.LOOT_VALUE}  (${b.loot} pieces)`,
      `Close calls  +${b.closeCalls * CONFIG.CLOSE_CALL_VALUE}  (${b.closeCalls})`,
      `Time bonus  +${b.timeBonus}`,
      b.unseen ? `Unseen bonus  +${CONFIG.UNSEEN_BONUS}` : 'Spotted — no unseen bonus',
      '',
      `Night score  ${b.total}      •      Total  ${game.score}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, cx, 348 + i * 28));
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText(game.levelIndex + 1 < 3 ? '— Press ENTER for the next night —' : '— Press ENTER —', cx, 524);
  }

  drawWin(game) {
    this.drawWorld(game, 0);
    this.dimScreen(0.6);
    const ctx = this.ctx;
    const cx = CONFIG.VIEW_W / 2;
    this.panel(cx - 360, 170, 720, 480);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7ef0ff';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('THE MOONSTONE IS YOURS', cx, 232);
    ctx.fillStyle = '#e8ecf7';
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText('Three nights, three vaults — and nobody saw a thing. Almost.', cx, 272);
    ctx.font = '17px Georgia, serif';
    const b = game.runBreakdown;
    const lines = [
      `Loot collected  ${b.loot} pieces  (+${b.loot * CONFIG.LOOT_VALUE})`,
      `Moonstones  3  (+${3 * CONFIG.MOONSTONE_VALUE})`,
      `Close calls  ${b.closeCalls}  (+${b.closeCalls * CONFIG.CLOSE_CALL_VALUE})`,
      `Time bonuses  +${b.timeBonus}`,
      b.unseen ? `Unseen bonus  +${CONFIG.UNSEEN_BONUS}` : 'Spotted along the way — no unseen bonus',
      '',
      `FINAL SCORE  ${game.score}`,
      '',
      `Rank: ${game.rankTitle}`,
    ];
    lines.forEach((line, i) => {
      if (line.startsWith('FINAL SCORE')) {
        ctx.fillStyle = '#ffd75e';
        ctx.font = 'bold 24px Georgia, serif';
      } else if (line.startsWith('Rank:')) {
        ctx.fillStyle = '#7ef0ff';
        ctx.font = 'bold 22px Georgia, serif';
      } else {
        ctx.fillStyle = '#c8d0e8';
        ctx.font = '17px Georgia, serif';
      }
      ctx.fillText(line, cx, 316 + i * 30);
    });
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 19px Georgia, serif';
    ctx.fillText('— Press ENTER to play again —', cx, 610);
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
