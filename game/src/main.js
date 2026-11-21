// Moonvault — main.js
// Entrypoint: boots the game, runs the loop, wires the screens, and exposes a
// small debug hook (window.__moonvault) the playtest uses to teleport Wren
// and force states. The hook changes nothing about normal play.

import { Game, GAME_STATES } from './game.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { Renderer } from './render.js';
import { applyShotStaging } from './shots.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const sound = new SoundEngine();
const input = new Input();
const game = new Game(sound);

input.onFirstGesture = () => sound.unlock();
canvas.addEventListener('pointerdown', () => {
  sound.unlock();
  // Clicking a menu screen is the same as pressing Enter.
  input.clicked = true;
});

const params = new URLSearchParams(window.location.search);
const staged = applyShotStaging(game, params);
if (staged) {
  document.title = `Moonvault — ${params.get('shot')}`;
}

// Debug hook for automated playtests: teleport, force suspicion, read state.
window.__moonvault = {
  game,
  states: GAME_STATES,
  teleport(tx, ty) {
    game.player.x = (tx + 0.5) * 64;
    game.player.y = (ty + 0.5) * 64;
  },
  teleportPx(x, y) {
    game.player.x = x;
    game.player.y = y;
  },
  placeInFrontOfGuard(i, distance) {
    const g = game.guards[i];
    game.player.x = g.x + Math.cos(g.facing) * distance;
    game.player.y = g.y + Math.sin(g.facing) * distance;
  },
  setSuspicion(value) {
    for (const guard of game.guards) guard.suspicion = value;
  },
  forceState(state) {
    game.state = state;
  },
  pressEnter() {
    game.update(0, { confirmPressed: () => true, retryPressed: () => true, moveVector: () => ({ x: 0, y: 0, moving: false }), gait: () => 'walk' });
  },
  snapshot() {
    return {
      state: game.state,
      levelIndex: game.levelIndex,
      score: game.score,
      player: { x: Math.round(game.player.x), y: Math.round(game.player.y), gait: game.player.gait },
      moonstoneTaken: game.level.moonstone.taken,
      guards: game.guards.map((g) => ({
        state: g.state,
        suspicion: Math.round(g.suspicion),
        x: Math.round(g.x),
        y: Math.round(g.y),
      })),
      eye: game.eye ? { alarming: game.eye.alarming, seesPlayer: game.eye.seesPlayer } : null,
    };
  },
};
window.__moonvaultReady = true;

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (input.wasPressed('KeyM')) sound.setMuted(!sound.muted);
  try {
    game.update(dt, input);
  } catch (err) {
    console.error(err);
  }
  renderer.beginFrame();
  switch (game.state) {
    case GAME_STATES.TITLE:
      renderer.drawTitle(game, game.time);
      break;
    case GAME_STATES.BRIEFING:
      renderer.drawBriefing(game);
      break;
    case GAME_STATES.PLAYING:
      renderer.drawWorld(game, game.time);
      renderer.drawHUD(game);
      break;
    case GAME_STATES.CAUGHT:
      renderer.drawWorld(game, game.time);
      renderer.drawHUD(game);
      renderer.drawCaught(game);
      break;
    case GAME_STATES.LEVEL_COMPLETE:
      renderer.drawWorld(game, game.time);
      renderer.drawHUD(game);
      renderer.drawLevelComplete(game);
      break;
    case GAME_STATES.WON:
      renderer.drawWin(game);
      break;
    default:
      renderer.drawWorld(game, game.time);
      break;
  }
  if (game.alarmFlash > 0) {
    renderer.ctx.fillStyle = `rgba(255, 60, 40, ${Math.min(0.18, game.alarmFlash * 0.15)})`;
    renderer.ctx.fillRect(0, 0, 1280, 900);
  }
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
