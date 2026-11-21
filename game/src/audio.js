// Synthesised WebAudio beeps — no audio files, no network. The context is created
// lazily on the first sound (after a user gesture), and every call is guarded so a
// browser without audio never breaks the game.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function beep(freq, duration, type, volume, when = 0) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + duration);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  return {
    pickup() { beep(880, 0.12, 'sine', 0.15); beep(1318, 0.16, 'sine', 0.12, 0.09); },
    coin() { beep(1568, 0.1, 'triangle', 0.18); beep(2093, 0.14, 'triangle', 0.12, 0.07); },
    divert() { beep(660, 0.1, 'sine', 0.1); },
    alert() { beep(220, 0.18, 'square', 0.1); },
    win() { beep(523, 0.14, 'sine', 0.15); beep(659, 0.14, 'sine', 0.15, 0.12); beep(784, 0.2, 'sine', 0.15, 0.24); },
    lose() { beep(196, 0.3, 'sawtooth', 0.1); beep(147, 0.4, 'sawtooth', 0.1, 0.2); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() { return muted; },
  };
}
