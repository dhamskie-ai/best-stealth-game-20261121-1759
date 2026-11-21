// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
// Clicking the canvas in play throws a coin at that point (converted to field
// coordinates); clicking on the title or game-over screens starts the game.
//
// ?seed=N is accepted for future deterministic runs. ?shot=start|play|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. window.__game exposes the live state for
// playtests: { state, docs, detection, timeLeft, score, coins, player, guards }.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_COIN, EVENT_DIVERT, EVENT_DOC, EVENT_TIMEOUT, EVENT_WIN } from './world.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
void seed;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name, scene) {
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, performance.now());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    input.takeClick();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Collect 3 documents, then reach the exit.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(world.state.result === 'won'
      ? `Mission complete. Score ${world.state.score}. Best ${best}.`
      : `Mission failed. Score ${world.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_DOC) {
      audio.pickup();
      announce(`Document ${world.state.docsCollected} of 3.`);
    }
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_DIVERT) audio.divert();
    if (events & EVENT_CAUGHT) audio.lose();
    if (events & EVENT_TIMEOUT) audio.lose();
    if (events & EVENT_WIN) audio.win();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  /** Convert a click in canvas CSS pixels to a field point, or null when outside the field. */
  function clickToField(click) {
    if (click === null) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    const offsetY = (rect.height - FIELD.height * scale) / 2;
    const x = (click.clientX - offsetX) / scale;
    const y = (click.clientY - offsetY) / scale;
    if (x < 0 || x > FIELD.width || y < 0 || y > FIELD.height) return null;
    return { x, y };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.stepBackdrop(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const throwAt = clickToField(input.takeClick());
    const events = world.step(STEP, input.move(), input.sneaking(), throwAt);
    handleEvents(events);
    if (world.state.result !== 'play') endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, now);
  }

  // Leaving the tab pauses a running game rather than letting the clock run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Live state for playtests and screenshots.
  window.__game = {
    get state() {
      if (screen === SCREEN_TITLE) return 'title';
      if (screen === SCREEN_PAUSED) return 'paused';
      if (screen === SCREEN_OVER) return world.state.result === 'won' ? 'won' : 'lost';
      return 'play';
    },
    get docs() { return world.state.docsCollected; },
    get detection() { return world.state.detection; },
    get timeLeft() { return world.state.timeLeft; },
    get score() { return world.state.score; },
    get coins() { return world.state.coins; },
    get lostReason() { return world.state.lostReason; },
    get player() { return { x: world.state.player.x, y: world.state.player.y }; },
    get guards() {
      return world.state.guards.map((guard) => ({ x: guard.x, y: guard.y, mode: guard.mode, angle: guard.angle }));
    },
  };

  announce('Shadow Courier. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) {
  // Shots also expose the staged state.
  const scene = stageShot(shot, world);
  window.__game = {
    get state() {
      if (scene.screen === SCREEN_TITLE) return 'title';
      if (scene.screen === SCREEN_OVER) return world.state.result === 'won' ? 'won' : 'lost';
      return 'play';
    },
    get docs() { return world.state.docsCollected; },
    get detection() { return world.state.detection; },
    get timeLeft() { return world.state.timeLeft; },
    get score() { return world.state.score; },
    get coins() { return world.state.coins; },
    get lostReason() { return world.state.lostReason; },
    get player() { return { x: world.state.player.x, y: world.state.player.y }; },
    get guards() {
      return world.state.guards.map((guard) => ({ x: guard.x, y: guard.y, mode: guard.mode, angle: guard.angle }));
    },
  };
  runShot(shot, scene);
} else {
  runGame();
}
