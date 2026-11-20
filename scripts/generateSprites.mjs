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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter None
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

  drawPattern(ox, oy, pattern, palette) {
    for (let y = 0; y < pattern.length; y++) {
      const row = pattern[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch !== '.' && palette[ch]) {
          this.set(ox + x, oy + y, palette[ch]);
        }
      }
    }
  }

  save(filename) {
    const outPath = path.join(OUT_DIR, filename);
    fs.writeFileSync(outPath, encodePNG(this.w, this.h, this.buf));
    console.log(`Generated ${filename} (${this.w}x${this.h})`);
  }
}

// ---- 1. HERO SPRITE SHEET (192 x 544 -> 6 cols x 17 rows of 32x32) ----
const HERO_PAL = {
  O: '#0f111a', // outline
  H1: '#1d4ed8', // blue hair shadow
  H2: '#3b82f6', // blue hair mid
  H3: '#93c5fd', // blue hair highlight
  S1: '#e0a97d', // skin shadow
  S2: '#fcd5b5', // skin light
  E: '#0f172a', // eyes
  EW: '#ffffff', // eye shine
  B1: '#b91c1c', // headband/scarf dark
  B2: '#ef4444', // headband/scarf bright
  T1: '#0f766e', // adventurer tunic shadow
  T2: '#14b8a6', // adventurer tunic mid
  T3: '#5eead4', // tunic highlight
  L1: '#451a03', // leather belt/boots shadow
  L2: '#92400e', // leather boots/gloves
  G1: '#eab308', // gold buckle/crest
  P1: '#475569', // gun metal dark
  P2: '#94a3b8', // gun metal light
  P3: '#38bdf8', // buster energy core
  W1: '#cbd5e1', // blade light
  W2: '#ffffff', // blade gleam
  FX1: '#fef08a', // muzzle/slash flash
  FX2: '#38bdf8', // energy flash
  POT1: '#22c55e', // potion green
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
    legMode = 'idle', // idle, walk0..3, run0..5, jump, fall, land, climb0..3, dash, hurt, dead0..4
    armMode = 'buster', // buster, shoot, shootUp, shootDown, swordWind, swordSwing, swordUp, swordSpin, climb0..1, hurt, potion0..3
    muzzle = false,
    swordFrame = -1,
    climbFrame = -1,
    deadFrame = -1,
    hurtFlash = false,
  } = opts;

  if (deadFrame >= 0) {
    if (deadFrame === 0) {
      drawHeroFrame(surf, col, row, { legMode: 'hurt', armMode: 'hurt', bobY: 1, hurtFlash: true });
      return;
    }
    if (deadFrame === 1) {
      // falling to knees
      surf.rect(ox + 10, oy + 14, 12, 10, HERO_PAL.O);
      surf.rect(ox + 11, oy + 15, 10, 8, HERO_PAL.T1);
      surf.rect(ox + 11, oy + 8, 10, 7, HERO_PAL.H2);
      surf.rect(ox + 12, oy + 10, 7, 4, HERO_PAL.S2);
      surf.rect(ox + 9, oy + 24, 6, 4, HERO_PAL.L2);
      surf.rect(ox + 17, oy + 24, 6, 4, HERO_PAL.L2);
      return;
    }
    if (deadFrame === 2) {
      // collapsed
      surf.rect(ox + 6, oy + 22, 20, 6, HERO_PAL.O);
      surf.rect(ox + 7, oy + 23, 18, 4, HERO_PAL.T1);
      surf.rect(ox + 6, oy + 21, 7, 5, HERO_PAL.H2);
      surf.rect(ox + 20, oy + 23, 5, 4, HERO_PAL.L2);
      return;
    }
    // frames 3-4: Mega Man style pixel burst orbs
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

  const cx = ox + 16 + leanX;
  const baseY = oy + 28; // feet ground line
  const bodyTop = oy + 13 + bobY + squashY;

  // Scarf trail behind hero
  const scarfLen = legMode === 'dash' ? 9 : (legMode.startsWith('run') ? 6 : 4);
  for (let i = 0; i < scarfLen; i++) {
    const sy = bodyTop + 1 + Math.round(Math.sin((i + scarfWave) * 0.9) * 1.2);
    const sx = cx - 4 - i;
    surf.set(sx, sy, HERO_PAL.O);
    surf.set(sx, sy + 1, i % 2 === 0 ? HERO_PAL.B2 : HERO_PAL.B1);
    surf.set(sx, sy + 2, HERO_PAL.O);
  }

  // Legs & Boots
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
    // thruster flame behind boots
    surf.rect(cx - 12, baseY - 4, 3, 2, HERO_PAL.FX2);
    surf.set(cx - 13, baseY - 3, HERO_PAL.W2);
  } else if (legMode === 'hurt') {
    drawBoot(cx - 6, baseY - 5, 4, 4);
    drawBoot(cx + 2, baseY - 3, 4, 4);
  } else {
    // walk / run cycles
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

  // Torso (Adventurer Tunic + Gold Belt)
  const torsoH = 9 - squashY;
  surf.rect(cx - 5, bodyTop - 1, 10, torsoH + 2, HERO_PAL.O);
  surf.rect(cx - 4, bodyTop, 8, torsoH, hurtFlash ? HERO_PAL.W2 : HERO_PAL.T2);
  surf.rect(cx - 4, bodyTop, 3, torsoH, hurtFlash ? HERO_PAL.FX1 : HERO_PAL.T1);
  surf.rect(cx + 1, bodyTop + 1, 2, 3, HERO_PAL.T3);
  // Belt
  surf.rect(cx - 4, bodyTop + torsoH - 3, 8, 2, HERO_PAL.L1);
  surf.rect(cx - 1, bodyTop + torsoH - 3, 3, 2, HERO_PAL.G1);

  // Head & Spiky Blue Hair
  const headY = bodyTop - 10;
  // Hair back & spikes
  surf.rect(cx - 6, headY - 1, 12, 10, HERO_PAL.O);
  surf.rect(cx - 5, headY, 10, 8, HERO_PAL.H2);
  // spiky hair tufts
  surf.rect(cx - 6, headY + 1, 2, 3, HERO_PAL.H1);
  surf.rect(cx - 3, headY - 2, 3, 2, HERO_PAL.H2);
  surf.rect(cx + 1, headY - 2, 4, 2, HERO_PAL.H3);
  surf.rect(cx + 4, headY + 1, 3, 2, HERO_PAL.H3);
  surf.set(cx - 3, headY - 3, HERO_PAL.O);
  surf.set(cx + 2, headY - 3, HERO_PAL.O);

  if (climbFrame >= 0) {
    // Back of head + headband tie
    surf.rect(cx - 5, headY + 3, 10, 2, HERO_PAL.B2);
    surf.rect(cx - 1, headY + 5, 2, 3, HERO_PAL.B1);
  } else {
    // Face
    surf.rect(cx - 1, headY + 3, 6, 6, HERO_PAL.S2);
    surf.rect(cx - 1, headY + 3, 1, 6, HERO_PAL.S1);
    // Headband
    surf.rect(cx - 5, headY + 2, 10, 2, HERO_PAL.B2);
    surf.rect(cx - 5, headY + 2, 3, 2, HERO_PAL.B1);
    // Eye
    surf.rect(cx + 2, headY + 4, 2, 3, HERO_PAL.E);
    surf.set(cx + 2, headY + 4, HERO_PAL.EW);
  }

  // Arms, Buster Gun, Potion, or Sword Swing
  if (climbFrame >= 0) {
    const la = climbFrame % 2 === 0 ? -3 : 0;
    const ra = climbFrame % 2 === 0 ? 0 : -3;
    surf.rect(cx - 7, bodyTop + la, 3, 5, HERO_PAL.L2);
    surf.rect(cx + 4, bodyTop + ra, 3, 5, HERO_PAL.L2);
    return;
  }

  if (armMode.startsWith('potion')) {
    const pStep = parseInt(armMode.replace(/\D/g, ''), 10) || 0;
    const py = bodyTop + 1 - pStep;
    // Arm raised holding green glowing potion
    surf.rect(cx + 3, bodyTop + 1, 4, 3, HERO_PAL.L2);
    surf.rect(cx + 5, py - 5, 4, 5, HERO_PAL.O);
    surf.rect(cx + 6, py - 4, 2, 3, HERO_PAL.POT1);
    surf.set(cx + 6, py - 5, HERO_PAL.POT2);
    return;
  }

  if (armMode === 'shootUp') {
    // Buster gun pointed vertically up
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
    // Buster gun pointed down
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
    // Sword attack pose: arm + blade
    const dir = armMode === 'swordWind' ? -1 : 1;
    surf.rect(cx + 3, bodyTop + 2, 4, 3, HERO_PAL.L2);
    if (swordFrame === 0) {
      // Windup blade back over shoulder
      surf.line(cx - 2, bodyTop + 1, cx - 7, bodyTop - 6, HERO_PAL.O);
      surf.line(cx - 2, bodyTop, cx - 6, bodyTop - 6, HERO_PAL.W1);
    } else if (swordFrame === 1) {
      // Extended forward slash
      surf.rect(cx + 5, bodyTop + 1, 10, 3, HERO_PAL.O);
      surf.rect(cx + 6, bodyTop + 2, 8, 1, HERO_PAL.W2);
      surf.rect(cx + 5, bodyTop + 1, 2, 3, HERO_PAL.G1);
    } else if (swordFrame === 2) {
      // Diagonal follow-through
      surf.line(cx + 5, bodyTop + 2, cx + 13, bodyTop + 8 * dir, HERO_PAL.O);
      surf.line(cx + 5, bodyTop + 1, cx + 12, bodyTop + 7 * dir, HERO_PAL.W2);
    } else {
      // Spin / return guard
      surf.line(cx + 4, bodyTop + 3, cx + 10, bodyTop - 5, HERO_PAL.W1);
    }
    return;
  }

  // Default / Shoot / Dash / Hurt Buster Arm
  const gunExt = armMode === 'shoot' ? 8 : 6;
  const gunY = bodyTop + 2;
  surf.rect(cx + 2, gunY - 1, gunExt + 1, 5, HERO_PAL.O);
  surf.rect(cx + 3, gunY, gunExt - 1, 3, HERO_PAL.P2);
  surf.rect(cx + 3, gunY + 2, gunExt - 1, 1, HERO_PAL.P1);
  surf.set(cx + 4, gunY + 1, HERO_PAL.P3);
  if (muzzle) {
    surf.circle(cx + 3 + gunExt + 1, gunY + 1, 2, HERO_PAL.FX1);
    surf.set(cx + 3 + gunExt + 2, gunY + 1, HERO_PAL.W2);
  }
}

function buildHeroSheet() {
  const surf = new PixelSurface(192, 544);
  // 0: idle (4)
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 0, { bobY: i === 2 ? 1 : 0, scarfWave: i });
  // 1: walk (4)
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 1, { legMode: `walk${i}`, bobY: i % 2 === 1 ? -1 : 0, scarfWave: i });
  // 2: run (6)
  for (let i = 0; i < 6; i++) drawHeroFrame(surf, i, 2, { legMode: `run${i}`, leanX: 1, bobY: i % 3 === 1 ? -1 : 0, scarfWave: i * 1.4 });
  // 3: jump (3)
  drawHeroFrame(surf, 0, 3, { legMode: 'land', squashY: 1, scarfWave: 0 });
  drawHeroFrame(surf, 1, 3, { legMode: 'jump', bobY: -2, scarfWave: 2 });
  drawHeroFrame(surf, 2, 3, { legMode: 'jump', bobY: -3, scarfWave: 4 });
  // 4: fall (3)
  for (let i = 0; i < 3; i++) drawHeroFrame(surf, i, 4, { legMode: 'fall', bobY: -1, scarfWave: i * 2 });
  // 5: landing (2)
  drawHeroFrame(surf, 0, 5, { legMode: 'land', squashY: 2, scarfWave: 1 });
  drawHeroFrame(surf, 1, 5, { legMode: 'idle', squashY: 1, scarfWave: 2 });
  // 6: sword attack 1 (4)
  drawHeroFrame(surf, 0, 6, { armMode: 'swordWind', swordFrame: 0 });
  drawHeroFrame(surf, 1, 6, { armMode: 'swordSwing', swordFrame: 1, leanX: 2 });
  drawHeroFrame(surf, 2, 6, { armMode: 'swordSwing', swordFrame: 2, leanX: 2 });
  drawHeroFrame(surf, 3, 6, { armMode: 'swordSwing', swordFrame: 3, leanX: 1 });
  // 7: sword attack 2 (4)
  drawHeroFrame(surf, 0, 7, { armMode: 'swordWind', swordFrame: 0, bobY: 1 });
  drawHeroFrame(surf, 1, 7, { armMode: 'swordUp', swordFrame: 2, leanX: 2 });
  drawHeroFrame(surf, 2, 7, { armMode: 'swordUp', swordFrame: 1, leanX: 2 });
  drawHeroFrame(surf, 3, 7, { armMode: 'swordUp', swordFrame: 3, leanX: 1 });
  // 8: sword attack 3 (5)
  drawHeroFrame(surf, 0, 8, { armMode: 'swordWind', swordFrame: 0, leanX: -1 });
  drawHeroFrame(surf, 1, 8, { armMode: 'swordSpin', swordFrame: 3, leanX: 1, bobY: -1 });
  drawHeroFrame(surf, 2, 8, { armMode: 'swordSpin', swordFrame: 1, leanX: 3 });
  drawHeroFrame(surf, 3, 8, { armMode: 'swordSpin', swordFrame: 2, leanX: 3 });
  drawHeroFrame(surf, 4, 8, { armMode: 'swordSpin', swordFrame: 3, leanX: 1 });
  // 9: shoot (3)
  drawHeroFrame(surf, 0, 9, { armMode: 'shoot', muzzle: true, leanX: -1 });
  drawHeroFrame(surf, 1, 9, { armMode: 'shoot', muzzle: false });
  drawHeroFrame(surf, 2, 9, { armMode: 'buster' });
  // 10: shoot up (3)
  drawHeroFrame(surf, 0, 10, { armMode: 'shootUp', muzzle: true });
  drawHeroFrame(surf, 1, 10, { armMode: 'shootUp', muzzle: false });
  drawHeroFrame(surf, 2, 10, { armMode: 'shootUp', muzzle: false, bobY: 1 });
  // 11: shoot down (3)
  drawHeroFrame(surf, 0, 11, { legMode: 'fall', armMode: 'shootDown', muzzle: true });
  drawHeroFrame(surf, 1, 11, { legMode: 'fall', armMode: 'shootDown', muzzle: false });
  drawHeroFrame(surf, 2, 11, { legMode: 'fall', armMode: 'shootDown', muzzle: false, bobY: -1 });
  // 12: hurt (3)
  drawHeroFrame(surf, 0, 12, { legMode: 'hurt', leanX: -2, hurtFlash: true });
  drawHeroFrame(surf, 1, 12, { legMode: 'hurt', leanX: -1, hurtFlash: false });
  drawHeroFrame(surf, 2, 12, { legMode: 'hurt', leanX: -1, hurtFlash: true });
  // 13: death (5)
  for (let i = 0; i < 5; i++) drawHeroFrame(surf, i, 13, { deadFrame: i });
  // 14: climb (4)
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 14, { climbFrame: i });
  // 15: dash (3)
  for (let i = 0; i < 3; i++) drawHeroFrame(surf, i, 15, { legMode: 'dash', leanX: 3, bobY: 2, scarfWave: i * 2 });
  // 16: potion use (4)
  for (let i = 0; i < 4; i++) drawHeroFrame(surf, i, 16, { armMode: `potion${i}`, bobY: i === 2 ? -1 : 0 });

  surf.save('hero.png');
}

// ---- 2. 10 SWORDS SHEET (160 x 336: row 0 = 10x 16x16 icons; y=16..335 = 10x 3-frame 32x32 slash arcs) ----
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
    // 16x16 icon
    const ix = idx * 16;
    const thick = idx === 6 || idx === 7 ? 2 : 1;
    // Diagonal blade bottom-left to top-right
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
    // Crossguard + Grip
    surf.rect(ix + 2, 10, 4, 4, '#0f111a');
    surf.line(ix + 2, 9, ix + 6, 13, sw.hilt);
    surf.set(ix + 2, 13, sw.hilt);
    surf.set(ix + 3, 12, sw.hilt);
    if (idx === 9 || idx === 5) surf.set(ix + 13, 2, '#ffffff');

    // 3-frame 32x32 slash arc starting at y = 16 + idx * 32
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

// ---- 3. ENEMIES & BOSS SHEET (192 x 208) ----
function buildEnemiesSheet() {
  const surf = new PixelSurface(192, 208);

  // Row 0: Slime Hopper (4 frames, 32x32)
  for (let f = 0; f < 4; f++) {
    const ox = f * 32, oy = 0;
    const squish = f === 1 ? 2 : f === 2 ? -2 : 0;
    const h = 11 - squish;
    const y = oy + 28 - h;
    surf.rect(ox + 8, y - 1, 16, h + 2, '#0f111a');
    surf.rect(ox + 9, y, 14, h, f === 3 ? '#ffffff' : '#22c55e');
    surf.rect(ox + 10, y + 1, 10, 3, f === 3 ? '#fef08a' : '#86efac');
    surf.rect(ox + 11, y + 4, 2, 3, '#0f172a');
    surf.rect(ox + 17, y + 4, 2, 3, '#0f172a');
  }

  // Row 1: Cyber Bat / Wyvern Scout (4 frames, 32x32)
  for (let f = 0; f < 4; f++) {
    const ox = f * 32, oy = 32;
    const wingY = f % 2 === 0 ? 10 : 18;
    surf.circle(ox + 16, oy + 16, 5, '#0f111a');
    surf.circle(ox + 16, oy + 16, 4, f === 3 ? '#ffffff' : '#7e22ce');
    surf.set(ox + 14, oy + 15, '#facc15');
    surf.set(ox + 18, oy + 15, '#facc15');
    // wings
    surf.line(ox + 12, oy + 16, ox + 4, oy + wingY, '#0f111a');
    surf.line(ox + 12, oy + 15, ox + 5, oy + wingY, '#a855f7');
    surf.line(ox + 20, oy + 16, ox + 28, oy + wingY, '#0f111a');
    surf.line(ox + 20, oy + 15, ox + 27, oy + wingY, '#a855f7');
  }

  // Row 2: Blaster Trooper (4 frames, 32x32)
  for (let f = 0; f < 4; f++) {
    const ox = f * 32, oy = 64;
    const step = f === 1 ? 2 : 0;
    surf.rect(ox + 10, oy + 7, 12, 10, '#0f111a');
    surf.rect(ox + 11, oy + 8, 10, 8, f === 3 ? '#ffffff' : '#dc2626');
    surf.rect(ox + 12, oy + 10, 6, 3, '#fef08a'); // visor
    surf.rect(ox + 11, oy + 17, 10, 7, '#991b1b');
    surf.rect(ox + 10 - step, oy + 24, 4, 4, '#475569');
    surf.rect(ox + 18 + step, oy + 24, 4, 4, '#475569');
    // gun barrel
    surf.rect(ox + 5, oy + 18, 7, 3, '#cbd5e1');
    if (f === 2) surf.circle(ox + 4, oy + 19, 2, '#f97316'); // telegraph glow
  }

  // Row 3: Shield Knight (4 frames, 32x32)
  for (let f = 0; f < 4; f++) {
    const ox = f * 32, oy = 96;
    surf.rect(ox + 10, oy + 6, 13, 18, '#0f111a');
    surf.rect(ox + 11, oy + 7, 11, 16, f === 3 ? '#ffffff' : '#475569');
    surf.rect(ox + 12, oy + 10, 4, 2, '#38bdf8');
    surf.rect(ox + 11, oy + 24, 4, 4, '#1e293b');
    surf.rect(ox + 18, oy + 24, 4, 4, '#1e293b');
    // Heavy shield in front (left side facing hero)
    const shieldLift = f === 2 ? -4 : 0;
    surf.rect(ox + 5, oy + 10 + shieldLift, 6, 14, '#0f111a');
    surf.rect(ox + 6, oy + 11 + shieldLift, 4, 12, '#eab308');
    surf.rect(ox + 7, oy + 13 + shieldLift, 2, 8, '#fef08a');
  }

  // Row 4: Turret Drone (4 frames, 32x32)
  for (let f = 0; f < 4; f++) {
    const ox = f * 32, oy = 128;
    surf.rect(ox + 8, oy + 12, 16, 16, '#0f111a');
    surf.rect(ox + 9, oy + 13, 14, 14, f === 3 ? '#ffffff' : '#334155');
    surf.rect(ox + 12, oy + 16, 8, 6, f === 1 ? '#facc15' : f === 2 ? '#ef4444' : '#38bdf8');
    surf.rect(ox + 4, oy + 17, 6, 4, '#94a3b8');
  }

  // Row 5 (y=160): Boss 48x48 (4 frames) — Armored Dragon Colossus
  for (let f = 0; f < 4; f++) {
    const ox = f * 48, oy = 160;
    const jaw = f === 1 || f === 2 ? 3 : 0;
    // body
    surf.rect(ox + 14, oy + 14, 24, 26, '#0f111a');
    surf.rect(ox + 15, oy + 15, 22, 24, f === 3 ? '#ffffff' : '#7f1d1d');
    surf.rect(ox + 18, oy + 18, 12, 14, '#dc2626');
    // horns & head
    surf.rect(ox + 8, oy + 8, 18, 14, '#0f111a');
    surf.rect(ox + 9, oy + 9, 16, 12, '#b91c1c');
    surf.rect(ox + 20, oy + 4, 4, 6, '#eab308');
    surf.rect(ox + 12, oy + 12, 4, 3, f === 1 ? '#fef08a' : '#f97316');
    // jaw/fire telegraph
    surf.rect(ox + 6, oy + 18 + jaw, 10, 4, '#991b1b');
    if (f === 1) surf.circle(ox + 6, oy + 17, 3, '#fef08a');
    if (f === 2) surf.circle(ox + 5, oy + 17, 4, '#f97316');
    // legs & claws
    surf.rect(ox + 14, oy + 39, 8, 7, '#450a0a');
    surf.rect(ox + 28, oy + 39, 8, 7, '#450a0a');
  }

  surf.save('enemies.png');
}

// ---- 4. ITEMS, PROJECTILES, CHESTS & VFX (128 x 64 -> 8 cols x 4 rows of 16x16) ----
function buildItemsVfxSheet() {
  const surf = new PixelSurface(128, 64);
  const drawCell = (col, row, fn) => fn(col * 16, row * 16);

  // Row 0: 8 Drops
  // 0: Ammo Small
  drawCell(0, 0, (ox, oy) => {
    surf.rect(ox + 5, oy + 4, 6, 9, '#0f111a');
    surf.rect(ox + 6, oy + 6, 4, 6, '#eab308');
    surf.rect(ox + 6, oy + 4, 4, 2, '#94a3b8');
  });
  // 1: Ammo Medium
  drawCell(1, 0, (ox, oy) => {
    surf.rect(ox + 3, oy + 4, 10, 9, '#0f111a');
    surf.rect(ox + 4, oy + 6, 3, 6, '#eab308');
    surf.rect(ox + 9, oy + 6, 3, 6, '#eab308');
    surf.rect(ox + 4, oy + 4, 3, 2, '#cbd5e1');
    surf.rect(ox + 9, oy + 4, 3, 2, '#cbd5e1');
  });
  // 2: Ammo Large
  drawCell(2, 0, (ox, oy) => {
    surf.rect(ox + 2, oy + 3, 12, 10, '#0f111a');
    surf.rect(ox + 3, oy + 4, 10, 8, '#166534');
    surf.rect(ox + 4, oy + 6, 8, 4, '#facc15');
    surf.rect(ox + 5, oy + 2, 6, 2, '#94a3b8');
  });
  // 3: HP Potion
  drawCell(3, 0, (ox, oy) => {
    surf.rect(ox + 6, oy + 2, 4, 3, '#92400e');
    surf.circle(ox + 8, oy + 10, 5, '#0f111a');
    surf.circle(ox + 8, oy + 10, 4, '#ef4444');
    surf.set(ox + 6, oy + 8, '#fecaca');
  });
  // 4: Mana Potion
  drawCell(4, 0, (ox, oy) => {
    surf.rect(ox + 6, oy + 2, 4, 3, '#92400e');
    surf.circle(ox + 8, oy + 10, 5, '#0f111a');
    surf.circle(ox + 8, oy + 10, 4, '#2563eb');
    surf.set(ox + 6, oy + 8, '#bfdbfe');
  });
  // 5: Gold Coin
  drawCell(5, 0, (ox, oy) => {
    surf.circle(ox + 8, oy + 8, 5, '#0f111a');
    surf.circle(ox + 8, oy + 8, 4, '#facc15');
    surf.rect(ox + 7, oy + 6, 2, 4, '#ca8a04');
    surf.set(ox + 6, oy + 6, '#fef9c3');
  });
  // 6: Rare Crystal
  drawCell(6, 0, (ox, oy) => {
    surf.rect(ox + 6, oy + 2, 4, 12, '#0f111a');
    surf.rect(ox + 4, oy + 5, 8, 6, '#0f111a');
    surf.rect(ox + 6, oy + 3, 4, 10, '#06b6d4');
    surf.rect(ox + 5, oy + 6, 6, 4, '#67e8f9');
    surf.set(ox + 7, oy + 4, '#ffffff');
  });
  // 7: Weapon Material (Steel Ingot)
  drawCell(7, 0, (ox, oy) => {
    surf.rect(ox + 2, oy + 5, 12, 7, '#0f111a');
    surf.rect(ox + 3, oy + 6, 10, 5, '#94a3b8');
    surf.rect(ox + 4, oy + 6, 8, 2, '#f1f5f9');
  });

  // Row 1: Projectiles & Chests
  // 0-1: Hero Buster Shot
  drawCell(0, 1, (ox, oy) => {
    surf.rect(ox + 3, oy + 5, 10, 6, '#0f111a');
    surf.rect(ox + 4, oy + 6, 8, 4, '#facc15');
    surf.rect(ox + 6, oy + 7, 5, 2, '#ffffff');
  });
  drawCell(1, 1, (ox, oy) => {
    surf.rect(ox + 2, oy + 4, 12, 8, '#38bdf8');
    surf.rect(ox + 4, oy + 6, 8, 4, '#ffffff');
  });
  // 2: Heavy Shot / Excalibur Beam
  drawCell(2, 1, (ox, oy) => {
    surf.rect(ox + 2, oy + 2, 12, 12, '#eab308');
    surf.rect(ox + 4, oy + 4, 8, 8, '#fef08a');
    surf.rect(ox + 6, oy + 5, 5, 6, '#ffffff');
  });
  // 3: Enemy Plasma Orb
  drawCell(3, 1, (ox, oy) => {
    surf.circle(ox + 8, oy + 8, 4, '#0f111a');
    surf.circle(ox + 8, oy + 8, 3, '#ef4444');
    surf.set(ox + 7, oy + 7, '#fef08a');
  });
  // 4: Boss Fireball
  drawCell(4, 1, (ox, oy) => {
    surf.circle(ox + 8, oy + 8, 6, '#991b1b');
    surf.circle(ox + 8, oy + 8, 4, '#f97316');
    surf.circle(ox + 8, oy + 8, 2, '#fef08a');
  });
  // 5: Excalibur Wave
  drawCell(5, 1, (ox, oy) => {
    surf.rect(ox + 4, oy + 1, 7, 14, '#fde047');
    surf.rect(ox + 6, oy + 2, 4, 12, '#ffffff');
  });
  // 6: Chest Closed
  drawCell(6, 1, (ox, oy) => {
    surf.rect(ox + 1, oy + 4, 14, 11, '#0f111a');
    surf.rect(ox + 2, oy + 5, 12, 9, '#92400e');
    surf.rect(ox + 2, oy + 8, 12, 2, '#facc15');
    surf.rect(ox + 7, oy + 7, 2, 4, '#fef08a');
  });
  // 7: Chest Open
  drawCell(7, 1, (ox, oy) => {
    surf.rect(ox + 1, oy + 7, 14, 8, '#0f111a');
    surf.rect(ox + 2, oy + 8, 12, 6, '#78350f');
    surf.rect(ox + 2, oy + 3, 12, 4, '#b45309');
    surf.rect(ox + 5, oy + 6, 6, 3, '#fef08a');
  });

  // Row 2: Spark (0-3) & Explosion (4-7)
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

  // Row 3: Crit Star (0-3) & Goal Portal (4-7)
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

// ---- 5. MENU ICONS (120 x 24 -> 5 icons of 24x24) ----
function buildMenuIconsSheet() {
  const surf = new PixelSurface(120, 24);
  // 0: World Map
  surf.circle(12, 12, 9, '#0f111a');
  surf.circle(12, 12, 8, '#2563eb');
  surf.rect(7, 8, 5, 4, '#22c55e');
  surf.rect(13, 11, 5, 6, '#22c55e');
  surf.rect(9, 15, 4, 3, '#16a34a');

  // 1: Quest Scroll
  surf.rect(24 + 5, 3, 14, 18, '#0f111a');
  surf.rect(24 + 6, 4, 12, 16, '#fef3c7');
  surf.rect(24 + 4, 4, 16, 3, '#d97706');
  surf.rect(24 + 4, 17, 16, 3, '#d97706');
  surf.rect(24 + 11, 8, 2, 5, '#dc2626');
  surf.rect(24 + 11, 14, 2, 2, '#dc2626');

  // 2: Shop Potion & Coin
  surf.rect(48 + 9, 3, 6, 3, '#92400e');
  surf.circle(48 + 12, 14, 7, '#0f111a');
  surf.circle(48 + 12, 14, 6, '#ef4444');
  surf.circle(48 + 17, 17, 4, '#facc15');

  // 3: Blacksmith Anvil & Hammer
  surf.rect(72 + 4, 13, 16, 4, '#475569');
  surf.rect(72 + 7, 17, 10, 4, '#334155');
  surf.rect(72 + 5, 11, 12, 3, '#94a3b8');
  surf.line(72 + 12, 4, 72 + 17, 9, '#eab308');
  surf.rect(72 + 8, 4, 6, 4, '#cbd5e1');

  // 4: Equipment Sword & Shield
  surf.rect(96 + 6, 5, 12, 14, '#0f111a');
  surf.rect(96 + 7, 6, 10, 12, '#3b82f6');
  surf.rect(96 + 9, 8, 6, 8, '#eab308');
  surf.line(96 + 4, 19, 96 + 19, 4, '#e2e8f0');

  surf.save('menu_icons.png');
}

// ---- 6. TILESET (128 x 80 -> 8 cols x 5 world rows of 16x16) ----
const WORLD_PALETTES = [
  // World 1: Emerald Ruins
  { top: '#22c55e', topH: '#86efac', rock1: '#475569', rock2: '#334155', rockH: '#64748b', plat: '#b45309', accent: '#facc15' },
  // World 2: Crystal Cavern
  { top: '#06b6d4', topH: '#a5f3fc', rock1: '#1e3a8a', rock2: '#172554', rockH: '#3b82f6', plat: '#0284c7', accent: '#67e8f9' },
  // World 3: Ember Foundry
  { top: '#f97316', topH: '#fed7aa', rock1: '#450a0a', rock2: '#271212', rockH: '#7f1d1d', plat: '#9a3412', accent: '#facc15' },
  // World 4: Storm Citadel
  { top: '#eab308', topH: '#fef08a', rock1: '#312e81', rock2: '#1e1b4b', rockH: '#4f46e5', plat: '#6366f1', accent: '#38bdf8' },
  // World 5: Abyssal Spire
  { top: '#a855f7', topH: '#e9d5ff', rock1: '#1e1b2e', rock2: '#0f0d18', rockH: '#4c1d95', plat: '#7e22ce', accent: '#f43f5e' },
];

function buildTilesSheet() {
  const surf = new PixelSurface(128, 80);
  WORLD_PALETTES.forEach((p, wIdx) => {
    const oy = wIdx * 16;
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

    // 3: Ladder
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

    // 6: Accent Block
    surf.rect(96, oy, 16, 16, '#0f111a');
    surf.rect(97, oy + 1, 14, 14, p.plat);
    surf.rect(100, oy + 4, 8, 8, p.accent);

    // 7: Exit Gate Frame
    surf.rect(112, oy, 16, 16, p.rock2);
    surf.rect(114, oy + 2, 12, 14, p.accent);
  });
  surf.save('tiles.png');
}

// ---- 7. PARALLAX BACKGROUNDS (256 x 1200 -> 5 worlds of 256x240 native 1:1 resolution) ----
function buildBackgroundsSheet() {
  const surf = new PixelSurface(256, 1200);
  const bgConfigs = [
    { sky1: '#0b132b', sky2: '#1c2541', sky3: '#2b4570', moon: '#fef08a', hill1: '#14532d', hill2: '#166534', star: '#bae6fd' },
    { sky1: '#07152e', sky2: '#0f2d59', sky3: '#0e7490', moon: '#a5f3fc', hill1: '#1e3a8a', hill2: '#1d4ed8', star: '#e0f2fe' },
    { sky1: '#1c0707', sky2: '#450a0a', sky3: '#9a3412', moon: '#fb923c', hill1: '#450a0a', hill2: '#7c2d12', star: '#fde047' },
    { sky1: '#0c0a24', sky2: '#1e1b4b', sky3: '#3730a3', moon: '#fef08a', hill1: '#1e1b4b', hill2: '#4338ca', star: '#c7d2fe' },
    { sky1: '#070510', sky2: '#2e1065', sky3: '#581c87', moon: '#f43f5e', hill1: '#1e1b4b', hill2: '#6b21a8', star: '#fbcfe8' },
  ];
  bgConfigs.forEach((cfg, idx) => {
    const oy = idx * 240;
    // Smooth GBC dithered sky bands
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
    // Pixel crescent / orb moon
    surf.circle(204, oy + 42, 11, cfg.moon);
    surf.circle(208, oy + 39, 9, cfg.sky1);

    // Pseudo-random scattered stars (no horizontal banding)
    let seed = (idx + 1) * 4919;
    for (let i = 0; i < 34; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const sx = seed % 256;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const sy = oy + 8 + (seed % 96);
      surf.set(sx, sy, cfg.star);
    }

    // Distant mountains / ruins + foreground rolling hills (seamless across 256px)
    for (let x = 0; x < 256; x++) {
      const h1 = Math.round(68 + Math.sin((x / 256) * Math.PI * 4) * 20 + Math.cos((x / 256) * Math.PI * 8) * 9);
      surf.rect(x, oy + 240 - h1, 1, h1, cfg.hill1);
      const h2 = Math.round(42 + Math.sin((x / 256) * Math.PI * 6 + 1.2) * 12);
      surf.rect(x, oy + 240 - h2, 1, h2, cfg.hill2);
    }
  });
  surf.save('backgrounds.png');
}

// ---- 8. 10 GUNS & PROJECTILES (160 x 32 -> row 0: 10 gun icons, row 1: 10 projectile sprites) ----
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
    // Row 0: 16x16 Gun Icon
    const barrelLen = g.shotgun ? 10 : idx >= 6 ? 12 : 9;
    const barrelH = g.shotgun ? 4 : idx >= 6 ? 4 : 3;
    surf.rect(ox + 2, 5, barrelLen + 1, barrelH + 2, '#0f111a');
    surf.rect(ox + 3, 6, barrelLen - 1, barrelH, g.body);
    surf.rect(ox + 3, 6, barrelLen - 1, 1, g.hi);
    // Core glow
    surf.rect(ox + 5, 7, 2, 2, g.core);
    // Grip
    surf.rect(ox + 3, 9, 4, 5, '#0f111a');
    surf.rect(ox + 4, 9, 2, 4, g.grip);
    if (g.shotgun) {
      // Double under-barrel pump
      surf.rect(ox + 7, 10, 5, 2, g.grip);
    }

    // Row 1 (y=16): 16x16 Projectile Sprite
    const py = 16;
    if (g.shotgun) {
      surf.circle(ox + 8, py + 8, 3, '#0f111a');
      surf.circle(ox + 8, py + 8, 2, g.shot);
      surf.set(ox + 8, py + 8, g.shotCore);
    } else if (idx === 9) {
      // Infinite Omega Beam Bolt
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
buildEnemiesSheet();
buildItemsVfxSheet();
buildMenuIconsSheet();
buildTilesSheet();
buildBackgroundsSheet();
buildGunsSheet();

