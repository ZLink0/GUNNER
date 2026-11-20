import { EnemyKind, SwordId } from './types';

export const TILE_SIZE = 16;
export const STAGE_ROWS = 15; // 15 * 16 = 240px playfield height (plus 16px HUD = 256x256 square)
export const CANVAS_SIZE = 256;
export const HUD_BAR_HEIGHT = 16;
export const PORTALS_PER_STAGE = 5;

// Tile codes:
// 0 = empty
// 1 = solid ground top
// 2 = solid brick fill
// 3 = one-way platform
// 4 = ladder
// 5 = spikes hazard
// 6 = deco pillar
export type TileType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface EnemySpawn {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  atk: number;
  speed: number;
  expReward: number;
  goldReward: number;
}

export interface ChestSpawn {
  id: number;
  x: number;
  y: number;
  crystals: number;
  gold: number;
  swordReward?: SwordId;
}

export interface StageArea {
  areaIndex: number; // 0..4 (Portal 1..5)
  isBossArea: boolean;
  cols: number;
  rows: number;
  tiles: TileType[][]; // [row][col]
  spawnX: number;
  spawnY: number;
  portalX: number;
  portalY: number;
  enemies: EnemySpawn[];
  chests: ChestSpawn[];
}

export interface StageData {
  stageNumber: number; // 1..100
  worldIndex: number; // 0..4
  isBossStage: boolean;
  areas: StageArea[]; // Always 5 areas with 5 portals
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getWorldIndexForStage(stageNumber: number): number {
  const clamped = Math.max(1, Math.min(100, stageNumber));
  return Math.floor((clamped - 1) / 20);
}

function generateArea(
  stage: number,
  worldIndex: number,
  areaIndex: number,
  isBossStage: boolean,
): StageArea {
  const isBossArea = isBossStage && areaIndex === PORTALS_PER_STAGE - 1;
  const rng = mulberry32(stage * 9773 + worldIndex * 313 + areaIndex * 1997);

  const cols = isBossArea ? 38 : Math.min(76, 56 + Math.floor(stage * 0.18) + areaIndex * 2);
  const rows = STAGE_ROWS;
  const tiles: TileType[][] = Array.from({ length: rows }, () => Array<TileType>(cols).fill(0));

  const groundRow = rows - 2;
  for (let c = 0; c < cols; c++) {
    tiles[groundRow][c] = 1;
    tiles[groundRow + 1][c] = 2;
  }

  const safeStartEnd = 10;
  const safeGoalStart = isBossArea ? cols - 18 : cols - 8;

  if (!isBossArea) {
    let c = safeStartEnd;
    while (c < safeGoalStart - 3) {
      const roll = rng();
      if (roll < 0.22 && c > safeStartEnd + 2) {
        const pitW = 2;
        for (let pc = c; pc < c + pitW && pc < safeGoalStart; pc++) {
          tiles[groundRow][pc] = 0;
          tiles[groundRow + 1][pc] = 0;
        }
        tiles[groundRow - 2][c] = 3;
        tiles[groundRow - 2][c + 1] = 3;
        c += pitW + 4;
      } else if (roll < 0.44 && (stage >= 2 || areaIndex >= 1)) {
        const spW = stage > 15 && rng() > 0.5 ? 2 : 1;
        for (let sc = c; sc < c + spW; sc++) {
          tiles[groundRow - 1][sc] = 5;
        }
        tiles[groundRow - 4][Math.max(safeStartEnd, c - 1)] = 3;
        tiles[groundRow - 4][c] = 3;
        tiles[groundRow - 4][c + 1] = 3;
        c += spW + 4;
      } else if (roll < 0.74) {
        const platW = 4 + Math.floor(rng() * 3);
        const platRow = groundRow - 3 - Math.floor(rng() * 2);
        for (let pc = c; pc < c + platW && pc < safeGoalStart; pc++) {
          tiles[platRow][pc] = 3;
        }
        const ladderCol = c;
        for (let lr = platRow; lr < groundRow; lr++) {
          tiles[lr][ladderCol] = 4;
        }
        if (rng() > 0.45 && platRow >= 6) {
          for (let pc = c + 1; pc < c + platW - 1 && pc < safeGoalStart; pc++) {
            tiles[platRow - 3][pc] = 3;
          }
        }
        c += platW + 3;
      } else {
        tiles[groundRow - 1][c] = 6;
        c += 4;
      }
    }
  } else {
    // Boss arena
    for (let pc = 6; pc <= 10; pc++) tiles[groundRow - 3][pc] = 3;
    tiles[groundRow - 3][6] = 4;
    tiles[groundRow - 2][6] = 4;
    tiles[groundRow - 1][6] = 4;
    for (let pc = cols - 13; pc <= cols - 9; pc++) tiles[groundRow - 3][pc] = 3;
  }

  const spawnX = 2 * TILE_SIZE + 8;
  const spawnY = groundRow * TILE_SIZE;
  const portalX = (cols - 4) * TILE_SIZE;
  const portalY = groundRow * TILE_SIZE;

  const enemies: EnemySpawn[] = [];
  let eid = areaIndex * 100 + 1;
  const hpScale = 1 + (stage - 1) * 0.24 + areaIndex * 0.06;
  const atkScale = 1 + (stage - 1) * 0.18;
  const nonBossKinds: EnemyKind[] = ['slime', 'bat', 'trooper', 'knight', 'turret'];

  if (isBossArea) {
    enemies.push({
      id: eid++,
      kind: 'slime',
      x: 12 * TILE_SIZE,
      y: groundRow * TILE_SIZE,
      hp: Math.round(24 * hpScale),
      atk: Math.round(6 * atkScale),
      speed: 28,
      expReward: Math.round(14 + stage * 3),
      goldReward: Math.round(12 + stage * 2),
    });
    enemies.push({
      id: eid++,
      kind: 'bat',
      x: 16 * TILE_SIZE,
      y: (groundRow - 5) * TILE_SIZE,
      hp: Math.round(22 * hpScale),
      atk: Math.round(7 * atkScale),
      speed: 44,
      expReward: Math.round(16 + stage * 3),
      goldReward: Math.round(14 + stage * 2),
    });
    enemies.push({
      id: eid++,
      kind: 'boss',
      x: (cols - 9) * TILE_SIZE,
      y: groundRow * TILE_SIZE,
      hp: Math.round(165 * hpScale),
      atk: Math.round(13 * atkScale),
      speed: 46 + Math.min(24, stage * 0.25),
      expReward: Math.round(90 + stage * 14),
      goldReward: Math.round(95 + stage * 12),
    });
  } else {
    const enemyBudget = Math.min(14, 6 + Math.floor(stage * 0.12) + areaIndex);
    const stepCols = Math.max(3, Math.floor((safeGoalStart - safeStartEnd) / enemyBudget));
    for (let i = 0; i < enemyBudget; i++) {
      const col = safeStartEnd + 1 + i * stepCols + Math.floor(rng() * 2);
      if (col >= safeGoalStart) break;
      const hasFloor = tiles[groundRow][col] === 1 && tiles[groundRow - 1][col] !== 5;
      const poolIndex = Math.min(
        nonBossKinds.length - 1,
        Math.floor(rng() * (stage < 2 && areaIndex < 2 ? 3 : nonBossKinds.length)),
      );
      const kind: EnemyKind = hasFloor ? nonBossKinds[poolIndex] : 'bat';
      const y =
        kind === 'bat'
          ? (groundRow - 4 - Math.floor(rng() * 3)) * TILE_SIZE
          : groundRow * TILE_SIZE;

      const baseHp =
        kind === 'slime' ? 20 : kind === 'bat' ? 16 : kind === 'trooper' ? 26 : kind === 'knight' ? 40 : 32;
      const baseAtk =
        kind === 'slime' ? 5 : kind === 'bat' ? 6 : kind === 'trooper' ? 7 : kind === 'knight' ? 10 : 8;
      const baseSpeed =
        kind === 'slime' ? 28 : kind === 'bat' ? 44 : kind === 'trooper' ? 24 : kind === 'knight' ? 22 : 0;

      enemies.push({
        id: eid++,
        kind,
        x: col * TILE_SIZE + 8,
        y,
        hp: Math.round(baseHp * hpScale),
        atk: Math.round(baseAtk * atkScale),
        speed: baseSpeed,
        expReward: Math.round(14 + stage * 3.5),
        goldReward: Math.round(10 + stage * 2.5),
      });
    }
  }

  const chests: ChestSpawn[] = [];
  if (!isBossArea) {
    let chestCol = Math.floor(cols * 0.55);
    let chestRow = groundRow;
    for (let r = 4; r < groundRow; r++) {
      for (let c = Math.floor(cols * 0.35); c < Math.floor(cols * 0.8); c++) {
        if (tiles[r][c] === 3) {
          chestCol = c;
          chestRow = r;
          break;
        }
      }
      if (chestRow !== groundRow) break;
    }
    if (tiles[chestRow][chestCol] === 0) {
      tiles[groundRow][chestCol] = 1;
      tiles[groundRow + 1][chestCol] = 2;
      chestRow = groundRow;
    }
    const specialSword: SwordId | undefined =
      stage === 12 && areaIndex === 2
        ? 'thunder_sword'
        : stage === 32 && areaIndex === 3
          ? 'great_sword'
          : undefined;

    chests.push({
      id: areaIndex + 1,
      x: chestCol * TILE_SIZE + 8,
      y: chestRow * TILE_SIZE,
      crystals: 2 + Math.floor(stage / 15),
      gold: 35 + stage * 4,
      swordReward: specialSword,
    });
  }

  return {
    areaIndex,
    isBossArea,
    cols,
    rows,
    tiles,
    spawnX,
    spawnY,
    portalX,
    portalY,
    enemies,
    chests,
  };
}

export function generateStage(stageNumber: number): StageData {
  const stage = Math.max(1, Math.min(100, Math.round(stageNumber)));
  const worldIndex = getWorldIndexForStage(stage);
  const isBossStage = stage % 5 === 0;
  const areas = Array.from({ length: PORTALS_PER_STAGE }, (_, idx) =>
    generateArea(stage, worldIndex, idx, isBossStage),
  );

  return {
    stageNumber: stage,
    worldIndex,
    isBossStage,
    areas,
  };
}
