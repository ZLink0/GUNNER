import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = path.resolve(process.cwd(), 'public', 'sprites');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---- Pure Node PNG Encoder (RGBA 8-bit) ----
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

class PixelSurface {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    this.buf = Buffer.alloc(width * height * 4);
  }

  set(x, y, hex) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const idx = (iy * this.w + ix) * 4;
    if (typeof hex === 'string') {
      const clean = hex.startsWith('#') ? hex.slice(1) : hex;
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      const a = clean.length === 8 ? parseInt(clean.slice(6, 8), 16) : 255;
      if (a === 0) return;
      this.buf[idx] = r;
      this.buf[idx + 1] = g;
      this.buf[idx + 2] = b;
      this.buf[idx + 3] = a;
    } else if (Array.isArray(hex)) {
      if (hex[3] === 0) return;
      this.buf[idx] = hex[0];
      this.buf[idx + 1] = hex[1];
      this.buf[idx + 2] = hex[2];
      this.buf[idx + 3] = hex[3] ?? 255;
    }
  }

  rect(x, y, w, h, hex) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, hex);
      }
    }
  }

  circle(cx, cy, r, hex) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r + 0.3) {
          this.set(cx + dx, cy + dy, hex);
        }
      }
    }
  }

  line(x0, y0, x1, y1, hex) {
    let ix0 = Math.round(x0), iy0 = Math.round(y0);
    const ix1 = Math.round(x1), iy1 = Math.round(y1);
    const dx = Math.abs(ix1 - ix0), sx = ix0 < ix1 ? 1 : -1;
    const dy = -Math.abs(iy1 - iy0), sy = iy0 < iy1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      this.set(ix0, iy0, hex);
      if (ix0 === ix1 && iy0 === iy1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; ix0 += sx; }
      if (e2 <= dx) { err += dx; iy0 += sy; }
    }
  }

  save(filename) {
    const outPath = path.join(OUT_DIR, filename);
    fs.writeFileSync(outPath, encodePNG(this.w, this.h, this.buf));
    console.log(`Generated ${filename} (${this.w}x${this.h})`);
  }
}

// ---- 1. HERO SPRITE SHEET (192 x 608 -> 6 cols x 19 rows of 32x32) ----
// Blue Doom-Slayer style armor, Right-hand Sword + Left-hand Gun aimed forward
// Row 17 = hangClimb (4 frames), Row 18 = block (3 frames)
const HERO_PAL = {
  O: '#090d16',
  H1: '#1e3a8a', // Deep Doom Blue Armor shadow
  H2: '#2563eb', // Royal Blue Armor mid
  H3: '#60a5fa', // Bright Cobalt Armor highlight
  V1: '#0891b2', // Visor cyan shadow
  V2: '#22d3ee', // Visor cyan glow
  S1: '#334155', // Undersuit dark slate
  S2: '#475569', // Undersuit mid
  E: '#0f172a',
  EW: '#ffffff',
  B1: '#1d4ed8', // Shoulder/trim blue
  B2: '#38bdf8', // Trim neon blue
  T1: '#1e40af', // Chestplate dark blue
  T2: '#2563eb', // Chestplate blue
  T3: '#93c5fd', // Chestplate specular
  L1: '#1e293b', // Greaves/gauntlet dark
  L2: '#3b82f6', // Greaves/gauntlet blue
  G1: '#facc15', // Gold belt/hilt accent
  P1: '#334155', // Gun dark
  P2: '#94a3b8', // Gun steel
  P3: '#38bdf8', // Gun plasma core
  W1: '#cbd5e1', // Sword steel
  W2: '#ffffff', // Sword edge
  FX1: '#fef08a',
  FX2: '#38bdf8',
  POT1: '#22c55e',
  POT2: '#bbf7d0',
};

function drawHeroFrame(surf, col, row, opts = {}) {
  const ox = col * 32;
  const oy = row * 32;
  const {
    bobY = 0,
    leanX = 0,
    squashY = 0,
    scarfWave = 0,
    legMode = 'idle',
    armMode = 'buster',
    muzzle = false,
    swordFrame = -1,
    climbFrame = -1,
    hangFrame = -1,
    blockFrame = -1,
    deadFrame = -1,
    hurtFlash = false,
  } = opts;

  if (deadFrame >= 0) {
    if (deadFrame === 0) {
      drawHeroFrame(surf, col, row, { legMode: 'hurt', armMode: 'hurt', bobY: 1, hurtFlash: true });
      return;
    }
    if (deadFrame === 1) {
      surf.rect(ox + 10, oy + 14, 12, 10, HERO_PAL.O);
      surf.rect(ox + 11, oy + 15, 10, 8, HERO_PAL.T1);
      surf.rect(ox + 11, oy + 8, 10, 7, HERO_PAL.H2);
      surf.rect(ox + 12, oy + 10, 7, 4, HERO_PAL.S2);
      surf.rect(ox + 9, oy + 24, 6, 4, HERO_PAL.L2);
      surf.rect(ox + 17, oy + 24, 6, 4, HERO_PAL.L2);
      return;
    }
    if (deadFrame === 2) {
      surf.rect(ox + 6, oy + 22, 20, 6, HERO_PAL.O);
      surf.rect(ox + 7, oy + 23, 18, 4, HERO_PAL.T1);
      surf.rect(ox + 6, oy + 21, 7, 5, HERO_PAL.H2);
      surf.rect(ox + 20, oy + 23, 5, 4, HERO_PAL.L2);
      return;
    }
    const spread = deadFrame === 3 ? 6 : 11;
    const pts = [
      [16 - spread, 20], [16 + spread, 20],
      [16, 20 - spread], [16, 20 + Math.min(8, spread)],
      [16 - Math.round(spread * 0.7), 20 - Math.round(spread * 0.7)],
      [16 + Math.round(spread * 0.7), 20 - Math.round(spread * 0.7)],
      [16 - Math.round(spread * 0.7), 20 + Math.round(spread * 0.5)],
      [16 + Math.round(spread * 0.7), 20 + Math.round(spread * 0.5)],
    ];
    for (const [px, py] of pts) {
      surf.circle(ox + px, oy + py, 2, HERO_PAL.FX2);
      surf.set(ox + px, oy + py, HERO_PAL.W2);
    }
    return;
  }

  // Dedicated Hand-Over-Hand Hanging Animation ("gerakan tangan bergelantung")
  if (hangFrame >= 0) {
    const swing = hangFrame === 1 ? 1 : hangFrame === 3 ? -1 : 0;
    const cx = ox + 16 + swing;
    const headY = oy + 8;
    const bodyTop = oy + 18;
    // Left arm & Right arm alternating reach up to overhead bar at oy + 2
    const leftUp = hangFrame === 0 || hangFrame === 1;
    const rightUp = hangFrame === 2 || hangFrame === 3;
    // Left arm
    surf.rect(cx - 6, leftUp ? oy + 2 : oy + 6, 3, leftUp ? 16 : 12, HERO_PAL.O);
    surf.rect(cx - 5, leftUp ? oy + 3 : oy + 7, 2, leftUp ? 14 : 10, HERO_PAL.L2);
    surf.rect(cx - 6, leftUp ? oy + 2 : oy + 6, 3, 2, HERO_PAL.S2); // hand gripping bar
    // Right arm
    surf.rect(cx + 3, rightUp ? oy + 2 : oy + 6, 3, rightUp ? 16 : 12, HERO_PAL.O);
    surf.rect(cx + 4, rightUp ? oy + 3 : oy + 7, 2, rightUp ? 14 : 10, HERO_PAL.L2);
    surf.rect(cx + 3, rightUp ? oy + 2 : oy + 6, 3, 2, HERO_PAL.S2);
    // Dangling legs
    surf.rect(cx - 4 + swing, oy + 26, 4, 4, HERO_PAL.O);
    surf.rect(cx - 3 + swing, oy + 26, 3, 3, HERO_PAL.L2);
    surf.rect(cx + 1 + swing, oy + 25, 4, 4, HERO_PAL.O);
    surf.rect(cx + 1 + swing, oy + 25, 3, 3, HERO_PAL.L2);
    // Armored Doom-Slayer torso & helmet while hanging
    surf.rect(cx - 6, bodyTop - 1, 12, 9, HERO_PAL.O);
    surf.rect(cx - 5, bodyTop, 10, 7, HERO_PAL.T2);
    surf.rect(cx - 4, bodyTop + 1, 8, 2, HERO_PAL.T3);
    surf.rect(cx - 4, bodyTop + 5, 8, 2, HERO_PAL.L1);
    surf.rect(cx - 1, bodyTop + 5, 2, 2, HERO_PAL.G1);
    // Blue Doom Helmet
    surf.rect(cx - 5, headY, 10, 9, HERO_PAL.O);
    surf.rect(cx - 4, headY + 1, 8, 7, HERO_PAL.H2);
    surf.rect(cx - 3, headY + 1, 6, 2, HERO_PAL.H3);
    surf.rect(cx - 2, headY + 3, 6, 3, HERO_PAL.V2);
    return;
  }

  const cx = ox + 16 + leanX;
  const baseY = oy + 28;
  const bodyTop = oy + 13 + bobY + squashY;

  const scarfLen = legMode === 'dash' ? 9 : (legMode.startsWith('run') ? 6 : 4);
  for (let i = 0; i < scarfLen; i++) {
    const sy = bodyTop + 1 + Math.round(Math.sin((i + scarfWave) * 0.9) * 1.2);
    const sx = cx - 4 - i;
    surf.set(sx, sy, HERO_PAL.O);
    surf.set(sx, sy + 1, i % 2 === 0 ? HERO_PAL.B2 : HERO_PAL.B1);
    surf.set(sx, sy + 2, HERO_PAL.O);
  }

  const drawBoot = (bx, by, w = 4, h = 4) => {
    surf.rect(bx - 1, by - 1, w + 2, h + 1, HERO_PAL.O);
    surf.rect(bx, by, w, h, HERO_PAL.L2);
    surf.rect(bx, by + h - 1, w, 1, HERO_PAL.L1);
    surf.set(bx + w - 1, by, HERO_PAL.G1);
  };

  if (climbFrame >= 0) {
    const lOffset = climbFrame % 2 === 0 ? -2 : 1;
    const rOffset = climbFrame % 2 === 0 ? 1 : -2;
    drawBoot(cx - 5, baseY - 4 + lOffset, 4, 4);
    drawBoot(cx + 1, baseY - 4 + rOffset, 4, 4);
  } else if (legMode === 'idle' || legMode === 'land') {
    const lh = legMode === 'land' ? 3 : 4;
    drawBoot(cx - 5, baseY - lh, 4, lh);
    drawBoot(cx + 1, baseY - lh, 4, lh);
  } else if (legMode === 'jump') {
    drawBoot(cx - 5, baseY - 6, 4, 4);
    drawBoot(cx + 2, baseY - 4, 4, 4);
  } else if (legMode === 'fall') {
    drawBoot(cx - 6, baseY - 5, 4, 4);
    drawBoot(cx + 2, baseY - 5, 4, 4);
  } else if (legMode === 'dash') {
    drawBoot(cx - 8, baseY - 4, 5, 3);
    drawBoot(cx + 1, baseY - 5, 4, 3);
    surf.rect(cx - 12, baseY - 4, 3, 2, HERO_PAL.FX2);
    surf.set(cx - 13, baseY - 3, HERO_PAL.W2);
  } else if (legMode === 'hurt') {
    drawBoot(cx - 6, baseY - 5, 4, 4);
    drawBoot(cx + 2, baseY - 3, 4, 4);
  } else {
    const phase = parseInt(legMode.replace(/\D/g, ''), 10) || 0;
    const stride = legMode.startsWith('run') ? 4 : 3;
    const angle = (phase / (legMode.startsWith('run') ? 6 : 4)) * Math.PI * 2;
    const lx = Math.round(Math.sin(angle) * stride);
    const rx = Math.round(-Math.sin(angle) * stride);
    const ly = Math.min(0, Math.round(Math.cos(angle) * -2));
    const ry = Math.min(0, Math.round(-Math.cos(angle) * -2));
    drawBoot(cx - 2 + lx, baseY - 4 + ly, 4, 4);
    drawBoot(cx - 1 + rx, baseY - 4 + ry, 4, 4);
  }

  const torsoH = 10 - squashY;
  // Back/Right Arm holding Sword in ready guard position (behind/above right shoulder)
  if (climbFrame < 0 && !armMode.startsWith('sword') && blockFrame < 0) {
    // Armored right arm back gripping sword hilt
    surf.rect(cx - 8, bodyTop + 1, 4, 4, HERO_PAL.O);
    surf.rect(cx - 7, bodyTop + 2, 3, 2, HERO_PAL.L2);
    // Sword held ready by right hand (angled up-back/side)
    surf.line(cx - 7, bodyTop + 2, cx - 13, bodyTop - 7, HERO_PAL.O);
    surf.line(cx - 7, bodyTop + 1, cx - 12, bodyTop - 7, HERO_PAL.W1);
    surf.set(cx - 12, bodyTop - 7, HERO_PAL.W2);
    surf.rect(cx - 8, bodyTop + 1, 2, 2, HERO_PAL.G1); // gold hilt
  }

  // Broad Doom-Slayer Blue Power Armor Torso + Shoulder Pauldrons
  surf.rect(cx - 6, bodyTop - 1, 12, torsoH + 2, HERO_PAL.O);
  surf.rect(cx - 5, bodyTop, 10, torsoH, hurtFlash ? HERO_PAL.W2 : HERO_PAL.T2);
  surf.rect(cx - 5, bodyTop, 4, torsoH, hurtFlash ? HERO_PAL.FX1 : HERO_PAL.T1);
  // Shoulder Pauldrons (Doom Slayer silhouette)
  surf.rect(cx - 7, bodyTop - 1, 4, 4, HERO_PAL.O);
  surf.rect(cx - 6, bodyTop, 3, 3, HERO_PAL.H3);
  surf.rect(cx + 3, bodyTop - 1, 4, 4, HERO_PAL.O);
  surf.rect(cx + 3, bodyTop, 3, 3, HERO_PAL.H3);
  // Chest armor core + belt
  surf.rect(cx - 1, bodyTop + 1, 4, 3, HERO_PAL.T3);
  surf.rect(cx, bodyTop + 2, 2, 1, HERO_PAL.V2);
  surf.rect(cx - 5, bodyTop + torsoH - 3, 10, 2, HERO_PAL.L1);
  surf.rect(cx - 1, bodyTop + torsoH - 3, 3, 2, HERO_PAL.G1);

  // Doom-Slayer Blue Praetor Helmet (armored crest + angular cyan tactical visor)
  const headY = bodyTop - 10;
  surf.rect(cx - 6, headY - 1, 12, 10, HERO_PAL.O);
  surf.rect(cx - 5, headY, 10, 8, hurtFlash ? HERO_PAL.W2 : HERO_PAL.H2);
  surf.rect(cx - 5, headY, 3, 8, HERO_PAL.H1);
  surf.rect(cx - 3, headY - 2, 6, 2, HERO_PAL.O);
  surf.rect(cx - 2, headY - 1, 5, 2, HERO_PAL.H3); // helmet fin/ridge
  // Armored chin/jaw guard
  surf.rect(cx - 4, headY + 5, 9, 3, HERO_PAL.H1);
  surf.rect(cx + 2, headY + 6, 3, 2, HERO_PAL.P2);
  // Glowing tactical visor looking forward
  surf.rect(cx - 1, headY + 2, 7, 3, HERO_PAL.O);
  surf.rect(cx, headY + 3, 5, 2, HERO_PAL.V2);
  surf.set(cx + 3, headY + 3, HERO_PAL.W2);

  if (climbFrame >= 0) {
    const la = climbFrame % 2 === 0 ? -5 : 0;
    const ra = climbFrame % 2 === 0 ? 0 : -5;
    surf.rect(cx - 7, bodyTop + la, 3, 6, HERO_PAL.L2);
    surf.rect(cx + 4, bodyTop + ra, 3, 6, HERO_PAL.L2);
    surf.rect(cx - 7, bodyTop + la, 3, 2, HERO_PAL.H3);
    surf.rect(cx + 4, bodyTop + ra, 3, 2, HERO_PAL.H3);
    return;
  }

  // Block Pose (Row 18: armored left/right guard shield + sword held tight)
  if (blockFrame >= 0) {
    surf.rect(cx + 4, bodyTop - 3, 5, 13, HERO_PAL.O);
    surf.rect(cx + 5, bodyTop - 2, 3, 11, HERO_PAL.H3);
    surf.rect(cx + 6, bodyTop, 2, 7, HERO_PAL.V2);
    if (blockFrame % 2 === 1) {
      surf.line(cx + 9, bodyTop - 2, cx + 9, bodyTop + 9, HERO_PAL.W2);
    }
    return;
  }

  if (armMode.startsWith('potion')) {
    const pStep = parseInt(armMode.replace(/\D/g, ''), 10) || 0;
    const py = bodyTop + 1 - pStep;
    surf.rect(cx + 3, bodyTop + 1, 4, 3, HERO_PAL.L2);
    surf.rect(cx + 5, py - 5, 4, 5, HERO_PAL.O);
    surf.rect(cx + 6, py - 4, 2, 3, HERO_PAL.POT1);
    surf.set(cx + 6, py - 5, HERO_PAL.POT2);
    return;
  }

  if (armMode === 'shootUp') {
    surf.rect(cx + 2, bodyTop - 7, 4, 8, HERO_PAL.O);
    surf.rect(cx + 3, bodyTop - 6, 2, 6, HERO_PAL.P2);
    surf.set(cx + 3, bodyTop - 5, HERO_PAL.P3);
    if (muzzle) {
      surf.circle(cx + 4, bodyTop - 9, 2, HERO_PAL.FX1);
      surf.set(cx + 4, bodyTop - 10, HERO_PAL.W2);
    }
    return;
  }

  if (armMode === 'shootDown') {
    surf.rect(cx + 2, bodyTop + 4, 4, 7, HERO_PAL.O);
    surf.rect(cx + 3, bodyTop + 5, 2, 5, HERO_PAL.P2);
    surf.set(cx + 3, bodyTop + 7, HERO_PAL.P3);
    if (muzzle) {
      surf.circle(cx + 4, bodyTop + 12, 2, HERO_PAL.FX1);
      surf.set(cx + 4, bodyTop + 13, HERO_PAL.W2);
    }
    return;
  }

  if (armMode.startsWith('sword')) {
    const dir = armMode === 'swordWind' ? -1 : 1;
    // Left arm keeps gun braced at waist while Right arm slashes sword forward
    surf.rect(cx - 4, bodyTop + 3, 5, 3, HERO_PAL.P1);
    surf.rect(cx + 3, bodyTop + 2, 4, 3, HERO_PAL.L2);
    if (swordFrame === 0) {
      surf.line(cx - 2, bodyTop + 1, cx - 7, bodyTop - 6, HERO_PAL.O);
      surf.line(cx - 2, bodyTop, cx - 6, bodyTop - 6, HERO_PAL.W1);
    } else if (swordFrame === 1) {
      surf.rect(cx + 5, bodyTop + 1, 10, 3, HERO_PAL.O);
      surf.rect(cx + 6, bodyTop + 2, 8, 1, HERO_PAL.W2);
      surf.rect(cx + 5, bodyTop + 1, 2, 3, HERO_PAL.G1);
    } else if (swordFrame === 2) {
      surf.line(cx + 5, bodyTop + 2, cx + 13, bodyTop + 8 * dir, HERO_PAL.O);
      surf.line(cx + 5, bodyTop + 1, cx + 12, bodyTop + 7 * dir, HERO_PAL.W2);
    } else {
      surf.line(cx + 4, bodyTop + 3, cx + 10, bodyTop - 5, HERO_PAL.W1);
    }
    return;
  }

  // Front/Left Arm aiming Gun forward in ready-to-shoot stance ("tangan kiri bawa gun ke depan pose mau tembak")
  const gunExt = armMode === 'shoot' ? 9 : 7;
  const gunY = bodyTop + 2;
  surf.rect(cx + 1, gunY, 3, 3, HERO_PAL.L2); // armored forearm reaching forward
  surf.rect(cx + 3, gunY - 1, gunExt + 1, 5, HERO_PAL.O);
  surf.rect(cx + 4, gunY, gunExt - 1, 3, HERO_PAL.P2);
  surf.rect(cx + 4, gunY + 2, gunExt - 1, 1, HERO_PAL.P1);
  surf.set(cx + 5, gunY + 1, HERO_PAL.P3);
  if (muzzle) {
    surf.circle(cx + 4 + gunExt + 1, gunY + 1, 2, HERO_PAL.FX1);
    surf.set(cx + 4 + gunExt + 2, gunY + 1, HERO_PAL.W2);
  }
}

function buildHeroSheet() {
  const surf = new PixelSurface(192, 608);
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 0, { bobY: i === 2 ? 1 : 0, scarfWave: i });
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 1, { legMode: `walk${i}`, bobY: i % 2 === 1 ? -1 : 0, scarfWave: i });
  for (let i = 0; i < 6; i++) drawHeroFrame(surf, i, 2, { legMode: `run${i}`, leanX: 1, bobY: i % 3 === 1 ? -1 : 0, scarfWave: i * 1.4 });
  drawHeroFrame(surf, 0, 3, { legMode: 'land', squashY: 1, scarfWave: 0 });
  drawHeroFrame(surf, 1, 3, { legMode: 'jump', bobY: -2, scarfWave: 2 });
  drawHeroFrame(surf, 2, 3, { legMode: 'jump', bobY: -3, scarfWave: 4 });
  for (let i = 0; i < 3; i++) drawHeroFrame(surf, i, 4, { legMode: 'fall', bobY: -1, scarfWave: i * 2 });
  drawHeroFrame(surf, 0, 5, { legMode: 'land', squashY: 2, scarfWave: 1 });
  drawHeroFrame(surf, 1, 5, { legMode: 'idle', squashY: 1, scarfWave: 2 });
  drawHeroFrame(surf, 0, 6, { armMode: 'swordWind', swordFrame: 0 });
  drawHeroFrame(surf, 1, 6, { armMode: 'swordSwing', swordFrame: 1, leanX: 2 });
  drawHeroFrame(surf, 2, 6, { armMode: 'swordSwing', swordFrame: 2, leanX: 2 });
  drawHeroFrame(surf, 3, 6, { armMode: 'swordSwing', swordFrame: 3, leanX: 1 });
  drawHeroFrame(surf, 0, 7, { armMode: 'swordWind', swordFrame: 0, bobY: 1 });
  drawHeroFrame(surf, 1, 7, { armMode: 'swordUp', swordFrame: 2, leanX: 2 });
  drawHeroFrame(surf, 2, 7, { armMode: 'swordUp', swordFrame: 1, leanX: 2 });
  drawHeroFrame(surf, 3, 7, { armMode: 'swordUp', swordFrame: 3, leanX: 1 });
  drawHeroFrame(surf, 0, 8, { armMode: 'swordWind', swordFrame: 0, leanX: -1 });
  drawHeroFrame(surf, 1, 8, { armMode: 'swordSpin', swordFrame: 3, leanX: 1, bobY: -1 });
  drawHeroFrame(surf, 2, 8, { armMode: 'swordSpin', swordFrame: 1, leanX: 3 });
  drawHeroFrame(surf, 3, 8, { armMode: 'swordSpin', swordFrame: 2, leanX: 3 });
  drawHeroFrame(surf, 4, 8, { armMode: 'swordSpin', swordFrame: 3, leanX: 1 });
  drawHeroFrame(surf, 0, 9, { armMode: 'shoot', muzzle: true, leanX: -1 });
  drawHeroFrame(surf, 1, 9, { armMode: 'shoot', muzzle: false });
  drawHeroFrame(surf, 2, 9, { armMode: 'buster' });
  drawHeroFrame(surf, 0, 10, { armMode: 'shootUp', muzzle: true });
  drawHeroFrame(surf, 1, 10, { armMode: 'shootUp', muzzle: false });
  drawHeroFrame(surf, 2, 10, { armMode: 'shootUp', muzzle: false, bobY: 1 });
  drawHeroFrame(surf, 0, 11, { legMode: 'fall', armMode: 'shootDown', muzzle: true });
  drawHeroFrame(surf, 1, 11, { legMode: 'fall', armMode: 'shootDown', muzzle: false });
  drawHeroFrame(surf, 2, 11, { legMode: 'fall', armMode: 'shootDown', muzzle: false, bobY: -1 });
  drawHeroFrame(surf, 0, 12, { legMode: 'hurt', leanX: -2, hurtFlash: true });
  drawHeroFrame(surf, 1, 12, { legMode: 'hurt', leanX: -1, hurtFlash: false });
  drawHeroFrame(surf, 2, 12, { legMode: 'hurt', leanX: -1, hurtFlash: true });
  for (let i = 0; i < 5; i++) drawHeroFrame(surf, i, 13, { deadFrame: i });
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 14, { climbFrame: i });
  for (let i = 0; i < 3; i++) drawHeroFrame(surf, i, 15, { legMode: 'dash', leanX: 3, bobY: 2, scarfWave: i * 2 });
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 16, { armMode: `potion${i}`, bobY: i === 2 ? -1 : 0 });
  // Row 17: hangClimb (4 frames hand-over-hand)
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 17, { hangFrame: i });
  // Row 18: block (3 frames guard shield)
  for (let i = 0; i < 3; i++) drawHeroFrame(surf, i, 18, { blockFrame: i });

  surf.save('hero.png');
}

// ---- 2. 10 SWORDS SHEET ----
const SWORD_DEFS = [
  { name: 'Iron Sword', c1: '#64748b', c2: '#cbd5e1', c3: '#ffffff', hilt: '#b45309' },
  { name: 'Crystal Sword', c1: '#0284c7', c2: '#38bdf8', c3: '#e0f2fe', hilt: '#1e3a8a' },
  { name: 'Flame Sword', c1: '#dc2626', c2: '#f97316', c3: '#fef08a', hilt: '#7c2d12' },
  { name: 'Thunder Sword', c1: '#ca8a04', c2: '#facc15', c3: '#fef9c3', hilt: '#1e293b' },
  { name: 'Dark Sword', c1: '#581c87', c2: '#9333ea', c3: '#e9d5ff', hilt: '#0f172a' },
  { name: 'Holy Sword', c1: '#d97706', c2: '#fde047', c3: '#ffffff', hilt: '#f8fafc' },
  { name: 'Dragon Slayer', c1: '#991b1b', c2: '#ef4444', c3: '#fda4af', hilt: '#fbbf24' },
  { name: 'Great Sword', c1: '#334155', c2: '#94a3b8', c3: '#f1f5f9', hilt: '#78350f' },
  { name: 'Shadow Katana', c1: '#1e1b4b', c2: '#6366f1', c3: '#c7d2fe', hilt: '#ef4444' },
  { name: 'Excalibur', c1: '#eab308', c2: '#fef08a', c3: '#ffffff', hilt: '#2563eb' },
];

function buildSwordsSheet() {
  const surf = new PixelSurface(160, 336);
  SWORD_DEFS.forEach((sw, idx) => {
    const ix = idx * 16;
    const thick = idx === 6 || idx === 7 ? 2 : 1;
    for (let i = 4; i <= 13; i++) {
      const bx = ix + i;
      const by = 15 - i;
      surf.set(bx - 1, by, '#0f111a');
      surf.set(bx, by - 1, '#0f111a');
      surf.set(bx + 1, by, '#0f111a');
      surf.set(bx, by + 1, '#0f111a');
    }
    for (let i = 4; i <= 13; i++) {
      const bx = ix + i;
      const by = 15 - i;
      surf.set(bx, by, i > 10 ? sw.c3 : sw.c2);
      if (thick === 2) surf.set(bx - 1, by, sw.c1);
      else surf.set(bx, by + 1, sw.c1);
    }
    surf.rect(ix + 2, 10, 4, 4, '#0f111a');
    surf.line(ix + 2, 9, ix + 6, 13, sw.hilt);
    surf.set(ix + 2, 13, sw.hilt);
    surf.set(ix + 3, 12, sw.hilt);
    if (idx === 9 || idx === 5) surf.set(ix + 13, 2, '#ffffff');

    const sy = 16 + idx * 32;
    for (let f = 0; f < 3; f++) {
      const fx = f * 32;
      const rOuter = f === 0 ? 11 : f === 1 ? 14 : 13;
      const rInner = f === 0 ? 7 : f === 1 ? 8 : 10;
      const startAng = f === 0 ? -1.4 : f === 1 ? -1.1 : -0.4;
      const endAng = f === 0 ? 0.3 : f === 1 ? 1.1 : 1.4;
      for (let y = -15; y <= 15; y++) {
        for (let x = -4; x <= 15; x++) {
          const dist = Math.hypot(x, y);
          const ang = Math.atan2(y, x);
          if (dist <= rOuter && dist >= rInner && ang >= startAng && ang <= endAng) {
            const col = dist > rOuter - 2 ? sw.c3 : dist > rInner + 2 ? sw.c2 : sw.c1;
            surf.set(fx + 14 + x, sy + 16 + y, col);
          }
        }
      }
    }
  });
  surf.save('swords.png');
}

// ---- 3. 40 DISTINCT KEROCO ENEMIES (128 x 1280 -> 4 frames x 40 rows of 32x32) ----
const KEROCO_TEMPLATES = [
  // 0..9: Slimes & Critters
  { shape: 'slime', c1: '#22c55e', c2: '#86efac', eye: '#0f172a', accent: '#166534' },
  { shape: 'slime', c1: '#06b6d4', c2: '#a5f3fc', eye: '#1e3a8a', accent: '#0e7490' },
  { shape: 'slime', c1: '#f97316', c2: '#fed7aa', eye: '#450a0a', accent: '#dc2626' },
  { shape: 'slime', c1: '#a855f7', c2: '#e9d5ff', eye: '#facc15', accent: '#581c87' },
  { shape: 'slime', c1: '#eab308', c2: '#fef08a', eye: '#713f12', accent: '#ca8a04' },
  { shape: 'crawler', c1: '#d97706', c2: '#fde68a', eye: '#dc2626', accent: '#78350f' },
  { shape: 'crawler', c1: '#65a30d', c2: '#bef264', eye: '#ef4444', accent: '#365314' },
  { shape: 'crawler', c1: '#0284c7', c2: '#7dd3fc', eye: '#fef08a', accent: '#0c4a6e' },
  { shape: 'crawler', c1: '#9333ea', c2: '#d8b4fe', eye: '#22d3ee', accent: '#3b0764' },
  { shape: 'crawler', c1: '#dc2626', c2: '#fca5a5', eye: '#fef08a', accent: '#7f1d1d' },
  // 10..17: Flyers & Bats & Ghosts
  { shape: 'bat', c1: '#7e22ce', c2: '#c084fc', eye: '#facc15', accent: '#4c1d95' },
  { shape: 'bat', c1: '#b91c1c', c2: '#f87171', eye: '#fef08a', accent: '#7f1d1d' },
  { shape: 'bat', c1: '#0284c7', c2: '#7dd3fc', eye: '#ffffff', accent: '#1e3a8a' },
  { shape: 'bat', c1: '#4d7c0f', c2: '#a3e635', eye: '#ef4444', accent: '#1a2e05' },
  { shape: 'ghost', c1: '#94a3b8', c2: '#f1f5f9', eye: '#38bdf8', accent: '#475569' },
  { shape: 'ghost', c1: '#6366f1', c2: '#c7d2fe', eye: '#facc15', accent: '#312e81' },
  { shape: 'ghost', c1: '#ec4899', c2: '#fbcfe8', eye: '#ffffff', accent: '#831843' },
  { shape: 'ghost', c1: '#14b8a6', c2: '#99f6e4', eye: '#fef08a', accent: '#134e4a' },
  // 18..25: Troopers & Shooters & Mages
  { shape: 'trooper', c1: '#dc2626', c2: '#f87171', eye: '#fef08a', accent: '#475569' },
  { shape: 'trooper', c1: '#2563eb', c2: '#93c5fd', eye: '#38bdf8', accent: '#1e293b' },
  { shape: 'trooper', c1: '#16a34a', c2: '#86efac', eye: '#fde047', accent: '#14532d' },
  { shape: 'trooper', c1: '#ca8a04', c2: '#fde047', eye: '#ef4444', accent: '#422006' },
  { shape: 'mage', c1: '#6b21a8', c2: '#c084fc', eye: '#38bdf8', accent: '#facc15' },
  { shape: 'mage', c1: '#b91c1c', c2: '#fb923c', eye: '#fef08a', accent: '#7c2d12' },
  { shape: 'mage', c1: '#0e7490', c2: '#67e8f9', eye: '#ffffff', accent: '#164e63' },
  { shape: 'mage', c1: '#1e293b', c2: '#64748b', eye: '#f43f5e', accent: '#a855f7' },
  // 26..33: Armored Knights & Skeletons & Mummies
  { shape: 'knight', c1: '#475569', c2: '#94a3b8', eye: '#38bdf8', accent: '#eab308' },
  { shape: 'knight', c1: '#991b1b', c2: '#ef4444', eye: '#fef08a', accent: '#fbbf24' },
  { shape: 'knight', c1: '#1e3a8a', c2: '#60a5fa', eye: '#ffffff', accent: '#38bdf8' },
  { shape: 'knight', c1: '#3b0764', c2: '#a855f7', eye: '#f43f5e', accent: '#e9d5ff' },
  { shape: 'skeleton', c1: '#e2e8f0', c2: '#ffffff', eye: '#ef4444', accent: '#64748b' },
  { shape: 'skeleton', c1: '#d97706', c2: '#fef3c7', eye: '#22d3ee', accent: '#78350f' },
  { shape: 'skeleton', c1: '#7c3aed', c2: '#ddd6fe', eye: '#facc15', accent: '#4c1d95' },
  { shape: 'skeleton', c1: '#0f766e', c2: '#99f6e4', eye: '#f97316', accent: '#134e4a' },
  // 34..39: Turrets & Golems
  { shape: 'turret', c1: '#334155', c2: '#64748b', eye: '#38bdf8', accent: '#facc15' },
  { shape: 'turret', c1: '#7f1d1d', c2: '#b91c1c', eye: '#f97316', accent: '#fef08a' },
  { shape: 'turret', c1: '#1e3a8a', c2: '#2563eb', eye: '#22d3ee', accent: '#ffffff' },
  { shape: 'golem', c1: '#78350f', c2: '#b45309', eye: '#facc15', accent: '#451a03' },
  { shape: 'golem', c1: '#0369a1', c2: '#38bdf8', eye: '#ffffff', accent: '#0c4a6e' },
  { shape: 'golem', c1: '#374151', c2: '#9ca3af', eye: '#ef4444', accent: '#f97316' },
];

function buildKerocoEnemiesSheet() {
  const surf = new PixelSurface(128, KEROCO_TEMPLATES.length * 32);
  KEROCO_TEMPLATES.forEach((t, idx) => {
    for (let f = 0; f < 4; f++) {
      const ox = f * 32;
      const oy = idx * 32;
      const flash = f === 3;
      const main = flash ? '#ffffff' : t.c1;
      const hi = flash ? '#fef08a' : t.c2;
      const acc = flash ? '#ffffff' : t.accent;

      if (t.shape === 'slime') {
        const squish = f === 1 ? 2 : f === 2 ? -2 : 0;
        const h = 11 - squish;
        const y = oy + 28 - h;
        surf.rect(ox + 8, y - 1, 16, h + 2, '#0f111a');
        surf.rect(ox + 9, y, 14, h, main);
        surf.rect(ox + 10, y + 1, 10, 3, hi);
        surf.rect(ox + 11, y + 4, 2, 3, t.eye);
        surf.rect(ox + 17, y + 4, 2, 3, t.eye);
        if (idx % 2 === 1) surf.rect(ox + 14, y - 3, 4, 2, acc);
      } else if (t.shape === 'crawler') {
        const legOff = f % 2 === 0 ? 1 : -1;
        surf.rect(ox + 6, oy + 16, 20, 9, '#0f111a');
        surf.rect(ox + 7, oy + 17, 18, 7, main);
        surf.rect(ox + 9, oy + 17, 14, 3, hi);
        surf.rect(ox + 8, oy + 20, 3, 2, t.eye);
        surf.rect(ox + 4, oy + 14, 3, 3, acc); // pincer/horn
        for (let l = 0; l < 3; l++) {
          surf.rect(ox + 8 + l * 6, oy + 25 + (l % 2 === 0 ? legOff : -legOff), 2, 4, acc);
        }
      } else if (t.shape === 'bat') {
        const wingY = f % 2 === 0 ? 10 : 19;
        surf.circle(ox + 16, oy + 16, 5, '#0f111a');
        surf.circle(ox + 16, oy + 16, 4, main);
        surf.set(ox + 14, oy + 15, t.eye);
        surf.set(ox + 18, oy + 15, t.eye);
        surf.line(ox + 12, oy + 16, ox + 4, oy + wingY, '#0f111a');
        surf.line(ox + 12, oy + 15, ox + 5, oy + wingY, hi);
        surf.line(ox + 20, oy + 16, ox + 28, oy + wingY, '#0f111a');
        surf.line(ox + 20, oy + 15, ox + 27, oy + wingY, hi);
      } else if (t.shape === 'ghost') {
        const bob = f === 1 ? -2 : f === 2 ? 1 : 0;
        surf.circle(ox + 16, oy + 14 + bob, 7, '#0f111a');
        surf.circle(ox + 16, oy + 14 + bob, 6, main);
        surf.rect(ox + 10, oy + 14 + bob, 12, 10, main);
        surf.rect(ox + 12, oy + 12 + bob, 2, 3, t.eye);
        surf.rect(ox + 17, oy + 12 + bob, 2, 3, t.eye);
        surf.rect(ox + 11, oy + 24 + bob, 3, 2, hi);
        surf.rect(ox + 17, oy + 24 + bob, 3, 2, hi);
      } else if (t.shape === 'trooper') {
        const step = f === 1 ? 2 : 0;
        surf.rect(ox + 10, oy + 7, 12, 10, '#0f111a');
        surf.rect(ox + 11, oy + 8, 10, 8, main);
        surf.rect(ox + 12, oy + 10, 6, 3, t.eye);
        surf.rect(ox + 11, oy + 17, 10, 7, acc);
        surf.rect(ox + 10 - step, oy + 24, 4, 4, '#475569');
        surf.rect(ox + 18 + step, oy + 24, 4, 4, '#475569');
        surf.rect(ox + 5, oy + 18, 7, 3, hi);
        if (f === 2) surf.circle(ox + 4, oy + 19, 2, '#f97316');
      } else if (t.shape === 'mage') {
        const bob = f === 1 ? -1 : 0;
        surf.rect(ox + 10, oy + 11 + bob, 12, 16, '#0f111a');
        surf.rect(ox + 11, oy + 12 + bob, 10, 14, main);
        surf.rect(ox + 9, oy + 8 + bob, 14, 4, acc); // wizard brim
        surf.rect(ox + 13, oy + 4 + bob, 6, 4, main);
        surf.rect(ox + 12, oy + 14 + bob, 2, 2, t.eye);
        surf.rect(ox + 16, oy + 14 + bob, 2, 2, t.eye);
        // staff
        surf.rect(ox + 6, oy + 10 + bob, 2, 17, '#92400e');
        surf.circle(ox + 7, oy + 9 + bob, 2, f === 2 ? '#fef08a' : hi);
      } else if (t.shape === 'knight') {
        surf.rect(ox + 10, oy + 6, 13, 18, '#0f111a');
        surf.rect(ox + 11, oy + 7, 11, 16, main);
        surf.rect(ox + 12, oy + 10, 4, 2, t.eye);
        surf.rect(ox + 11, oy + 24, 4, 4, '#1e293b');
        surf.rect(ox + 18, oy + 24, 4, 4, '#1e293b');
        const lift = f === 2 ? -4 : 0;
        surf.rect(ox + 5, oy + 10 + lift, 6, 14, '#0f111a');
        surf.rect(ox + 6, oy + 11 + lift, 4, 12, acc);
        surf.rect(ox + 7, oy + 13 + lift, 2, 8, hi);
      } else if (t.shape === 'skeleton') {
        const step = f === 1 ? 2 : 0;
        surf.rect(ox + 11, oy + 6, 10, 9, '#0f111a');
        surf.rect(ox + 12, oy + 7, 8, 7, main);
        surf.rect(ox + 12, oy + 10, 2, 2, t.eye);
        surf.rect(ox + 16, oy + 10, 2, 2, t.eye);
        surf.rect(ox + 13, oy + 16, 6, 8, acc);
        surf.rect(ox + 12, oy + 17, 8, 2, hi);
        surf.rect(ox + 11 - step, oy + 24, 3, 4, main);
        surf.rect(ox + 17 + step, oy + 24, 3, 4, main);
        surf.line(ox + 7, oy + 17, ox + 10, oy + 12, hi); // bone sword
      } else if (t.shape === 'turret') {
        surf.rect(ox + 8, oy + 12, 16, 16, '#0f111a');
        surf.rect(ox + 9, oy + 13, 14, 14, main);
        surf.rect(ox + 12, oy + 16, 8, 6, f === 2 ? '#ef4444' : t.eye);
        surf.rect(ox + 4, oy + 17, 6, 4, acc);
      } else {
        // golem
        const stomp = f === 1 ? -1 : 0;
        surf.rect(ox + 6, oy + 6 + stomp, 20, 22, '#0f111a');
        surf.rect(ox + 7, oy + 7 + stomp, 18, 18, main);
        surf.rect(ox + 9, oy + 8 + stomp, 14, 5, hi);
        surf.rect(ox + 10, oy + 13 + stomp, 4, 3, t.eye);
        surf.rect(ox + 17, oy + 13 + stomp, 4, 3, t.eye);
        surf.rect(ox + 8, oy + 24, 5, 5, acc);
        surf.rect(ox + 19, oy + 24, 5, 5, acc);
      }
    }
  });
  surf.save('enemies_keroco.png');
}

// ---- 4. 10 BOSSES + 1 FINAL BOSS (192 x 528 -> 4 frames x 11 rows of 48x48) ----
const BOSS_PALETTES = [
  { name: 'Ruin Dragon', c1: '#7f1d1d', c2: '#dc2626', horn: '#eab308', eye: '#fef08a', wing: '#991b1b', final: false },
  { name: 'Frost Titan', c1: '#0c4a6e', c2: '#0284c7', horn: '#a5f3fc', eye: '#ffffff', wing: '#38bdf8', final: false },
  { name: 'Sand Sphinx', c1: '#78350f', c2: '#d97706', horn: '#facc15', eye: '#ef4444', wing: '#b45309', final: false },
  { name: 'Magma King', c1: '#450a0a', c2: '#ea580c', horn: '#fde047', eye: '#ffffff', wing: '#f97316', final: false },
  { name: 'Storm Mech', c1: '#1e1b4b', c2: '#4f46e5', horn: '#38bdf8', eye: '#facc15', wing: '#818cf8', final: false },
  { name: 'Crypt Reaper', c1: '#1f2937', c2: '#4b5563', horn: '#e2e8f0', eye: '#a855f7', wing: '#6b21a8', final: false },
  { name: 'Hydra Serpent', c1: '#064e3b', c2: '#059669', horn: '#6ee7b7', eye: '#fde047', wing: '#10b981', final: false },
  { name: 'Void Warden', c1: '#3b0764', c2: '#7e22ce', horn: '#f43f5e', eye: '#22d3ee', wing: '#c084fc', final: false },
  { name: 'Solar Golem', c1: '#713f12', c2: '#ca8a04', horn: '#ffffff', eye: '#38bdf8', wing: '#facc15', final: false },
  { name: 'Cyber Overlord', c1: '#0f172a', c2: '#334155', horn: '#ef4444', eye: '#22d3ee', wing: '#64748b', final: false },
  { name: 'Abyss Emperor', c1: '#1e1b2e', c2: '#9333ea', horn: '#facc15', eye: '#f43f5e', wing: '#ef4444', final: true },
];

function buildBossesSheet() {
  const surf = new PixelSurface(192, BOSS_PALETTES.length * 48);
  BOSS_PALETTES.forEach((b, idx) => {
    for (let f = 0; f < 4; f++) {
      const ox = f * 48;
      const oy = idx * 48;
      const jaw = f === 1 || f === 2 ? 3 : 0;
      const c1 = f === 3 ? '#ffffff' : b.c1;
      const c2 = f === 3 ? '#fef08a' : b.c2;

      // Wings / Shoulder plates (Final Boss has grand wide wings + crown)
      if (b.final || idx % 2 === 0) {
        const wingY = f % 2 === 0 ? 8 : 14;
        surf.rect(ox + 28, oy + wingY, 15, 16, '#0f111a');
        surf.rect(ox + 29, oy + wingY + 1, 13, 14, b.wing);
      }
      // Body
      surf.rect(ox + 14, oy + 14, 24, 26, '#0f111a');
      surf.rect(ox + 15, oy + 15, 22, 24, c1);
      surf.rect(ox + 18, oy + 18, 12, 14, c2);
      // Head & Horns/Crown
      surf.rect(ox + 8, oy + 8, 18, 14, '#0f111a');
      surf.rect(ox + 9, oy + 9, 16, 12, c2);
      surf.rect(ox + 20, oy + 3, 4, 7, b.horn);
      if (b.final) {
        surf.rect(ox + 11, oy + 2, 4, 6, b.horn);
        surf.rect(ox + 15, oy + 1, 4, 7, '#ffffff');
      }
      surf.rect(ox + 12, oy + 12, 4, 3, f === 1 ? '#fef08a' : b.eye);
      // Jaw / Cannon
      surf.rect(ox + 6, oy + 18 + jaw, 10, 4, c1);
      if (f === 1) surf.circle(ox + 6, oy + 17, 3, '#fef08a');
      if (f === 2) surf.circle(ox + 5, oy + 17, 4, '#f97316');
      // Legs
      surf.rect(ox + 14, oy + 39, 8, 7, '#0f111a');
      surf.rect(ox + 28, oy + 39, 8, 7, '#0f111a');
      surf.rect(ox + 15, oy + 40, 6, 5, c1);
      surf.rect(ox + 29, oy + 40, 6, 5, c1);
    }
  });
  surf.save('bosses.png');
}

// Keep legacy enemies.png intact for fallback safety
function buildLegacyEnemiesSheet() {
  const surf = new PixelSurface(192, 208);
  for (let f = 0; f < 4; f++) {
    const ox = f * 32;
    surf.rect(ox + 8, 16, 16, 12, '#22c55e');
  }
  surf.save('enemies.png');
}

// ---- 5. ITEMS, PROJECTILES, CHESTS & VFX ----
function buildItemsVfxSheet() {
  const surf = new PixelSurface(128, 64);
  const drawCell = (col, row, fn) => fn(col * 16, row * 16);

  drawCell(0, 0, (ox, oy) => {
    surf.rect(ox + 5, oy + 4, 6, 9, '#0f111a');
    surf.rect(ox + 6, oy + 6, 4, 6, '#eab308');
    surf.rect(ox + 6, oy + 4, 4, 2, '#94a3b8');
  });
  drawCell(1, 0, (ox, oy) => {
    surf.rect(ox + 3, oy + 4, 10, 9, '#0f111a');
    surf.rect(ox + 4, oy + 6, 3, 6, '#eab308');
    surf.rect(ox + 9, oy + 6, 3, 6, '#eab308');
    surf.rect(ox + 4, oy + 4, 3, 2, '#cbd5e1');
    surf.rect(ox + 9, oy + 4, 3, 2, '#cbd5e1');
  });
  drawCell(2, 0, (ox, oy) => {
    surf.rect(ox + 2, oy + 3, 12, 10, '#0f111a');
    surf.rect(ox + 3, oy + 4, 10, 8, '#166534');
    surf.rect(ox + 4, oy + 6, 8, 4, '#facc15');
    surf.rect(ox + 5, oy + 2, 6, 2, '#94a3b8');
  });
  drawCell(3, 0, (ox, oy) => {
    surf.rect(ox + 6, oy + 2, 4, 3, '#92400e');
    surf.circle(ox + 8, oy + 10, 5, '#0f111a');
    surf.circle(ox + 8, oy + 10, 4, '#ef4444');
    surf.set(ox + 6, oy + 8, '#fecaca');
  });
  drawCell(4, 0, (ox, oy) => {
    surf.rect(ox + 6, oy + 2, 4, 3, '#92400e');
    surf.circle(ox + 8, oy + 10, 5, '#0f111a');
    surf.circle(ox + 8, oy + 10, 4, '#2563eb');
    surf.set(ox + 6, oy + 8, '#bfdbfe');
  });
  drawCell(5, 0, (ox, oy) => {
    surf.circle(ox + 8, oy + 8, 5, '#0f111a');
    surf.circle(ox + 8, oy + 8, 4, '#facc15');
    surf.rect(ox + 7, oy + 6, 2, 4, '#ca8a04');
    surf.set(ox + 6, oy + 6, '#fef9c3');
  });
  drawCell(6, 0, (ox, oy) => {
    surf.rect(ox + 6, oy + 2, 4, 12, '#0f111a');
    surf.rect(ox + 4, oy + 5, 8, 6, '#0f111a');
    surf.rect(ox + 6, oy + 3, 4, 10, '#06b6d4');
    surf.rect(ox + 5, oy + 6, 6, 4, '#67e8f9');
    surf.set(ox + 7, oy + 4, '#ffffff');
  });
  // 7: Iron Ingot
  drawCell(7, 0, (ox, oy) => {
    surf.rect(ox + 2, oy + 5, 12, 7, '#0f111a');
    surf.rect(ox + 3, oy + 6, 10, 5, '#94a3b8');
    surf.rect(ox + 4, oy + 6, 8, 2, '#f1f5f9');
  });

  drawCell(0, 1, (ox, oy) => {
    surf.rect(ox + 3, oy + 5, 10, 6, '#0f111a');
    surf.rect(ox + 4, oy + 6, 8, 4, '#facc15');
    surf.rect(ox + 6, oy + 7, 5, 2, '#ffffff');
  });
  drawCell(1, 1, (ox, oy) => {
    surf.rect(ox + 2, oy + 4, 12, 8, '#38bdf8');
    surf.rect(ox + 4, oy + 6, 8, 4, '#ffffff');
  });
  drawCell(2, 1, (ox, oy) => {
    surf.rect(ox + 2, oy + 2, 12, 12, '#eab308');
    surf.rect(ox + 4, oy + 4, 8, 8, '#fef08a');
    surf.rect(ox + 6, oy + 5, 5, 6, '#ffffff');
  });
  drawCell(3, 1, (ox, oy) => {
    surf.circle(ox + 8, oy + 8, 4, '#0f111a');
    surf.circle(ox + 8, oy + 8, 3, '#ef4444');
    surf.set(ox + 7, oy + 7, '#fef08a');
  });
  drawCell(4, 1, (ox, oy) => {
    surf.circle(ox + 8, oy + 8, 6, '#991b1b');
    surf.circle(ox + 8, oy + 8, 4, '#f97316');
    surf.circle(ox + 8, oy + 8, 2, '#fef08a');
  });
  drawCell(5, 1, (ox, oy) => {
    surf.rect(ox + 4, oy + 1, 7, 14, '#fde047');
    surf.rect(ox + 6, oy + 2, 4, 12, '#ffffff');
  });
  drawCell(6, 1, (ox, oy) => {
    surf.rect(ox + 1, oy + 4, 14, 11, '#0f111a');
    surf.rect(ox + 2, oy + 5, 12, 9, '#92400e');
    surf.rect(ox + 2, oy + 8, 12, 2, '#facc15');
    surf.rect(ox + 7, oy + 7, 2, 4, '#fef08a');
  });
  drawCell(7, 1, (ox, oy) => {
    surf.rect(ox + 1, oy + 7, 14, 8, '#0f111a');
    surf.rect(ox + 2, oy + 8, 12, 6, '#78350f');
    surf.rect(ox + 2, oy + 3, 12, 4, '#b45309');
    surf.rect(ox + 5, oy + 6, 6, 3, '#fef08a');
  });

  for (let f = 0; f < 4; f++) {
    drawCell(f, 2, (ox, oy) => {
      const r = 2 + f * 2;
      surf.line(ox + 8 - r, oy + 8, ox + 8 + r, oy + 8, '#fef08a');
      surf.line(ox + 8, oy + 8 - r, ox + 8, oy + 8 + r, '#38bdf8');
      surf.set(ox + 8, oy + 8, '#ffffff');
    });
    drawCell(f + 4, 2, (ox, oy) => {
      const r = 2 + f * 2;
      surf.circle(ox + 8, oy + 8, Math.min(7, r), f % 2 === 0 ? '#f97316' : '#ef4444');
      surf.circle(ox + 8, oy + 8, Math.max(1, r - 2), '#fef08a');
    });
  }

  for (let f = 0; f < 4; f++) {
    drawCell(f, 3, (ox, oy) => {
      const r = 3 + f;
      surf.line(ox + 8 - r, oy + 8 - r, ox + 8 + r, oy + 8 + r, '#facc15');
      surf.line(ox + 8 - r, oy + 8 + r, ox + 8 + r, oy + 8 - r, '#facc15');
      surf.circle(ox + 8, oy + 8, 2, '#ffffff');
    });
    drawCell(f + 4, 3, (ox, oy) => {
      surf.rect(ox + 3, oy + 1, 10, 14, '#0f111a');
      surf.rect(ox + 4, oy + 2, 8, 12, f % 2 === 0 ? '#06b6d4' : '#3b82f6');
      surf.rect(ox + 6, oy + 4, 4, 8, '#e0f2fe');
    });
  }

  surf.save('items_vfx.png');
}

// ---- 6. MENU ICONS ----
function buildMenuIconsSheet() {
  const surf = new PixelSurface(120, 24);
  surf.circle(12, 12, 9, '#0f111a');
  surf.circle(12, 12, 8, '#2563eb');
  surf.rect(7, 8, 5, 4, '#22c55e');
  surf.rect(13, 11, 5, 6, '#22c55e');
  surf.rect(9, 15, 4, 3, '#16a34a');

  surf.rect(24 + 5, 3, 14, 18, '#0f111a');
  surf.rect(24 + 6, 4, 12, 16, '#fef3c7');
  surf.rect(24 + 4, 4, 16, 3, '#d97706');
  surf.rect(24 + 4, 17, 16, 3, '#d97706');
  surf.rect(24 + 11, 8, 2, 5, '#dc2626');
  surf.rect(24 + 11, 14, 2, 2, '#dc2626');

  surf.rect(48 + 9, 3, 6, 3, '#92400e');
  surf.circle(48 + 12, 14, 7, '#0f111a');
  surf.circle(48 + 12, 14, 6, '#ef4444');
  surf.circle(48 + 17, 17, 4, '#facc15');

  surf.rect(72 + 4, 13, 16, 4, '#475569');
  surf.rect(72 + 7, 17, 10, 4, '#334155');
  surf.rect(72 + 5, 11, 12, 3, '#94a3b8');
  surf.line(72 + 12, 4, 72 + 17, 9, '#eab308');
  surf.rect(72 + 8, 4, 6, 4, '#cbd5e1');

  surf.rect(96 + 6, 5, 12, 14, '#0f111a');
  surf.rect(96 + 7, 6, 10, 12, '#3b82f6');
  surf.rect(96 + 9, 8, 6, 8, '#eab308');
  surf.line(96 + 4, 19, 96 + 19, 4, '#e2e8f0');

  surf.save('menu_icons.png');
}

// ---- 7. GEAR ICONS (96 x 32 -> row 0: 5 Armors 16x16, row 1: 4 Accessories + 2 Grapple Hooks 16x16) ----
function buildGearIconsSheet() {
  const surf = new PixelSurface(96, 32);
  const armorColors = [
    { c1: '#1e3a8a', c2: '#2563eb', hi: '#60a5fa', trim: '#22d3ee' }, // Doom Blue Vest
    { c1: '#475569', c2: '#94a3b8', hi: '#e2e8f0', trim: '#cbd5e1' }, // Iron Mail
    { c1: '#0284c7', c2: '#38bdf8', hi: '#e0f2fe', trim: '#67e8f9' }, // Crystal Plate
    { c1: '#7f1d1d', c2: '#dc2626', hi: '#fca5a5', trim: '#facc15' }, // Dragon Scale
    { c1: '#b45309', c2: '#facc15', hi: '#ffffff', trim: '#38bdf8' }, // Aegis Armor
  ];
  armorColors.forEach((a, i) => {
    const ox = i * 16;
    surf.rect(ox + 3, 2, 10, 12, '#0f111a');
    surf.rect(ox + 2, 3, 12, 5, '#0f111a');
    surf.rect(ox + 4, 3, 8, 10, a.c1);
    surf.rect(ox + 5, 4, 6, 8, a.c2);
    surf.rect(ox + 3, 4, 3, 3, a.hi);
    surf.rect(ox + 10, 4, 3, 3, a.hi);
    surf.rect(ox + 6, 5, 4, 4, a.trim);
    surf.rect(ox + 6, 2, 4, 2, '#0f111a'); // collar notch
  });

  // Row 1: 4 Accessories (Ammo Belt, Crit Ring, Power Gauntlet, Wind Boots) + 2 Grapple Hooks (cols 4..5)
  // 0: Ammo Belt
  surf.rect(2, 16 + 5, 12, 6, '#0f111a');
  surf.rect(3, 16 + 6, 10, 4, '#92400e');
  surf.rect(4, 16 + 7, 2, 2, '#facc15');
  surf.rect(7, 16 + 7, 2, 2, '#facc15');
  surf.rect(10, 16 + 7, 2, 2, '#facc15');
  // 1: Crit Ring
  surf.circle(16 + 8, 16 + 9, 5, '#0f111a');
  surf.circle(16 + 8, 16 + 9, 4, '#eab308');
  surf.circle(16 + 8, 16 + 9, 2, '#0f111a');
  surf.rect(16 + 6, 16 + 2, 4, 4, '#ef4444');
  surf.set(16 + 7, 16 + 3, '#fecaca');
  // 2: Power Gauntlet
  surf.rect(32 + 4, 16 + 3, 8, 10, '#0f111a');
  surf.rect(32 + 5, 16 + 4, 6, 8, '#dc2626');
  surf.rect(32 + 5, 16 + 4, 6, 3, '#facc15');
  surf.rect(32 + 3, 16 + 6, 2, 4, '#991b1b');
  // 3: Wind Boots
  surf.rect(48 + 4, 16 + 3, 6, 10, '#0f111a');
  surf.rect(48 + 4, 16 + 9, 9, 4, '#0f111a');
  surf.rect(48 + 5, 16 + 4, 4, 8, '#14b8a6');
  surf.rect(48 + 5, 16 + 10, 7, 2, '#5eead4');
  surf.line(48 + 9, 16 + 5, 48 + 13, 16 + 3, '#ffffff');
  surf.line(48 + 9, 16 + 7, 48 + 12, 16 + 6, '#bae6fd');

  // 4: Iron Grapple Hook (col 4, y=16)
  surf.line(64 + 3, 16 + 13, 64 + 11, 16 + 5, '#0f111a');
  surf.line(64 + 3, 16 + 12, 64 + 11, 16 + 4, '#94a3b8');
  surf.rect(64 + 8, 16 + 2, 6, 6, '#0f111a');
  surf.line(64 + 8, 16 + 3, 64 + 13, 16 + 3, '#cbd5e1');
  surf.line(64 + 12, 16 + 3, 64 + 12, 16 + 8, '#cbd5e1');
  surf.set(64 + 12, 16 + 3, '#38bdf8');
  surf.rect(64 + 2, 16 + 11, 3, 3, '#334155');

  // 5: Plasma Grapple Hook (col 5, y=16)
  surf.line(80 + 3, 16 + 13, 80 + 11, 16 + 5, '#0f111a');
  surf.line(80 + 3, 16 + 12, 80 + 11, 16 + 4, '#38bdf8');
  surf.rect(80 + 8, 16 + 2, 6, 6, '#0f111a');
  surf.line(80 + 8, 16 + 3, 80 + 13, 16 + 3, '#facc15');
  surf.line(80 + 12, 16 + 3, 80 + 12, 16 + 8, '#facc15');
  surf.set(80 + 12, 16 + 3, '#ffffff');
  surf.rect(80 + 2, 16 + 11, 3, 3, '#1d4ed8');

  surf.save('gear.png');
}

// ---- 8. ROTATING LARGE SQUARE PORTALS (256 x 64 -> 8 frames x 2 kinds of 32x32) ----
function buildPortalsSheet() {
  const surf = new PixelSurface(256, 64);
  const kinds = [
    // Row 0: Exit Portal (Emerald / Gold rotating vortex square)
    { outer: '#facc15', mid: '#22c55e', inner: '#bbf7d0', core: '#ffffff' },
    // Row 1: Branch Warp Portal (Cyan / Violet rotating vortex square)
    { outer: '#38bdf8', mid: '#7c3aed', inner: '#e0f2fe', core: '#ffffff' },
  ];
  kinds.forEach((k, row) => {
    for (let f = 0; f < 8; f++) {
      const ox = f * 32;
      const oy = row * 32;
      const ang = (f / 8) * (Math.PI / 2);
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      // Draw larger rotating square frame (half-size 12 -> ~26x26 bounding box inside 32x32)
      for (let y = -14; y <= 14; y++) {
        for (let x = -14; x <= 14; x++) {
          const rx = x * cos - y * sin;
          const ry = x * sin + y * cos;
          const cheb = Math.max(Math.abs(rx), Math.abs(ry));
          if (cheb <= 12.2 && cheb >= 9.6) {
            surf.set(ox + 16 + x, oy + 16 + y, '#0f111a');
          }
          if (cheb <= 11.4 && cheb >= 10.2) {
            surf.set(ox + 16 + x, oy + 16 + y, k.outer);
          } else if (cheb < 10.2 && cheb >= 5.2) {
            // Spiral swirl pattern
            const angle = Math.atan2(y, x) + f * 0.8 + cheb * 0.45;
            surf.set(ox + 16 + x, oy + 16 + y, Math.sin(angle * 2) > 0 ? k.mid : k.inner);
          } else if (cheb < 5.2) {
            surf.set(ox + 16 + x, oy + 16 + y, cheb < 2.2 ? k.core : k.inner);
          }
        }
      }
    }
  });
  surf.save('portals.png');
}

// ---- 9. 6-BIOME TILESET (160 x 96 -> 10 cols x 6 biome rows of 16x16) ----
// Biomes: 0=Waterfall, 1=Desert, 2=Snow, 3=Volcano, 4=Galaxy, 5=Graveyard
const BIOME_PALETTES = [
  { top: '#22c55e', topH: '#86efac', rock1: '#334155', rock2: '#1e293b', rockH: '#64748b', plat: '#0284c7', accent: '#38bdf8', water1: '#0284c7', water2: '#7dd3fc' }, // 0: Air Terjun
  { top: '#f59e0b', topH: '#fde68a', rock1: '#b45309', rock2: '#78350f', rockH: '#d97706', plat: '#d97706', accent: '#fef08a', water1: '#0369a1', water2: '#38bdf8' }, // 1: Gurun
  { top: '#f8fafc', topH: '#ffffff', rock1: '#38bdf8', rock2: '#0369a1', rockH: '#bae6fd', plat: '#0284c7', accent: '#e0f2fe', water1: '#0ea5e9', water2: '#e0f2fe' }, // 2: Salju
  { top: '#f97316', topH: '#fed7aa', rock1: '#450a0a', rock2: '#271212', rockH: '#7f1d1d', plat: '#b91c1c', accent: '#facc15', water1: '#ea580c', water2: '#fef08a' }, // 3: Vulkano
  { top: '#a855f7', topH: '#e9d5ff', rock1: '#1e1b4b', rock2: '#0f0d1f', rockH: '#4338ca', plat: '#6366f1', accent: '#22d3ee', water1: '#4f46e5', water2: '#c084fc' }, // 4: Galaxy
  { top: '#65a30d', topH: '#bef264', rock1: '#374151', rock2: '#1f2937', rockH: '#6b7280', plat: '#4b5563', accent: '#c084fc', water1: '#115e59', water2: '#5eead4' }, // 5: Kuburan
];

function buildTilesSheet() {
  const surf = new PixelSurface(160, 96);
  BIOME_PALETTES.forEach((p, bIdx) => {
    const oy = bIdx * 16;
    // 0: Solid Ground Top
    surf.rect(0, oy, 16, 16, p.rock2);
    surf.rect(1, oy + 4, 14, 11, p.rock1);
    surf.rect(0, oy, 16, 4, p.top);
    surf.rect(0, oy, 16, 1, p.topH);
    surf.rect(3, oy + 7, 4, 3, p.rockH);
    surf.rect(10, oy + 10, 4, 3, p.rockH);

    // 1: Solid Brick Fill
    surf.rect(16, oy, 16, 16, p.rock2);
    surf.rect(17, oy + 1, 6, 6, p.rock1);
    surf.rect(25, oy + 1, 6, 6, p.rock1);
    surf.rect(20, oy + 9, 8, 6, p.rock1);
    surf.rect(17, oy + 1, 6, 1, p.rockH);

    // 2: One-way Platform
    surf.rect(32, oy, 16, 5, '#0f111a');
    surf.rect(32, oy + 1, 16, 3, p.plat);
    surf.rect(32, oy + 1, 16, 1, p.topH);

    // 3: Vertical Ladder
    surf.rect(48 + 3, oy, 2, 16, '#92400e');
    surf.rect(48 + 11, oy, 2, 16, '#92400e');
    surf.rect(48 + 3, oy + 3, 10, 2, '#facc15');
    surf.rect(48 + 3, oy + 11, 10, 2, '#facc15');

    // 4: Spikes
    for (let s = 0; s < 2; s++) {
      const sx = 64 + s * 8;
      surf.rect(sx + 3, oy + 4, 2, 12, '#ffffff');
      surf.rect(sx + 2, oy + 7, 4, 9, '#cbd5e1');
      surf.rect(sx + 1, oy + 11, 6, 5, '#64748b');
    }

    // 5: Pillar / Torch
    surf.rect(80 + 5, oy, 6, 16, p.rock1);
    surf.rect(80 + 6, oy + 2, 4, 4, p.accent);

    // 6: Moving Platform Tile (col 6)
    surf.rect(96, oy, 16, 8, '#0f111a');
    surf.rect(97, oy + 1, 14, 6, p.plat);
    surf.rect(98, oy + 2, 12, 2, p.accent);
    surf.set(99, oy + 5, '#ffffff');
    surf.set(108, oy + 5, '#ffffff');

    // 7: Overhead Horizontal Monkey Bar / Climb Rail (col 7)
    surf.rect(112, oy + 2, 16, 4, '#0f111a');
    surf.rect(112, oy + 3, 16, 2, '#facc15');
    surf.rect(114, oy + 1, 2, 6, '#94a3b8');
    surf.rect(122, oy + 1, 2, 6, '#94a3b8');

    // 8: Water Surface (col 8) & 9: Deep Water (col 9)
    surf.rect(128, oy + 3, 16, 13, p.water1);
    surf.rect(128, oy + 2, 16, 3, p.water2);
    surf.rect(130, oy + 2, 4, 1, '#ffffff');
    surf.rect(138, oy + 3, 4, 1, '#ffffff');
    surf.rect(144, oy, 16, 16, p.water1);
    surf.rect(147, oy + 4, 3, 1, p.water2);
    surf.rect(153, oy + 10, 3, 1, p.water2);
  });
  surf.save('tiles.png');
}

// ---- 10. 6-BIOME PARALLAX BACKGROUNDS (256 x 1440) ----
function buildBackgroundsSheet() {
  const surf = new PixelSurface(256, 1440);
  const bgConfigs = [
    // 0: Air Terjun (Waterfall)
    { kind: 'waterfall', sky1: '#071b24', sky2: '#0f3847', sky3: '#155e75', moon: '#fef08a', hill1: '#14532d', hill2: '#166534', star: '#bae6fd' },
    // 1: Gurun (Desert)
    { kind: 'desert', sky1: '#451a03', sky2: '#92400e', sky3: '#d97706', moon: '#fef08a', hill1: '#b45309', hill2: '#f59e0b', star: '#fde68a' },
    // 2: Salju (Snow)
    { kind: 'snow', sky1: '#082f49', sky2: '#0369a1', sky3: '#38bdf8', moon: '#f8fafc', hill1: '#1e3a8a', hill2: '#e0f2fe', star: '#ffffff' },
    // 3: Vulkano (Volcano)
    { kind: 'volcano', sky1: '#1c0707', sky2: '#450a0a', sky3: '#9a3412', moon: '#fb923c', hill1: '#271212', hill2: '#7f1d1d', star: '#fde047' },
    // 4: Galaxy
    { kind: 'galaxy', sky1: '#040312', sky2: '#1e1b4b', sky3: '#4c1d95', moon: '#c084fc', hill1: '#1e1b4b', hill2: '#312e81', star: '#e0f2fe' },
    // 5: Kuburan (Graveyard)
    { kind: 'graveyard', sky1: '#090717', sky2: '#1f1638', sky3: '#312e59', moon: '#e2e8f0', hill1: '#111827', hill2: '#1f2937', star: '#cbd5e1' },
  ];

  bgConfigs.forEach((cfg, idx) => {
    const oy = idx * 240;
    for (let y = 0; y < 240; y++) {
      for (let x = 0; x < 256; x++) {
        let col = cfg.sky1;
        if (y >= 44 && y < 60) col = (x + y) % 2 === 0 ? cfg.sky1 : cfg.sky2;
        else if (y >= 60 && y < 110) col = cfg.sky2;
        else if (y >= 110 && y < 128) col = (x + y) % 2 === 0 ? cfg.sky2 : cfg.sky3;
        else if (y >= 128) col = cfg.sky3;
        surf.set(x, oy + y, col);
      }
    }

    // Sky celestial body (Sun/Moon/Ringed Planet)
    if (cfg.kind === 'desert') {
      surf.circle(202, oy + 44, 13, '#fde047');
    } else if (cfg.kind === 'galaxy') {
      surf.circle(196, oy + 46, 12, '#a855f7');
      surf.line(176, oy + 52, 216, oy + 40, '#38bdf8');
      surf.line(178, oy + 53, 214, oy + 41, '#e0f2fe');
    } else if (cfg.kind === 'graveyard') {
      surf.circle(204, oy + 42, 13, '#f1f5f9');
    } else {
      surf.circle(204, oy + 42, 11, cfg.moon);
      surf.circle(208, oy + 39, 9, cfg.sky1);
    }

    // Stars / Snowflakes / Embers
    let seed = (idx + 1) * 4919;
    const starCount = cfg.kind === 'galaxy' ? 68 : 34;
    for (let i = 0; i < starCount; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const sx = seed % 256;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const sy = oy + 8 + (seed % 110);
      surf.set(sx, sy, cfg.star);
    }

    // Biome-specific horizon features
    if (cfg.kind === 'desert') {
      // Pyramids
      for (let p = 0; p < 2; p++) {
        const px = 40 + p * 120;
        const size = p === 0 ? 48 : 36;
        for (let r = 0; r < size; r++) {
          surf.rect(px - r, oy + 170 + r, r * 2 + 1, 1, r % 4 === 0 ? '#92400e' : '#b45309');
        }
      }
    } else if (cfg.kind === 'volcano') {
      // Volcano peak + glowing crater
      for (let r = 0; r < 64; r++) {
        const half = 12 + r;
        surf.rect(128 - half, oy + 140 + r, half * 2, 1, '#271212');
      }
      surf.rect(116, oy + 138, 24, 4, '#f97316');
      surf.rect(120, oy + 136, 16, 3, '#fef08a');
    }

    // Hills / Cliffs
    for (let x = 0; x < 256; x++) {
      const h1 = Math.round(68 + Math.sin((x / 256) * Math.PI * 4) * 20 + Math.cos((x / 256) * Math.PI * 8) * 9);
      surf.rect(x, oy + 240 - h1, 1, h1, cfg.hill1);
      const h2 = Math.round(42 + Math.sin((x / 256) * Math.PI * 6 + 1.2) * 12);
      surf.rect(x, oy + 240 - h2, 1, h2, cfg.hill2);
    }

    if (cfg.kind === 'waterfall') {
      // Cascading pixel waterfall columns
      for (const wx of [54, 178]) {
        surf.rect(wx, oy + 150, 18, 90, '#0284c7');
        surf.rect(wx + 3, oy + 150, 4, 90, '#7dd3fc');
        surf.rect(wx + 11, oy + 152, 3, 88, '#e0f2fe');
        surf.rect(wx - 2, oy + 232, 22, 6, '#e0f2fe');
      }
    } else if (cfg.kind === 'graveyard') {
      // Tombstones & crosses
      for (const tx of [28, 76, 134, 210]) {
        surf.rect(tx, oy + 188, 10, 14, '#4b5563');
        surf.rect(tx + 2, oy + 186, 6, 2, '#6b7280');
        surf.rect(tx + 4, oy + 190, 2, 7, '#1f2937');
        surf.rect(tx + 2, oy + 192, 6, 2, '#1f2937');
      }
    }
  });
  surf.save('backgrounds.png');
}

// ---- 11. 10 GUNS & PROJECTILES ----
const GUN_PALETTES = [
  { body: '#64748b', hi: '#cbd5e1', core: '#38bdf8', grip: '#78350f', shot: '#facc15', shotCore: '#ffffff', shotgun: false },
  { body: '#1d4ed8', hi: '#93c5fd', core: '#facc15', grip: '#1e293b', shot: '#38bdf8', shotCore: '#e0f2fe', shotgun: false },
  { body: '#475569', hi: '#94a3b8', core: '#f97316', grip: '#92400e', shot: '#fb923c', shotCore: '#fef08a', shotgun: true },
  { body: '#0284c7', hi: '#67e8f9', core: '#ffffff', grip: '#1e3a8a', shot: '#22d3ee', shotCore: '#ffffff', shotgun: false },
  { body: '#991b1b', hi: '#f87171', core: '#fde047', grip: '#451a03', shot: '#ef4444', shotCore: '#fef08a', shotgun: true },
  { body: '#ca8a04', hi: '#fef08a', core: '#38bdf8', grip: '#1e293b', shot: '#facc15', shotCore: '#ffffff', shotgun: false },
  { body: '#b91c1c', hi: '#fb923c', core: '#fef08a', grip: '#271212', shot: '#f97316', shotCore: '#ffffff', shotgun: false },
  { body: '#3b0764', hi: '#c084fc', core: '#f43f5e', grip: '#0f172a', shot: '#a855f7', shotCore: '#fdf4ff', shotgun: false },
  { body: '#0f766e', hi: '#5eead4', core: '#facc15', grip: '#1e293b', shot: '#2dd4bf', shotCore: '#ffffff', shotgun: false },
  { body: '#eab308', hi: '#fef9c3', core: '#38bdf8', grip: '#1e3a8a', shot: '#fde047', shotCore: '#ffffff', shotgun: false },
];

function buildGunsSheet() {
  const surf = new PixelSurface(160, 32);
  GUN_PALETTES.forEach((g, idx) => {
    const ox = idx * 16;
    const barrelLen = g.shotgun ? 10 : idx >= 6 ? 12 : 9;
    const barrelH = g.shotgun ? 4 : idx >= 6 ? 4 : 3;
    surf.rect(ox + 2, 5, barrelLen + 1, barrelH + 2, '#0f111a');
    surf.rect(ox + 3, 6, barrelLen - 1, barrelH, g.body);
    surf.rect(ox + 3, 6, barrelLen - 1, 1, g.hi);
    surf.rect(ox + 5, 7, 2, 2, g.core);
    surf.rect(ox + 3, 9, 4, 5, '#0f111a');
    surf.rect(ox + 4, 9, 2, 4, g.grip);
    if (g.shotgun) {
      surf.rect(ox + 7, 10, 5, 2, g.grip);
    }

    const py = 16;
    if (g.shotgun) {
      surf.circle(ox + 8, py + 8, 3, '#0f111a');
      surf.circle(ox + 8, py + 8, 2, g.shot);
      surf.set(ox + 8, py + 8, g.shotCore);
    } else if (idx === 9) {
      surf.rect(ox + 1, py + 5, 14, 6, '#0f111a');
      surf.rect(ox + 2, py + 6, 12, 4, g.shot);
      surf.rect(ox + 3, py + 7, 10, 2, g.shotCore);
    } else {
      surf.rect(ox + 3, py + 5, 10, 6, '#0f111a');
      surf.rect(ox + 4, py + 6, 8, 4, g.shot);
      surf.rect(ox + 6, py + 7, 5, 2, g.shotCore);
    }
  });
  surf.save('guns.png');
}

buildHeroSheet();
buildSwordsSheet();
buildKerocoEnemiesSheet();
buildBossesSheet();
buildLegacyEnemiesSheet();
buildItemsVfxSheet();
buildMenuIconsSheet();
buildGearIconsSheet();
buildPortalsSheet();
buildTilesSheet();
buildBackgroundsSheet();
buildGunsSheet();
