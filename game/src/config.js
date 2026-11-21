// Shadow Courier — every tuning number, colour and map rectangle in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Seconds on the mission clock when a run starts. */
export const TIMER_START = 180;

export const PLAYER = {
  radius: 14,
  /** px/s walking normally. */
  speed: 170,
  /** px/s while sneaking (Shift held). */
  sneakSpeed: 85,
  /** Radius inside which a document is picked up. */
  pickupRadius: 30,
};

export const GUARD = {
  radius: 15,
  /** px/s on patrol. */
  speed: 90,
  /** px/s while chasing a spotted courier. */
  chaseSpeed: 135,
  /** px/s while walking to a coin's sound. */
  investigateSpeed: 115,
  /** Vision cone half-angle is CONE_ANGLE / 2; full cone is 70 degrees. */
  coneAngle: (70 * Math.PI) / 180,
  /** How far a guard can see, in px. */
  coneRange: 260,
  /** Range multiplier while the courier sneaks. */
  sneakRangeFactor: 0.6,
  /** Detection fill rate multiplier while the courier sneaks. */
  sneakRateFactor: 0.55,
  /** Base detection fill rate per second when the courier is dead-centre in a cone. */
  baseRate: 1.8,
  /** Detection drain per second while no guard sees the courier. */
  decayRate: 0.4,
  /** Above this the guard is suspicious ("?", orange cone). */
  suspiciousAt: 0.5,
  /** Above this the guard chases ("!", red cone). */
  chaseAt: 0.85,
};

export const COIN = {
  /** Coins carried at the start of a run. */
  max: 3,
  /** Seconds between throws. */
  cooldown: 4,
  /** How far a coin can be thrown from the courier, in px. */
  throwRange: 300,
  /** Guards within this radius of the landing point walk over to investigate. */
  lureRadius: 220,
  /** Seconds a guard investigates the landing point. */
  investigateTime: 3,
};

export const SCORE = {
  doc: 500,
  /** Points when a thrown coin actually diverts a guard. */
  divert: 50,
  /** Win bonus per second left on the clock. */
  winPerSecond: 5,
};

/**
 * The warehouse. Rectangles block movement and line of sight.
 * The outer border is 24 px thick; interior walls leave three gaps:
 * the 284..420 gap in the west wall, the 444..700 gap in the south wall
 * of the north-east room, and the 224..340 gap under the north wall.
 */
export const WALLS = [
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 696, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 720 },
  { x: 1256, y: 0, w: 24, h: 720 },
  { x: 420, y: 24, w: 24, h: 260 },
  { x: 420, y: 420, w: 24, h: 276 },
  { x: 700, y: 340, w: 556, h: 24 },
  { x: 24, y: 500, w: 280, h: 24 },
  { x: 820, y: 24, w: 24, h: 200 },
  { x: 980, y: 520, w: 24, h: 176 },
];

/** Crates: low cover that blocks movement and sight, like a wall. */
export const CRATES = [
  { x: 200, y: 200, w: 56, h: 56 },
  { x: 560, y: 120, w: 56, h: 56 },
  { x: 560, y: 470, w: 56, h: 56 },
  { x: 1000, y: 180, w: 56, h: 56 },
  { x: 1080, y: 560, w: 56, h: 56 },
  { x: 300, y: 600, w: 56, h: 56 },
];

/** The three intel documents, in the order a first-time player finds them. */
export const DOCS = [
  { x: 150, y: 120 },
  { x: 1150, y: 120 },
  { x: 920, y: 620 },
];

/** The green exit door, bottom-right corner. */
export const EXIT = { x: 1196, y: 600, w: 60, h: 96 };

/** Where the courier starts: bottom-left room. */
export const SPAWN = { x: 90, y: 620 };

/** Patrol loops, one per guard; each guard walks its waypoints in order. */
export const GUARD_PATROLS = [
  { waypoints: [[120, 90], [360, 90]] },
  { waypoints: [[640, 420], [640, 620]] },
  { waypoints: [[1150, 420], [1150, 620]] },
];

export const PALETTE = {
  backdrop: '#0a0c10',
  floor: '#1a1e26',
  floorLine: '#222834',
  wall: '#3a4356',
  wallTop: '#4d5a74',
  crate: '#6b5433',
  crateTop: '#8a6f45',
  player: '#e8e4d8',
  playerCloak: '#2f6f4f',
  guard: '#c0392b',
  guardBody: '#7e2a20',
  cone: 'rgba(242, 201, 76, 0.20)',
  coneSuspicious: 'rgba(230, 126, 34, 0.28)',
  coneChase: 'rgba(231, 76, 60, 0.30)',
  doc: '#7ef0d4',
  docGlow: 'rgba(126, 240, 212, 0.35)',
  exit: '#27ae60',
  exitGlow: 'rgba(39, 174, 96, 0.35)',
  coin: '#f2c94c',
  panel: '#171b23',
  panelEdge: '#2c3442',
  text: '#eef1f5',
  muted: '#9aa3b2',
  danger: '#e74c3c',
  good: '#2ecc71',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'shadow-courier.best';
