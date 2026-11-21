// Moonvault — player.js
// Wren, the thief. Three gaits, wall sliding, noise, and how visible she is:
// sneaking is dim, sprinting is loud, shadow rugs make her hard to see.

import { CONFIG } from './config.js';
import { moveCircle } from './geometry.js';
import { onRug } from './levels.js';

export class Player {
  constructor(start) {
    this.x = start.x;
    this.y = start.y;
    this.radius = CONFIG.PLAYER_RADIUS;
    this.dirX = 0;
    this.dirY = 1; // facing down at the start
    this.gait = 'walk';
    this.moving = false;
    this.stepTimer = 0;
    this.stepPhase = 0;
  }

  reset(start) {
    this.x = start.x;
    this.y = start.y;
    this.dirX = 0;
    this.dirY = 1;
    this.gait = 'walk';
    this.moving = false;
    this.stepTimer = 0;
  }

  update(dt, input, level) {
    const move = input.moveVector();
    this.gait = input.gait();
    this.moving = move.moving;
    const speed = CONFIG.GAITS[this.gait].speed;
    if (move.moving) {
      this.dirX = move.x;
      this.dirY = move.y;
      const next = moveCircle(this.x, this.y, this.radius, move.x * speed * dt, move.y * speed * dt, level.blockers);
      this.x = next.x;
      this.y = next.y;
    }
    // Step cadence drives the footstep sound (faster gaits step faster).
    if (this.moving) {
      this.stepTimer -= dt;
      const interval = this.gait === 'sprint' ? 0.26 : this.gait === 'sneak' ? 0.55 : 0.38;
      if (this.stepTimer <= 0) {
        this.stepTimer = interval;
        this.stepPhase += 1;
      }
    } else {
      this.stepTimer = 0;
    }
  }

  // Noise radius this frame: 0 while sneaking or still, larger while sprinting.
  noiseRadius() {
    if (!this.moving) return 0;
    return CONFIG.GAITS[this.gait].noise;
  }

  // Is the player standing in shadow right now?
  inShadow(level) {
    return onRug(level, this.x, this.y);
  }

  // How easy the player is to see: 1.0 normally, lower while sneaking or in
  // shadow. Guards multiply their suspicion fill rate by this.
  visibility(level) {
    let v = 1.0;
    if (this.gait === 'sneak') v *= CONFIG.GAITS.sneak.fill;
    if (this.gait === 'sprint') v *= CONFIG.GAITS.sprint.fill;
    if (this.inShadow(level)) v *= CONFIG.RUG_FILL_FACTOR;
    return v;
  }

  // Effective vision range against the player (shadow shrinks it).
  viewRangeFactor(level) {
    return this.inShadow(level) ? CONFIG.RUG_RANGE_FACTOR : 1.0;
  }
}
