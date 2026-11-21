// Moonvault — shots.js
// Screenshot staging: ?shot=title|play|end (with &seed=N) puts the game into
// a fixed, readable pose for its three screenshots. Deterministic: the same
// seed always stages the same frame. The game itself is untouched by this;
// a normal visit with no ?shot= plays from the title screen.

import { GAME_STATES } from './game.js';
import { CONFIG } from './config.js';

function tileCenter(tx, ty) {
  return { x: (tx + 0.5) * CONFIG.TILE, y: (ty + 0.5) * CONFIG.TILE };
}

// Advance the world `seconds` in fixed steps so guards sit mid-patrol.
function simulate(game, seconds) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    game.updateWorld(dt, null);
  }
}

export function applyShotStaging(game, params) {
  const shot = params.get('shot');
  if (!shot) return false;
  const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
  void seed;

  if (shot === 'title') {
    // Title over Night One, guards mid-patrol, thief waiting at the door.
    game.state = GAME_STATES.TITLE;
    game.loadLevel(0);
    simulate(game, 4.5);
    return true;
  }

  if (shot === 'play') {
    // Night Two in full swing: Wren crouched on a shadow rug right in a
    // guard's path, three cones sweeping, one guard suspicious (orange cone,
    // "?") with the meter half full, loot already taken.
    game.score = 200;
    game.runLoot = 2;
    game.loadLevel(1);
    // Collect two coins so the HUD shows progress.
    game.level.loot[0].taken = true;
    game.level.loot[1].taken = true;
    // Rug at tile (13,7); stand just off the patrol line so the guard
    // approaches but does not overlap Wren. Sneaking on a rug fills the
    // meter slowly, so the "?" holds for the screenshot.
    game.player.x = (13 + 0.5) * CONFIG.TILE;
    game.player.y = (7 + 0.5) * CONFIG.TILE + 22;
    game.player.gait = 'sneak';
    game.state = GAME_STATES.PLAYING;
    simulate(game, 6.0);
    // Stage the crossing guard as suspicious: it has half-seen Wren.
    const guard = game.guards[1];
    guard.suspicion = 45;
    guard.state = 'suspicious';
    guard.scanTimer = 0.8;
    guard.lastSeen = { x: game.player.x, y: game.player.y };
    guard.facing = Math.atan2(game.player.y - guard.y, game.player.x - guard.x);
    return true;
  }

  if (shot === 'end') {
    // The win screen: all three nights done, rank Wren the Unseen.
    game.loadLevel(2);
    game.score = 2840;
    game.runLoot = 8;
    game.runCloseCalls = 3;
    game.runTimeBonus = 210;
    game.runSawChase = false;
    game.runBreakdown = {
      loot: 8,
      closeCalls: 3,
      timeBonus: 210,
      unseen: true,
    };
    game.rankTitle = 'Wren the Unseen';
    game.state = GAME_STATES.WON;
    return true;
  }

  return false;
}
