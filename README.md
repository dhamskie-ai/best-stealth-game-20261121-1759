# Shadow Courier

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/dhamskie-ai/best-stealth-game-20261121-1759/rank.svg)](https://make.fun)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/dhamskie-ai/best-stealth-game-20261121-1759/reward.svg)](https://make.fun)

A top-down stealth game for the make.fun **best-stealth-game-20261121-1759**
competition. You are a courier in a night warehouse: slip past three patrolling
guards, pocket three intel documents, and escape through the green EXIT door
before the 3-minute clock runs out.

## How to play

- **WASD / arrow keys** — move.
- **Shift** — sneak: half speed, but guards see you from much closer and the
  detection meter fills half as fast.
- **Click** — throw a coin (max 3, 4 s cooldown). It rings on landing and the
  nearest guard within range walks over to investigate for 3 seconds.
- **M** — mute the beeps. **R** — restart. **P** — pause.
- **Enter / click** — start from the title screen.

Guards patrol fixed loops and sweep a yellow vision cone in front of them. Step
into a cone with a clear line of sight and the detection meter climbs — faster
up close and while walking normally, slower while sneaking or far away. Past
half the meter a guard turns suspicious (orange cone, "?"); past 85% they chase
(red cone, "!"). A full meter means you are caught.

- Document: **+500**. A coin that actually diverts a guard: **+50**.
- Win bonus: **+5 per second left** on the clock.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Plain static files — `game/index.html` and its ES modules, no library, no
network request, sound synthesised with WebAudio.

## Screenshots

`?shot=start|play|end&seed=1` stages the three scenes: the title over the
warehouse, a mid-game sneak with a guard's cone turning toward the courier, and
the win screen on the exit door.
