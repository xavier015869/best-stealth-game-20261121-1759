// Moonvault — geometry.js
// Small 2D helpers: angles, segment tests, line of sight clipped by walls,
// and circle-vs-rectangle movement with sliding. No dependencies.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Smallest signed difference between two angles, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * clamp(t, 0, 1);
}

// Do segments (p1,p2) and (p3,p4) intersect? Returns the hit distance t along
// (p1,p2) in [0,1], or null.
export function segmentHit(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const d1x = p2x - p1x;
  const d1y = p2y - p1y;
  const d2x = p4x - p3x;
  const d2y = p4y - p3y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3x - p1x) * d2y - (p3y - p1y) * d2x) / denom;
  const u = ((p3x - p1x) * d1y - (p3y - p1y) * d1x) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
  return null;
}

// Cast a ray from (ox,oy) along `angle` up to `maxDist`. `blockers` is a list
// of {x,y,w,h} rectangles. Returns the distance to the nearest blocker edge,
// or maxDist when nothing is hit.
export function raycast(ox, oy, angle, maxDist, blockers) {
  const ex = ox + Math.cos(angle) * maxDist;
  const ey = oy + Math.sin(angle) * maxDist;
  let best = maxDist;
  for (const b of blockers) {
    // Four edges of the rectangle.
    const hits = [
      segmentHit(ox, oy, ex, ey, b.x, b.y, b.x + b.w, b.y),
      segmentHit(ox, oy, ex, ey, b.x + b.w, b.y, b.x + b.w, b.y + b.h),
      segmentHit(ox, oy, ex, ey, b.x + b.w, b.y + b.h, b.x, b.y + b.h),
      segmentHit(ox, oy, ex, ey, b.x, b.y + b.h, b.x, b.y),
    ];
    for (const t of hits) {
      if (t !== null && t * maxDist < best) best = t * maxDist;
    }
  }
  return best;
}

// True when the segment from (ax,ay) to (bx,by) is not cut by any blocker.
export function lineOfSight(ax, ay, bx, by, blockers) {
  const d = dist(ax, ay, bx, by);
  if (d < 1) return true;
  const hit = raycast(ax, ay, angleTo(ax, ay, bx, by), d, blockers);
  return hit >= d - 0.5;
}

// Circle vs rectangle overlap test.
export function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Move a circle by (dx,dy), sliding along blockers. Returns the new position.
export function moveCircle(x, y, r, dx, dy, blockers) {
  let nx = x + dx;
  for (const b of blockers) {
    if (circleHitsRect(nx, y, r, b)) {
      nx = dx > 0 ? b.x - r : b.x + b.w + r;
    }
  }
  let ny = y + dy;
  for (const b of blockers) {
    if (circleHitsRect(nx, ny, r, b)) {
      ny = dy > 0 ? b.y - r : b.y + b.h + r;
    }
  }
  return { x: nx, y: ny };
}

// Deterministic PRNG (mulberry32) so staged screenshots are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
