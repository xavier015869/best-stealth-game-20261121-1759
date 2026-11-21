// Moonvault — guard.js
// Lantern Guards and the brass Watch-Eye.
// A guard patrols a waypoint loop (pausing to scan at each stop), and carries
// a suspicion meter: 0-100, filling while it sees you, cooling when it does
// not. Suspicious -> investigate the last-seen spot -> chase -> back to
// patrol, so a near miss can always be recovered from. The Watch-Eye sweeps
// a fixed arc; when it spots you it rings the alarm and every guard hunts
// your last-seen spot.

import { CONFIG } from './config.js';
import {
  angleDiff,
  angleTo,
  clamp,
  dist,
  lerpAngle,
  lineOfSight,
  moveCircle,
  raycast,
} from './geometry.js';

export const GUARD_STATES = {
  PATROL: 'patrol',
  PAUSE: 'pause',
  SUSPICIOUS: 'suspicious',
  INVESTIGATE: 'investigate',
  CHASE: 'chase',
  RETURN: 'return',
};

export class Guard {
  constructor(def, level) {
    this.level = level;
    this.waypoints = def.waypoints.map(([tx, ty]) => ({
      x: (tx + 0.5) * CONFIG.TILE,
      y: (ty + 0.5) * CONFIG.TILE,
    }));
    this.pauseDuration = def.pause ?? 1.2;
    this.wpIndex = 0;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.facing = 0;
    this.state = GUARD_STATES.PATROL;
    this.suspicion = 0;
    this.pauseTimer = 0;
    this.scanBase = 0;
    this.scanTimer = 0;
    this.lastSeen = null; // {x, y} of the player, when last spotted
    this.investigateTarget = null;
    this.stepTimer = 0;
    this.stepPhase = 0;
    this.seesPlayer = false;
    this.alarmBoost = 0;
    this.aimAtNextWaypoint();
  }

  aimAtNextWaypoint() {
    const next = this.waypoints[(this.wpIndex + 1) % this.waypoints.length];
    this.facing = angleTo(this.x, this.y, next.x, next.y);
  }

  // Can this guard see the player right now? Range, cone angle and a
  // wall-clipped line of sight all have to agree.
  canSee(player, level) {
    const range = CONFIG.GUARD_VIEW_RANGE * player.viewRangeFactor(level);
    const d = dist(this.x, this.y, player.x, player.y);
    if (d > range) return false;
    const toPlayer = angleTo(this.x, this.y, player.x, player.y);
    if (Math.abs(angleDiff(this.facing, toPlayer)) > CONFIG.GUARD_VIEW_HALF_ANGLE) return false;
    return lineOfSight(this.x, this.y, player.x, player.y, level.blockers);
  }

  // The wall-clipped vision cone as a polygon, for rendering.
  conePolygon(level) {
    const range = CONFIG.GUARD_VIEW_RANGE;
    const rays = 26;
    const points = [{ x: this.x, y: this.y }];
    for (let i = 0; i <= rays; i++) {
      const a = this.facing - CONFIG.GUARD_VIEW_HALF_ANGLE
        + (2 * CONFIG.GUARD_VIEW_HALF_ANGLE * i) / rays;
      const d = raycast(this.x, this.y, a, range, level.blockers);
      points.push({ x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d });
    }
    return points;
  }

  // Hearing: a loud gait reaches the guard even through walls, at a
  // reduced radius when the line of sight is blocked.
  hearNoise(player, level) {
    const noise = player.noiseRadius();
    if (noise <= 0) return false;
    const d = dist(this.x, this.y, player.x, player.y);
    const blocked = !lineOfSight(this.x, this.y, player.x, player.y, level.blockers);
    const reach = blocked ? noise * CONFIG.HEAR_THROUGH_WALL_FACTOR : noise;
    return d <= reach;
  }

  update(dt, player, level, events) {
    this.seesPlayer = this.canSee(player, level);
    const d = dist(this.x, this.y, player.x, player.y);

    if (this.seesPlayer) {
      this.lastSeen = { x: player.x, y: player.y };
      // Suspicion fills faster up close, faster for loud gaits, slower in shadow.
      const closeness = 1 - clamp(d / CONFIG.GUARD_VIEW_RANGE, 0, 0.9);
      const rate = CONFIG.SUSPICION_FILL_BASE * (0.35 + closeness) * player.visibility(level);
      this.suspicion = clamp(this.suspicion + rate * dt, 0, 100);
    } else {
      this.suspicion = clamp(this.suspicion - CONFIG.SUSPICION_COOL * dt, 0, 100);
    }

    if (this.hearNoise(player, level) && this.state !== GUARD_STATES.CHASE) {
      // A sprinting thief is heard: investigate the noise, suspicion jumps.
      if (this.suspicion < CONFIG.SUSPICION_SUSPICIOUS) {
        this.suspicion = CONFIG.SUSPICION_SUSPICIOUS;
      }
      this.investigateTarget = { x: player.x, y: player.y };
      if (this.state === GUARD_STATES.PATROL || this.state === GUARD_STATES.PAUSE) {
        this.state = GUARD_STATES.INVESTIGATE;
      }
    }

    // State machine.
    switch (this.state) {
      case GUARD_STATES.PATROL:
        this.patrolStep(dt, level);
        if (this.suspicion >= CONFIG.SUSPICION_SUSPICIOUS) {
          this.state = GUARD_STATES.SUSPICIOUS;
          this.scanTimer = 0.8;
        }
        break;
      case GUARD_STATES.PAUSE:
        this.pauseTimer -= dt;
        // Scan: sweep the lantern left and right while stopped.
        this.scanTimer += dt;
        this.facing = this.scanBase + Math.sin(this.scanTimer * 2.2) * 0.9;
        if (this.pauseTimer <= 0) {
          this.state = GUARD_STATES.PATROL;
          this.aimAtNextWaypoint();
        }
        if (this.suspicion >= CONFIG.SUSPICION_SUSPICIOUS) {
          this.state = GUARD_STATES.SUSPICIOUS;
          this.scanTimer = 0.8;
        }
        break;
      case GUARD_STATES.SUSPICIOUS:
        // "?" — stop, stare at the last-seen spot (or sweep the lantern
        // around when something was heard but never seen).
        this.scanTimer -= dt;
        if (this.lastSeen) {
          this.facing = lerpAngle(this.facing, angleTo(this.x, this.y, this.lastSeen.x, this.lastSeen.y), dt * 6);
        } else {
          this.facing += dt * 1.2;
        }
        if (this.suspicion >= CONFIG.SUSPICION_CHASE) {
          this.state = GUARD_STATES.CHASE;
          events.onChase?.(this);
        } else if (this.scanTimer <= 0) {
          if (this.lastSeen && !this.seesPlayer) {
            this.investigateTarget = { ...this.lastSeen };
            this.state = GUARD_STATES.INVESTIGATE;
          } else if (this.investigateTarget) {
            this.state = GUARD_STATES.INVESTIGATE;
          } else if (this.suspicion < CONFIG.SUSPICION_SUSPICIOUS * 0.6) {
            this.state = GUARD_STATES.RETURN;
          } else {
            // Still uneasy: keep looking a while longer.
            this.scanTimer = 0.8;
          }
        }
        break;
      case GUARD_STATES.INVESTIGATE: {
        const target = this.investigateTarget || this.lastSeen;
        if (!target) {
          this.state = GUARD_STATES.RETURN;
          break;
        }
        this.walkToward(dt, target.x, target.y, CONFIG.GUARD_INVESTIGATE_SPEED, level);
        if (dist(this.x, this.y, target.x, target.y) < 26) {
          // Looked, found nothing: suspicion drains, head home.
          this.suspicion = Math.min(this.suspicion, CONFIG.SUSPICION_SUSPICIOUS * 0.5);
          this.investigateTarget = null;
          this.state = GUARD_STATES.RETURN;
        }
        if (this.suspicion >= CONFIG.SUSPICION_CHASE) {
          this.state = GUARD_STATES.CHASE;
          events.onChase?.(this);
        }
        break;
      }
      case GUARD_STATES.CHASE:
        // "!" — run at the last-seen spot; keep updating it while visible.
        if (this.lastSeen) {
          this.walkToward(dt, this.lastSeen.x, this.lastSeen.y, CONFIG.GUARD_CHASE_SPEED, level);
        }
        if (!this.seesPlayer && this.suspicion < CONFIG.SUSPICION_CHASE * 0.75) {
          // Lost the trail: investigate where you last saw her.
          this.investigateTarget = this.lastSeen ? { ...this.lastSeen } : null;
          this.state = GUARD_STATES.INVESTIGATE;
        }
        break;
      case GUARD_STATES.RETURN: {
        const home = this.waypoints[this.wpIndex];
        this.walkToward(dt, home.x, home.y, CONFIG.GUARD_PATROL_SPEED, level);
        if (dist(this.x, this.y, home.x, home.y) < 12) {
          this.state = GUARD_STATES.PATROL;
          this.aimAtNextWaypoint();
        }
        if (this.suspicion >= CONFIG.SUSPICION_SUSPICIOUS) {
          this.state = GUARD_STATES.SUSPICIOUS;
          this.scanTimer = 0.8;
        }
        break;
      }
      default:
        break;
    }

    // Footstep cadence while moving.
    if (this.state === GUARD_STATES.PATROL || this.state === GUARD_STATES.INVESTIGATE
      || this.state === GUARD_STATES.CHASE || this.state === GUARD_STATES.RETURN) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.state === GUARD_STATES.CHASE ? 0.3 : 0.45;
        this.stepPhase += 1;
        events.onGuardStep?.(this);
      }
    }
  }

  patrolStep(dt, level) {
    const target = this.waypoints[(this.wpIndex + 1) % this.waypoints.length];
    const arrived = this.walkToward(dt, target.x, target.y, CONFIG.GUARD_PATROL_SPEED, level);
    if (arrived) {
      this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
      this.state = GUARD_STATES.PAUSE;
      this.pauseTimer = this.pauseDuration;
      this.scanBase = this.facing;
      this.scanTimer = 0;
    }
  }

  // Walk toward (tx,ty) at `speed`, sliding along walls. Returns true when
  // within 10px of the target.
  walkToward(dt, tx, ty, speed, level) {
    const d = dist(this.x, this.y, tx, ty);
    if (d < 10) return true;
    const vx = ((tx - this.x) / d) * speed * dt;
    const vy = ((ty - this.y) / d) * speed * dt;
    const next = moveCircle(this.x, this.y, 15, vx, vy, level.blockers);
    this.x = next.x;
    this.y = next.y;
    this.facing = lerpAngle(this.facing, angleTo(this.x, this.y, tx, ty), dt * 8);
    return dist(this.x, this.y, tx, ty) < 10;
  }

  // The alarm sends this guard to the player's last-seen spot.
  raiseAlarm(lastSeen) {
    if (!lastSeen) return;
    this.lastSeen = { ...lastSeen };
    this.investigateTarget = { ...lastSeen };
    this.suspicion = Math.max(this.suspicion, CONFIG.SUSPICION_CHASE * 0.8);
    this.state = GUARD_STATES.INVESTIGATE;
  }

  // Caught when fully spotted, or touched while the guard is on the hunt.
  catches(player) {
    if (this.suspicion >= CONFIG.SUSPICION_CAUGHT) return true;
    if (this.state === GUARD_STATES.CHASE && dist(this.x, this.y, player.x, player.y) < CONFIG.GUARD_CATCH_RADIUS) {
      return true;
    }
    return false;
  }
}

// The brass Watch-Eye: a wall-mounted camera sweeping a fixed arc. When it
// sees the player it rings the alarm; every guard then hunts the last-seen
// spot. It never moves from its mount.
export class WatchEye {
  constructor(def) {
    // Mounted on the wall tile (tx,ty): hang just below its bottom edge so
    // its own wall never blocks its line of sight.
    this.x = (def.tx + 0.5) * CONFIG.TILE;
    this.y = (def.ty + 1) * CONFIG.TILE + 8;
    this.baseAngle = def.baseAngle;
    this.sweepArc = def.sweepArc ?? CONFIG.EYE_SWEEP_ARC;
    this.angle = this.baseAngle;
    this.sweepTime = 0;
    this.alarmTimer = 0;
    this.cooldown = 0;
    this.seesPlayer = false;
  }

  canSee(player, level) {
    const range = CONFIG.EYE_RANGE * player.viewRangeFactor(level);
    const d = dist(this.x, this.y, player.x, player.y);
    if (d > range) return false;
    const toPlayer = angleTo(this.x, this.y, player.x, player.y);
    if (Math.abs(angleDiff(this.angle, toPlayer)) > CONFIG.EYE_HALF_ANGLE) return false;
    return lineOfSight(this.x, this.y, player.x, player.y, level.blockers);
  }

  conePolygon(level) {
    const rays = 22;
    const points = [{ x: this.x, y: this.y }];
    for (let i = 0; i <= rays; i++) {
      const a = this.angle - CONFIG.EYE_HALF_ANGLE
        + (2 * CONFIG.EYE_HALF_ANGLE * i) / rays;
      const d = raycast(this.x, this.y, a, CONFIG.EYE_RANGE, level.blockers);
      points.push({ x: this.x + Math.cos(a) * d, y: this.y + Math.sin(a) * d });
    }
    return points;
  }

  update(dt, player, level, events) {
    this.sweepTime += dt;
    this.angle = this.baseAngle + Math.sin(this.sweepTime * CONFIG.EYE_SWEEP_SPEED) * this.sweepArc;
    this.seesPlayer = this.canSee(player, level);
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.alarmTimer > 0) this.alarmTimer -= dt;
    if (this.seesPlayer && this.cooldown <= 0 && this.alarmTimer <= 0) {
      this.alarmTimer = CONFIG.ALARM_DURATION;
      this.cooldown = CONFIG.ALARM_DURATION + CONFIG.ALARM_COOLDOWN;
      events.onAlarm?.({ x: player.x, y: player.y });
    }
  }

  get alarming() {
    return this.alarmTimer > 0;
  }
}
