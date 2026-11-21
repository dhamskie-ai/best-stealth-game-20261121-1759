// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Night warehouse: dark floor with a tile grid, pale walls, crates,
// glowing documents, a green exit door, yellow vision cones. Flat shapes and canvas
// text for the HUD and the panels.
import { CRATES, DOCS, EXIT, FIELD, FONT, GUARD, PALETTE, WALLS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const docsLabel = cachedLabel('Dokumen ');
  const scoreLabel = cachedLabel('Skor ');
  const coinsLabel = cachedLabel('Koin ');
  const timeLabel = cachedLabel('');
  const finalLabel = cachedLabel('Skor ');
  const bestLabel = cachedLabel('Terbaik ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function drawFloor() {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
  }

  function drawWallsAndCrates() {
    for (const wall of WALLS) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, Math.min(4, wall.h));
    }
    for (const crate of CRATES) {
      context.fillStyle = PALETTE.crate;
      context.fillRect(crate.x, crate.y, crate.w, crate.h);
      context.fillStyle = PALETTE.crateTop;
      context.fillRect(crate.x, crate.y, crate.w, 5);
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 2;
      context.strokeRect(crate.x + 4, crate.y + 4, crate.w - 8, crate.h - 8);
    }
  }

  function drawExit() {
    context.fillStyle = PALETTE.exitGlow;
    context.fillRect(EXIT.x - 8, EXIT.y - 8, EXIT.w + 16, EXIT.h + 16);
    context.fillStyle = PALETTE.exit;
    context.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    context.fillStyle = '#eafaf1';
    context.font = `bold 22px ${FONT}`;
    context.textAlign = 'center';
    context.fillText('EXIT', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 + 8);
  }

  function drawDocs(state, now) {
    for (let i = 0; i < state.docs.length; i += 1) {
      const doc = state.docs[i];
      if (doc.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(now / 300 + i * 2);
      context.fillStyle = PALETTE.docGlow;
      context.beginPath();
      context.arc(doc.x, doc.y, 26 * pulse + 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.doc;
      context.beginPath();
      context.moveTo(doc.x, doc.y - 14);
      context.lineTo(doc.x + 11, doc.y);
      context.lineTo(doc.x, doc.y + 14);
      context.lineTo(doc.x - 11, doc.y);
      context.closePath();
      context.fill();
      context.fillStyle = '#0a2a22';
      context.font = `bold 13px ${FONT}`;
      context.textAlign = 'center';
      context.fillText('!', doc.x, doc.y + 5);
    }
  }

  function drawCoin(state) {
    if (state.coin === null) return;
    context.fillStyle = PALETTE.coin;
    context.beginPath();
    context.arc(state.coin.x, state.coin.y, 9, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(242,201,76,0.5)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(state.coin.x, state.coin.y, 15, 0, Math.PI * 2);
    context.stroke();
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const suspicious = state.detection > GUARD.suspiciousAt;
      const chasing = guard.mode === 'chase';
      context.fillStyle = chasing ? PALETTE.coneChase : suspicious ? PALETTE.coneSuspicious : PALETTE.cone;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.arc(guard.x, guard.y, GUARD.coneRange, guard.angle - GUARD.coneAngle / 2, guard.angle + GUARD.coneAngle / 2);
      context.closePath();
      context.fill();
      context.fillStyle = PALETTE.guardBody;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius - 4, 0, Math.PI * 2);
      context.fill();
      // Facing tick.
      context.strokeStyle = '#ffd9d4';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (guard.radius + 7), guard.y + Math.sin(guard.angle) * (guard.radius + 7));
      context.stroke();
      if (chasing) {
        text('!', guard.x, guard.y - guard.radius - 12, 26, '#ff6b5e', 'center');
      } else if (suspicious) {
        text('?', guard.x, guard.y - guard.radius - 12, 26, '#f39c12', 'center');
      }
    }
  }

  function drawPlayer(state, now) {
    const player = state.player;
    const sneaking = state.sneaking === true;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.beginPath();
    context.ellipse(player.x + 3, player.y + 5, player.radius, player.radius * 0.6, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerCloak;
    context.beginPath();
    context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, player.radius - 6, 0, Math.PI * 2);
    context.fill();
    if (sneaking) {
      context.strokeStyle = PALETTE.doc;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
      context.stroke();
    }
    void now;
  }

  function drawHud(state) {
    context.fillStyle = 'rgba(10,12,16,0.72)';
    context.fillRect(0, 0, FIELD.width, 52);
    context.textBaseline = 'top';
    text(docsLabel(`${state.docsCollected}/${DOCS.length}`), 24, 14, 26, PALETTE.text, 'left');
    // Detection meter, kept clear of the documents label on its left.
    const barX = 340;
    const barW = 260;
    text('Terdeteksi', barX - 12, 16, 22, PALETTE.muted, 'right');
    context.fillStyle = '#2a3040';
    context.fillRect(barX, 16, barW, 20);
    const fillColor = state.detection > GUARD.chaseAt ? PALETTE.danger
      : state.detection > GUARD.suspiciousAt ? '#e67e22' : PALETTE.good;
    context.fillStyle = fillColor;
    context.fillRect(barX, 16, Math.round(barW * state.detection), 20);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(barX, 16, barW, 20);
    text(timeLabel(formatTime(state.timeLeft)), FIELD.width / 2 + 60, 14, 26, state.timeLeft < 30 ? PALETTE.danger : PALETTE.text, 'center');
    text(coinsLabel(`${state.coins}`), FIELD.width - 260, 14, 26, PALETTE.text, 'left');
    text(scoreLabel(`${state.score}`), FIELD.width - 24, 14, 26, PALETTE.text, 'right');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5,6,9,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.coin, 'center');
  }

  const TITLE_LINES = [
    'Kurir bayangan. Gudang malam. Tiga dokumen intel.',
    'WASD / panah: bergerak.  Shift: menyelinap (pelan, sulit terlihat).',
    'Klik: lempar koin pengalih.  M: suara.  R: ulangi.',
    'Hindari cone kuning penjaga. Meter penuh = tertangkap.',
    'Kumpulkan 3 dokumen, lalu kabur lewat pintu EXIT hijau.',
    'Waktu: 3 menit. Dokumen +500, koin sukses +50.',
    '',
  ];
  const PAUSED_LINES = ['Penjaga menunggu.'];
  const WIN_LINES = ['', ''];
  const LOST_LINES = ['', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, now) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawExit();
    drawWallsAndCrates();
    drawDocs(state, now);
    drawCoin(state);
    drawGuards(state);
    drawPlayer(state, now);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[6] = bestLabel(best);
      drawPanel('SHADOW COURIER', TITLE_LINES, 'Klik atau tekan Enter untuk mulai');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Jeda', PAUSED_LINES, 'Tekan P untuk lanjut');
    else if (screen === SCREEN_OVER) {
      if (state.result === 'won') {
        WIN_LINES[0] = finalLabel(state.score);
        WIN_LINES[1] = bestLabel(best);
        drawPanel('MISI SELESAI — KAMU LOLOS!', WIN_LINES, 'Tekan R untuk main lagi');
      } else {
        LOST_LINES[0] = state.lostReason === 'timeout' ? 'Waktu habis.' : 'Kamu tertangkap penjaga.';
        LOST_LINES[1] = finalLabel(state.score);
        drawPanel('MISI GAGAL', LOST_LINES, 'Tekan R untuk coba lagi');
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
