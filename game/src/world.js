// Shadow Courier rules and state, with no drawing and no browser in it: the courier,
// the three patrolling guards, vision cones, line of sight, thrown coins, documents,
// the exit and the mission clock. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react without the world knowing about
// screens or sound. Nothing here allocates after createWorld returns.
import {
  COIN,
  CRATES,
  DOCS,
  EXIT,
  FIELD,
  GUARD,
  GUARD_PATROLS,
  PLAYER,
  SCORE,
  SPAWN,
  TIMER_START,
  WALLS,
} from './config.js';

export const EVENT_DOC = 1;
export const EVENT_COIN = 2;
export const EVENT_DIVERT = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_TIMEOUT = 16;
export const EVENT_WIN = 32;

const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return Math.abs(d);
}

/** True when the segment (x1,y1)-(x2,y2) touches rectangle r (slab test). */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** All solid rectangles: walls plus crates. */
const SOLIDS = [...WALLS, ...CRATES];

/** True when nothing blocks the view between (x1,y1) and (x2,y2). */
export function hasLineOfSight(x1, y1, x2, y2) {
  for (let i = 0; i < SOLIDS.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, SOLIDS[i])) return false;
  }
  return true;
}

/** True when a circle of radius r at (x,y) overlaps rectangle r2. */
function circleHitsRect(x, y, r, r2) {
  const cx = Math.max(r2.x, Math.min(x, r2.x + r2.w));
  const cy = Math.max(r2.y, Math.min(y, r2.y + r2.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function circleHitsSolid(x, y, radius) {
  for (let i = 0; i < SOLIDS.length; i += 1) {
    if (circleHitsRect(x, y, radius, SOLIDS[i])) return true;
  }
  return false;
}

/** Move a circle one axis at a time so it slides along walls instead of sticking. */
function moveCircle(body, dx, dy) {
  const nx = body.x + dx;
  if (!circleHitsSolid(nx, body.y, body.radius)) body.x = nx;
  const ny = body.y + dy;
  if (!circleHitsSolid(body.x, ny, body.radius)) body.y = ny;
}

export function createWorld() {
  const player = { x: SPAWN.x, y: SPAWN.y, radius: PLAYER.radius };
  const guards = GUARD_PATROLS.map((patrol, index) => ({
    x: patrol.waypoints[0][0],
    y: patrol.waypoints[0][1],
    radius: GUARD.radius,
    /** Heading in radians; starts facing along the patrol. */
    angle: Math.atan2(
      patrol.waypoints[1][1] - patrol.waypoints[0][1],
      patrol.waypoints[1][0] - patrol.waypoints[0][0],
    ),
    waypoint: 1,
    /** patrol | investigate | chase | return */
    mode: 'patrol',
    investigateX: 0,
    investigateY: 0,
    investigateTimer: 0,
    lostTimer: 0,
    index,
  }));
  const state = {
    player,
    guards,
    docs: DOCS.map((doc) => ({ x: doc.x, y: doc.y, taken: false })),
    docsCollected: 0,
    /** 0..1, shared across guards; full means caught. */
    detection: 0,
    timeLeft: TIMER_START,
    score: 0,
    coins: COIN.max,
    coinCooldown: 0,
    /** The coin currently on the floor, or null. */
    coin: null,
    coinTimer: 0,
    elapsed: 0,
    /** play | won | lost */
    result: 'play',
    lostReason: null,
    muted: false,
  };

  function reset() {
    player.x = SPAWN.x;
    player.y = SPAWN.y;
    for (let i = 0; i < guards.length; i += 1) {
      const guard = guards[i];
      const patrol = GUARD_PATROLS[i];
      guard.x = patrol.waypoints[0][0];
      guard.y = patrol.waypoints[0][1];
      guard.angle = Math.atan2(
        patrol.waypoints[1][1] - patrol.waypoints[0][1],
        patrol.waypoints[1][0] - patrol.waypoints[0][0],
      );
      guard.waypoint = 1;
      guard.mode = 'patrol';
      guard.investigateTimer = 0;
      guard.lostTimer = 0;
    }
    for (const doc of state.docs) doc.taken = false;
    state.docsCollected = 0;
    state.detection = 0;
    state.timeLeft = TIMER_START;
    state.score = 0;
    state.coins = COIN.max;
    state.coinCooldown = 0;
    state.coin = null;
    state.coinTimer = 0;
    state.elapsed = 0;
    state.result = 'play';
    state.lostReason = null;
    state.sneaking = false;
  }

  /** Title-screen backdrop: guards patrol, nothing else advances. */
  function stepBackdrop(dt) {
    for (const guard of guards) stepGuard(guard, dt, 0, false);
  }

  /** Can this guard see the player right now? */
  function guardSees(guard, sneaking) {
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const dist = Math.hypot(dx, dy);
    const range = GUARD.coneRange * (sneaking ? GUARD.sneakRangeFactor : 1);
    if (dist > range) return 0;
    if (angleDiff(Math.atan2(dy, dx), guard.angle) > GUARD.coneAngle / 2) return 0;
    if (!hasLineOfSight(guard.x, guard.y, player.x, player.y)) return 0;
    // Closer and standing tall fills the meter faster.
    return 1 - dist / range;
  }

  function stepGuard(guard, dt, visible, sneaking) {
    const patrol = GUARD_PATROLS[guard.index];
    if (state.detection >= GUARD.chaseAt && visible > 0) {
      guard.mode = 'chase';
      guard.lostTimer = 0;
    }
    if (guard.mode === 'chase') {
      if (visible > 0) {
        guard.lostTimer = 0;
        const angle = Math.atan2(player.y - guard.y, player.x - guard.x);
        guard.angle = angle;
        moveCircle(guard, Math.cos(angle) * GUARD.chaseSpeed * dt, Math.sin(angle) * GUARD.chaseSpeed * dt);
      } else {
        guard.lostTimer += dt;
        if (guard.lostTimer > 2) guard.mode = 'return';
      }
      return;
    }
    if (guard.mode === 'investigate') {
      const dx = guard.investigateX - guard.x;
      const dy = guard.investigateY - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        const angle = Math.atan2(dy, dx);
        guard.angle = angle;
        moveCircle(guard, Math.cos(angle) * GUARD.investigateSpeed * dt, Math.sin(angle) * GUARD.investigateSpeed * dt);
      } else {
        guard.investigateTimer -= dt;
        if (guard.investigateTimer <= 0) guard.mode = 'return';
      }
      return;
    }
    if (guard.mode === 'return') {
      // Walk back to the nearest waypoint, then resume the loop.
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < patrol.waypoints.length; i += 1) {
        const d = Math.hypot(patrol.waypoints[i][0] - guard.x, patrol.waypoints[i][1] - guard.y);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      const target = patrol.waypoints[best];
      const dx = target[0] - guard.x;
      const dy = target[1] - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        const angle = Math.atan2(dy, dx);
        guard.angle = angle;
        moveCircle(guard, Math.cos(angle) * GUARD.speed * dt, Math.sin(angle) * GUARD.speed * dt);
      } else {
        guard.waypoint = (best + 1) % patrol.waypoints.length;
        guard.mode = 'patrol';
      }
      return;
    }
    // Patrol: walk to the next waypoint, then turn around.
    const target = patrol.waypoints[guard.waypoint];
    const dx = target[0] - guard.x;
    const dy = target[1] - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      guard.waypoint = (guard.waypoint + 1) % patrol.waypoints.length;
      return;
    }
    const angle = Math.atan2(dy, dx);
    guard.angle = angle;
    moveCircle(guard, Math.cos(angle) * GUARD.speed * dt, Math.sin(angle) * GUARD.speed * dt);
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1, `sneaking` halves speed and shrinks
   * the detection range, `throwAt` is a field point or null. Returns event flags.
   */
  function step(dt, move, sneaking, throwAt) {
    if (state.result !== 'play') return 0;
    let events = 0;
    state.elapsed += dt;
    state.sneaking = sneaking;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.coinCooldown > 0) state.coinCooldown = Math.max(0, state.coinCooldown - dt);

    // The courier.
    const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.speed;
    const len = Math.hypot(move.x, move.y);
    if (len > 0) {
      moveCircle(player, (move.x / len) * speed * dt, (move.y / len) * speed * dt);
    }

    // Throw a coin: it lands where clicked (clamped to throw range) and rings.
    if (throwAt !== null && throwAt !== undefined && state.coins > 0 && state.coinCooldown <= 0) {
      const dx = throwAt.x - player.x;
      const dy = throwAt.y - player.y;
      const dist = Math.hypot(dx, dy);
      const clamped = dist > COIN.throwRange ? COIN.throwRange / dist : 1;
      const lx = Math.max(30, Math.min(FIELD.width - 30, player.x + dx * clamped));
      const ly = Math.max(30, Math.min(FIELD.height - 30, player.y + dy * clamped));
      state.coin = { x: lx, y: ly };
      state.coinTimer = COIN.investigateTime + 1;
      state.coins -= 1;
      state.coinCooldown = COIN.cooldown;
      events |= EVENT_COIN;
      let diverted = false;
      for (const guard of guards) {
        if (guard.mode === 'chase') continue;
        const d = Math.hypot(guard.x - lx, guard.y - ly);
        if (d <= COIN.lureRadius) {
          guard.mode = 'investigate';
          guard.investigateX = lx;
          guard.investigateY = ly;
          guard.investigateTimer = COIN.investigateTime;
          diverted = true;
        }
      }
      if (diverted) {
        state.score += SCORE.divert;
        events |= EVENT_DIVERT;
      }
    }
    if (state.coin !== null) {
      state.coinTimer -= dt;
      if (state.coinTimer <= 0) state.coin = null;
    }

    // Vision: the shared detection meter fills from the best view any guard has.
    let bestView = 0;
    for (const guard of guards) {
      const view = guardSees(guard, sneaking);
      if (view > bestView) bestView = view;
    }
    if (bestView > 0) {
      const rate = GUARD.baseRate * bestView * (sneaking ? GUARD.sneakRateFactor : 1);
      state.detection = Math.min(1, state.detection + rate * dt);
    } else {
      state.detection = Math.max(0, state.detection - GUARD.decayRate * dt);
    }

    for (const guard of guards) stepGuard(guard, dt, guardSees(guard, sneaking), sneaking);

    // Documents.
    for (const doc of state.docs) {
      if (doc.taken) continue;
      if (Math.hypot(player.x - doc.x, player.y - doc.y) <= PLAYER.pickupRadius) {
        doc.taken = true;
        state.docsCollected += 1;
        state.score += SCORE.doc;
        events |= EVENT_DOC;
      }
    }

    // Caught.
    if (state.detection >= 1) {
      state.result = 'lost';
      state.lostReason = 'caught';
      return events | EVENT_CAUGHT;
    }
    // Out of time.
    if (state.timeLeft <= 0) {
      state.result = 'lost';
      state.lostReason = 'timeout';
      return events | EVENT_TIMEOUT;
    }
    // All documents, then the exit.
    if (state.docsCollected === DOCS.length
      && player.x > EXIT.x && player.x < EXIT.x + EXIT.w
      && player.y > EXIT.y && player.y < EXIT.y + EXIT.h) {
      state.result = 'won';
      state.score += Math.round(state.timeLeft) * SCORE.winPerSecond;
      return events | EVENT_WIN;
    }
    return events;
  }

  reset();
  return { state, reset, step, stepBackdrop };
}
