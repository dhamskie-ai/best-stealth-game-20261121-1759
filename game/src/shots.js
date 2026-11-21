// The screenshot scenes behind ?shot=start|play|end. Each one stages a frozen frame
// of a real game state, so the frame is what a short game really looks like and the
// same seed always gives the same frame. Start lets the title backdrop patrol for a
// few seconds; play and end set the world directly to a mid-game / winning state.
import { DOCS, EXIT, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    world.reset();
    // Mid-game: two documents already pocketed, the courier crouched in the
    // north-west room with guard A turning its cone toward them.
    state.docs[0].taken = true;
    state.docs[1].taken = true;
    state.docsCollected = 2;
    state.score = 1000;
    state.coins = 2;
    state.timeLeft = 95;
    state.detection = 0.45;
    state.player.x = 300;
    state.player.y = 150;
    state.sneaking = true;
    const guard = state.guards[0];
    guard.x = 360;
    guard.y = 90;
    guard.angle = Math.atan2(150 - 90, 300 - 360);
    guard.mode = 'patrol';
    guard.waypoint = 0;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    world.reset();
    // Won: all three documents, the courier on the green exit door.
    for (const doc of state.docs) doc.taken = true;
    state.docsCollected = DOCS.length;
    state.timeLeft = 87;
    state.score = 1500 + Math.round(87) * 5;
    state.coins = 1;
    state.detection = 0;
    state.result = 'won';
    state.player.x = EXIT.x + EXIT.w / 2;
    state.player.y = EXIT.y + EXIT.h / 2;
    return { screen: SCREEN_OVER, best: state.score };
  }
  world.reset();
  for (let index = 0; index < START_SECONDS / STEP; index += 1) world.stepBackdrop(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}
