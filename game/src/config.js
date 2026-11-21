// Moonvault — config.js
// Every tunable number for the game lives here: sizes, speeds, detection,
// scoring and rank titles. Nothing else in the game hard-codes a balance value.

export const CONFIG = {
  // Logical playfield. The renderer scales this to fit the browser window.
  TILE: 64,
  VIEW_W: 1280,
  VIEW_H: 900,
  HUD_H: 64,

  // Player gaits: sneak is slow, silent and dim; walk is the default;
  // sprint is fast and loud enough to be heard through walls.
  GAITS: {
    sneak: { speed: 78, noise: 0, label: 'SNEAK', fill: 0.55, range: 0.72 },
    walk: { speed: 138, noise: 62, label: 'WALK', fill: 1.0, range: 1.0 },
    sprint: { speed: 216, noise: 205, label: 'SPRINT', fill: 1.7, range: 1.0 },
  },
  PLAYER_RADIUS: 15,

  // Guard vision.
  GUARD_VIEW_RANGE: 235,
  GUARD_VIEW_HALF_ANGLE: 0.56, // radians, ~32 degrees each side
  GUARD_PATROL_SPEED: 62,
  GUARD_CHASE_SPEED: 178,
  GUARD_INVESTIGATE_SPEED: 105,
  GUARD_CATCH_RADIUS: 30,

  // Suspicion meter: 0..100. Fills while a guard sees you, cools when you
  // break sight. Thresholds drive the guard state machine.
  SUSPICION_FILL_BASE: 58, // per second, at point-blank, fully lit, walking
  SUSPICION_COOL: 26, // per second while unseen
  SUSPICION_SUSPICIOUS: 35, // guard stops and asks "?"
  SUSPICION_CHASE: 72, // guard commits to the chase "!"
  SUSPICION_CAUGHT: 100, // fully spotted: the night is lost
  RUG_FILL_FACTOR: 0.32, // shadow rugs make you hard to see
  RUG_RANGE_FACTOR: 0.72,
  HEAR_THROUGH_WALL_FACTOR: 0.6, // sprint noise heard through walls, smaller

  // Watch-Eye camera (Night Three).
  EYE_RANGE: 265,
  EYE_HALF_ANGLE: 0.5,
  EYE_SWEEP_SPEED: 0.55, // radians per second
  EYE_SWEEP_ARC: 1.15,
  ALARM_DURATION: 6, // seconds every guard hunts your last-seen spot
  ALARM_COOLDOWN: 9,

  // Scoring.
  LOOT_VALUE: 100,
  MOONSTONE_VALUE: 500,
  CLOSE_CALL_VALUE: 50,
  CLOSE_CALL_ARM: 62, // suspicion must pass this, then fall below...
  CLOSE_CALL_CLEAR: 24, // ...this, without being caught, to count
  TIME_BONUS_MAX: 300,
  TIME_BONUS_PER_SECOND: 5,
  UNSEEN_BONUS: 400,

  // Rank titles by total score across the three nights.
  RANKS: [
    { min: 2600, title: 'Wren the Unseen' },
    { min: 2200, title: 'Master of Moonlight' },
    { min: 1800, title: 'Silent Partner' },
    { min: 1400, title: 'Night Owl' },
    { min: 1000, title: 'Soft-Footed Thief' },
    { min: 0, title: 'Apprentice Shadow' },
  ],

  // Colours.
  COLORS: {
    floorA: '#232a3d',
    floorB: '#1e2434',
    wall: '#3a4360',
    wallTop: '#565f86',
    rug: '#241d33',
    rugEdge: '#4a3a68',
    crate: '#6b4a2a',
    crateEdge: '#8a6136',
    statue: '#7d86a0',
    statueEdge: '#aab2cc',
    loot: '#ffd75e',
    moonstone: '#7ef0ff',
    exit: '#58e08a',
    player: '#20242e',
    playerTrim: '#2fd6c8',
    guard: '#8a2f2f',
    guardTrim: '#ffb347',
    coneCalm: 'rgba(255, 214, 90, 0.20)',
    coneWarm: 'rgba(255, 150, 60, 0.30)',
    coneHot: 'rgba(255, 70, 60, 0.38)',
    eyeCone: 'rgba(140, 220, 255, 0.22)',
  },
};

// The three nights, in order. Levels themselves live in levels.js.
export const NIGHTS = [
  { name: 'Night One — The Moonlit Vault', sub: 'Two Lantern Guards keep the vault. Learn their loops.' },
  { name: 'Night Two — The Crossing Galleries', sub: 'Three guards, crossing patrols. Patience pays.' },
  { name: 'Night Three — The Brass Watch', sub: 'Four guards and a sweeping Watch-Eye. One alarm wakes them all.' },
];

export function rankForScore(score) {
  for (const rank of CONFIG.RANKS) {
    if (score >= rank.min) return rank.title;
  }
  return CONFIG.RANKS[CONFIG.RANKS.length - 1].title;
}
