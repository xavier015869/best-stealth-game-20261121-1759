// Moonvault — game.js
// The game itself: a state machine (title -> briefing -> playing -> caught /
// level complete -> won), scoring, close calls, the Watch-Eye alarm, and the
// per-night flow across the three levels.

import { CONFIG, NIGHTS, rankForScore } from './config.js';
import { LEVEL_DEFS, parseLevel } from './levels.js';
import { Player } from './player.js';
import { Guard, WatchEye } from './guard.js';
import { dist } from './geometry.js';

export const GAME_STATES = {
  TITLE: 'title',
  BRIEFING: 'briefing',
  PLAYING: 'playing',
  CAUGHT: 'caught',
  LEVEL_COMPLETE: 'levelComplete',
  WON: 'won',
};

export class Game {
  constructor(sound) {
    this.sound = sound;
    this.state = GAME_STATES.TITLE;
    this.levelIndex = 0;
    this.score = 0;
    this.level = null;
    this.player = null;
    this.guards = [];
    this.eye = null;
    this.popups = [];
    this.levelTime = 0;
    this.levelStartScore = 0;
    this.levelLoot = 0;
    this.levelCloseCalls = 0;
    this.levelSawChase = false;
    this.maxSuspicionSeen = 0; // highest suspicion this level, for close calls
    this.closeCallArmed = false;
    this.runLoot = 0;
    this.runCloseCalls = 0;
    this.runTimeBonus = 0;
    this.runSawChase = false;
    this.lastLevelBreakdown = null;
    this.runBreakdown = null;
    this.rankTitle = '';
    this.time = 0;
    this.alarmFlash = 0;
    this.loadLevel(0);
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = parseLevel(LEVEL_DEFS[index]);
    this.player = new Player(this.level.playerStart);
    this.guards = this.level.guardDefs.map((def) => new Guard(def, this.level));
    this.eye = this.level.eyeDef ? new WatchEye(this.level.eyeDef) : null;
    this.popups = [];
    this.levelTime = 0;
    this.levelLoot = 0;
    this.levelCloseCalls = 0;
    this.levelSawChase = false;
    this.maxSuspicionSeen = 0;
    this.closeCallArmed = false;
    this.alarmFlash = 0;
  }

  startRun() {
    this.score = 0;
    this.runLoot = 0;
    this.runCloseCalls = 0;
    this.runTimeBonus = 0;
    this.runSawChase = false;
    this.runBreakdown = null;
    this.rankTitle = '';
    this.levelStartScore = 0;
    this.loadLevel(0);
    this.state = GAME_STATES.BRIEFING;
  }

  startLevel() {
    this.levelStartScore = this.score;
    this.loadLevel(this.levelIndex);
    this.state = GAME_STATES.PLAYING;
  }

  objectiveText() {
    if (!this.level) return '';
    if (!this.level.moonstone.taken) return 'Steal the Moonstone from the vault';
    return 'Moonstone taken — reach the green EXIT!';
  }

  levelTimeText() {
    const total = Math.floor(this.levelTime);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  addPopup(x, y, text, color) {
    this.popups.push({ x, y, text, color, ttl: 1.6, maxTtl: 1.6 });
  }

  addScore(points, x, y, label) {
    this.score += points;
    this.addPopup(x, y, `${label} +${points}`, '#ffd75e');
  }

  // ---- main update ------------------------------------------------------

  update(dt, input) {
    this.time += dt;
    for (const pop of this.popups) pop.ttl -= dt;
    this.popups = this.popups.filter((p) => p.ttl > 0);
    if (this.alarmFlash > 0) this.alarmFlash -= dt;

    switch (this.state) {
      case GAME_STATES.TITLE:
        // Guards keep patrolling behind the title, so the scene is alive.
        this.updateWorld(dt, null);
        if (input.confirmPressed()) {
          this.sound.unlock();
          this.sound.click();
          this.startRun();
        }
        break;
      case GAME_STATES.BRIEFING:
        if (input.confirmPressed()) {
          this.sound.click();
          this.startLevel();
        }
        break;
      case GAME_STATES.PLAYING:
        this.levelTime += dt;
        this.updateWorld(dt, input);
        this.checkPickups();
        this.checkCloseCalls();
        this.checkCaught();
        this.checkExit();
        break;
      case GAME_STATES.CAUGHT:
        if (input.retryPressed()) {
          this.sound.click();
          // Retry the night: the run score rewinds to the night's start.
          this.score = this.levelStartScore;
          this.loadLevel(this.levelIndex);
          this.state = GAME_STATES.BRIEFING;
        }
        break;
      case GAME_STATES.LEVEL_COMPLETE:
        if (input.confirmPressed()) {
          this.sound.click();
          if (this.levelIndex + 1 < LEVEL_DEFS.length) {
            this.levelIndex += 1;
            this.state = GAME_STATES.BRIEFING;
          } else {
            this.finishRun();
          }
        }
        break;
      case GAME_STATES.WON:
        if (input.confirmPressed()) {
          this.sound.click();
          this.startRun();
        }
        break;
      default:
        break;
    }
  }

  // Guards, the eye and (when playing) the player all move here. On the
  // title screen the player is parked and only the guards move.
  updateWorld(dt, input) {
    if (input && this.state === GAME_STATES.PLAYING) {
      this.player.update(dt, input, this.level);
    }
    const events = {
      onGuardStep: (guard) => this.playGuardStep(guard),
      onChase: () => {
        this.levelSawChase = true;
        this.runSawChase = true;
      },
      onAlarm: (spot) => this.raiseAlarm(spot),
    };
    for (const guard of this.guards) {
      guard.update(dt, this.player, this.level, events);
    }
    if (this.eye) this.eye.update(dt, this.player, this.level, events);

    // Track the hottest suspicion for close-call detection.
    const hottest = Math.max(0, ...this.guards.map((g) => g.suspicion));
    if (hottest > this.maxSuspicionSeen) this.maxSuspicionSeen = hottest;
    if (this.maxSuspicionSeen >= CONFIG.CLOSE_CALL_ARM) this.closeCallArmed = true;
  }

  playGuardStep(guard) {
    if (!this.sound.ready) return;
    const d = dist(this.player.x, this.player.y, guard.x, guard.y);
    const volume = Math.max(0, 1 - d / 520);
    if (volume <= 0.03) return;
    // Pan by the guard's horizontal offset from the player.
    const pan = Math.max(-1, Math.min(1, (guard.x - this.player.x) / 420));
    this.sound.footstep(pan, volume * 0.85);
  }

  raiseAlarm(spot) {
    this.alarmFlash = 1.2;
    this.sound.alarm();
    for (const guard of this.guards) guard.raiseAlarm(spot);
    this.addPopup(spot.x, spot.y - 30, 'ALARM!', '#ff5040');
  }

  // ---- scoring events ---------------------------------------------------

  checkPickups() {
    const p = this.player;
    for (const coin of this.level.loot) {
      if (!coin.taken && dist(p.x, p.y, coin.x, coin.y) < 26) {
        coin.taken = true;
        this.levelLoot += 1;
        this.runLoot += 1;
        this.addScore(CONFIG.LOOT_VALUE, coin.x, coin.y, 'LOOT');
        this.sound.pickup();
      }
    }
    const m = this.level.moonstone;
    if (!m.taken && dist(p.x, p.y, m.x, m.y) < 30) {
      m.taken = true;
      this.addScore(CONFIG.MOONSTONE_VALUE, m.x, m.y, 'MOONSTONE');
      this.sound.gem();
    }
  }

  checkCloseCalls() {
    const hottest = Math.max(0, ...this.guards.map((g) => g.suspicion));
    if (this.closeCallArmed && hottest < CONFIG.CLOSE_CALL_CLEAR) {
      this.closeCallArmed = false;
      this.maxSuspicionSeen = 0;
      this.levelCloseCalls += 1;
      this.runCloseCalls += 1;
      this.addScore(CONFIG.CLOSE_CALL_VALUE, this.player.x, this.player.y - 24, 'CLOSE CALL');
      this.sound.whoosh();
    }
  }

  checkCaught() {
    for (const guard of this.guards) {
      if (guard.catches(this.player)) {
        this.state = GAME_STATES.CAUGHT;
        this.sound.caught();
        return;
      }
    }
  }

  checkExit() {
    const ex = this.level.exit;
    const p = this.player;
    if (!this.level.moonstone.taken) return;
    if (Math.abs(p.x - ex.x) < 30 && Math.abs(p.y - ex.y) < 34) {
      this.completeLevel();
    }
  }

  completeLevel() {
    const timeBonus = Math.max(0, CONFIG.TIME_BONUS_MAX - Math.floor(this.levelTime) * CONFIG.TIME_BONUS_PER_SECOND);
    const unseen = !this.levelSawChase;
    this.runTimeBonus += timeBonus;
    this.score += timeBonus;
    this.lastLevelBreakdown = {
      loot: this.levelLoot,
      closeCalls: this.levelCloseCalls,
      timeBonus,
      unseen,
      total: this.score - this.levelStartScore,
    };
    this.sound.win();
    this.state = GAME_STATES.LEVEL_COMPLETE;
  }

  finishRun() {
    const unseen = !this.runSawChase;
    if (unseen) this.score += CONFIG.UNSEEN_BONUS;
    this.runBreakdown = {
      loot: this.runLoot,
      closeCalls: this.runCloseCalls,
      timeBonus: this.runTimeBonus,
      unseen,
    };
    this.rankTitle = rankForScore(this.score);
    this.state = GAME_STATES.WON;
  }
}
