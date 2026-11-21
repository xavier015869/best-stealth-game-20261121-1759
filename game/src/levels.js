// Moonvault — levels.js
// The three nights, drawn as text grids. Legend:
//   # wall   . floor   , shadow rug (hard to see there)
//   C crate  S statue  L loot      M Moonstone
//   E exit   P player start
// Guards patrol waypoint loops in tile coordinates; each waypoint pause lets
// the guard stop and scan, so the loops are learnable.

import { CONFIG } from './config.js';

const TILE = CONFIG.TILE;

export const LEVEL_DEFS = [
  {
    name: 'Night One — The Moonlit Vault',
    sub: 'Two Lantern Guards keep the vault. Learn their loops.',
    grid: [
      '####################',
      '#P....,.....L......#',
      '#.....#####........#',
      '#.....#...#........#',
      '#.....#.M.#........#',
      '#.....#...#........#',
      '#.....##.##........#',
      '#..C........,......#',
      '#.....S..........L.#',
      '#.........C........#',
      '#..L......,.....E..#',
      '#.....,............#',
      '####################',
    ],
    guards: [
      { waypoints: [[2, 1], [17, 1], [17, 11], [2, 11]], pause: 1.4 },
      { waypoints: [[8, 7], [15, 7], [15, 10], [8, 10]], pause: 1.1 },
    ],
    eye: null,
  },
  {
    name: 'Night Two — The Crossing Galleries',
    sub: 'Three guards, crossing patrols. Patience pays.',
    grid: [
      '####################',
      '#P...L......,......#',
      '#..C....#####..C...#',
      '#.......#...#......#',
      '#..,....#.M.#...L..#',
      '#.......#...#......#',
      '#..C....##.##...C..#',
      '#.....,......,,....#',
      '#..L....S.......C..#',
      '#......#####.......#',
      '#..C...#...#..E....#',
      '#.....,....,.......#',
      '####################',
    ],
    guards: [
      { waypoints: [[2, 1], [17, 1], [17, 7], [2, 7]], pause: 1.2 },
      { waypoints: [[5, 7], [14, 7], [14, 11], [5, 11]], pause: 1.0 },
      { waypoints: [[14, 1], [17, 1], [17, 5], [14, 5]], pause: 1.5 },
    ],
    eye: null,
  },
  {
    name: 'Night Three — The Brass Watch',
    sub: 'Four guards and a sweeping Watch-Eye. One alarm wakes them all.',
    grid: [
      '####################',
      '#P...L......,......#',
      '#.....####....C....#',
      '#..C..#..#....,,...#',
      '#.....#M.#.........#',
      '#.,,..#..#....C....#',
      '#.....##.##.,,.....#',
      '#..L......S........#',
      '#....C......,....L.#',
      '#.....#####........#',
      '#..C..#...#..E.....#',
      '#.....,....,.......#',
      '####################',
    ],
    guards: [
      { waypoints: [[2, 1], [17, 1], [17, 11], [2, 11]], pause: 1.2 },
      { waypoints: [[2, 2], [5, 2], [5, 6], [2, 6]], pause: 1.0 },
      { waypoints: [[15, 2], [17, 2], [17, 6], [15, 6]], pause: 1.3 },
      { waypoints: [[7, 8], [16, 8], [16, 10], [12, 10], [12, 8]], pause: 0.9 },
    ],
    // A brass Watch-Eye mounted on the north wall, sweeping the grand hall.
    eye: { tx: 10, ty: 0, baseAngle: Math.PI / 2, sweepArc: 1.15 },
  },
];

// Turn a level definition into the rectangles and points the game runs on.
export function parseLevel(def) {
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  const walls = [];
  const crates = [];
  const statues = [];
  const rugs = [];
  const loot = [];
  let moonstone = null;
  let exit = null;
  let playerStart = null;

  for (let y = 0; y < rows; y++) {
    const row = def.grid[y];
    if (row.length !== cols) {
      throw new Error(`level grid row ${y} is ${row.length} wide, expected ${cols}`);
    }
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      const px = x * TILE;
      const py = y * TILE;
      const cx = px + TILE / 2;
      const cy = py + TILE / 2;
      if (ch === '#') walls.push({ x: px, y: py, w: TILE, h: TILE });
      else if (ch === 'C') crates.push({ x: px + 6, y: py + 6, w: TILE - 12, h: TILE - 12 });
      else if (ch === 'S') statues.push({ x: px + 10, y: py + 10, w: TILE - 20, h: TILE - 20 });
      else if (ch === ',') rugs.push({ x: px + 2, y: py + 2, w: TILE - 4, h: TILE - 4 });
      else if (ch === 'L') loot.push({ x: cx, y: cy, taken: false });
      else if (ch === 'M') moonstone = { x: cx, y: cy, taken: false };
      else if (ch === 'E') exit = { x: cx, y: cy, w: TILE, h: TILE };
      else if (ch === 'P') playerStart = { x: cx, y: cy };
    }
  }
  if (!moonstone) throw new Error('level has no Moonstone (M)');
  if (!exit) throw new Error('level has no exit (E)');
  if (!playerStart) throw new Error('level has no player start (P)');

  // Everything that blocks movement and sight: walls, crates, statues.
  const blockers = [...walls, ...crates, ...statues];
  return {
    name: def.name,
    sub: def.sub,
    cols,
    rows,
    width: cols * TILE,
    height: rows * TILE,
    walls,
    crates,
    statues,
    rugs,
    loot,
    moonstone,
    exit,
    playerStart,
    blockers,
    guardDefs: def.guards,
    eyeDef: def.eye,
  };
}

// Is the point (px,py) standing on a shadow rug?
export function onRug(level, px, py) {
  for (const rug of level.rugs) {
    if (px >= rug.x && px <= rug.x + rug.w && py >= rug.y && py <= rug.y + rug.h) return true;
  }
  return false;
}

// Flood-fill reachability from the player start over walkable tiles.
// Used by the playtest to prove every objective is reachable.
export function reachableTiles(def) {
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
    return def.grid[y][x] !== '#' && def.grid[y][x] !== 'C' && def.grid[y][x] !== 'S';
  };
  let start = null;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (def.grid[y][x] === 'P') start = [x, y];
    }
  }
  const seen = new Set();
  const queue = [start];
  seen.add(start.join(','));
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!walkable(nx, ny)) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}
