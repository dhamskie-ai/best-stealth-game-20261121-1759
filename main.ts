// Shadow Courier — entry program for the make.fun best-stealth-game competition.
// It gathers the static game (game/) and the screenshots (screenshots/) from beside
// this file into the output directory and writes dossier.json there, the summary the
// judge reads. The game itself needs no build step: plain HTML + ES modules that a
// desktop browser loads offline, no library and no network request.
//
// Run it locally to preview the bundle layout:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally first with `node serve.ts`, then open http://localhost:8080.
// Inside the grader's container the output directory is /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy a folder beside this file into the output directory, when it exists. */
function copyIntoOut(name) {
  const source = join(here, name);
  if (!existsSync(source)) return;
  cpSync(source, join(out, name), { recursive: true });
}

mkdirSync(out, { recursive: true });
copyIntoOut('game');
mkdirSync(join(out, 'screenshots'), { recursive: true });
copyIntoOut('screenshots');

// Caps from the scorer's gate: text_max_bytes shapes the dossier bytes, and the rest
// reject an entry the scorer would reject — at most 4 screenshots of 256 KiB each,
// at most 993 files totalling 48 MiB under game/, no game path over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
