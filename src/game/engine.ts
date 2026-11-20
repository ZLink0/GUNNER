import { gameAudio } from './audio';
import { BossDef, KerocoBehavior } from './enemyCatalog';
import {
  addExpAndLevelUp,
  addHpPotion,
  calculateAttackDamage,
  computeHeroStats,
  consumeAmmo,
  getGunDef,
  getSwordDef,
  refillAmmo,
  rollEnemyDropKind,
  shouldEnemyDropItem,
} from './rpgLogic';
import { HERO_ANIMS, LoadedSprites } from './spriteAtlas';
import {
  CANVAS_SIZE,
  HUD_BAR_HEIGHT,
  KILLS_TO_OPEN_EXIT,
  PORTALS_PER_STAGE,
  StageArea,
  StageData,
  TILE_SIZE,
  generateStage,
} from './stageGenerator';
import {
  DropKind,
  ElementType,
  EnemyKind,
  GameSettings,
  HeroAnimName,
  RunSummary,
  SaveState,
  SwordId,
} from './types';

export type VirtualButton =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'jump'
  | 'sword'
  | 'gun'
  | 'dash'
  | 'potion'
  | 'turnLeft'
  | 'turnRight';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  ammo: number;
  maxAmmo: number;
  hpPotions: number;
  level: number;
  stage: number;
  portal: number;
  totalPortals: number;
  areaKills: number;
  requiredKills: number;
  biomeName: string;
  score: number;
  bossHpPct: number | null;
}

interface ActiveMovingPlatform {
  id: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  w: number;
  h: number;
  axis: 'x' | 'y';
  minPos: number;
  maxPos: number;
  speed: number;
  phase: number;
  dir: 1 | -1;
}

interface ActiveEnemy {
  id: number;
  kind: EnemyKind;
  name: string;
  enemyLevel: number;
  spriteRow: number;
  behavior: KerocoBehavior | 'boss';
  bossDef?: BossDef;
  x: number;
  y: number; // bottom-center y
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  atk: number;
  speed: number;
  facing: -1 | 1;
  expReward: number;
  goldReward: number;
  aiTimer: number;
  telegraphTimer: number;
  attackCooldown: number;
  hitFlash: number;
  burnTimer: number;
  burnTick: number;
  slowTimer: number;
  stunTimer: number;
  koTimer: number;
  dead: boolean;
  animTime: number;
}

interface Projectile {
  active: boolean;
  fromHero: boolean;
  useGunSheet: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  isCrit: boolean;
  spriteCol: number;
  life: number;
  distTraveled: number;
  maxRange: number | null;
  pierce: boolean;
  element: ElementType;
}

interface DropItem {
  id: number;
  kind: DropKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  spriteCol: number;
  amount: number;
}

interface ChestObj {
  id: number;
  x: number;
  y: number;
  opened: boolean;
  crystals: number;
  gold: number;
  swordReward?: SwordId;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface VfxSprite {
  active: boolean;
  x: number;
  y: number;
  row: number;
  colStart: number;
  frames: number;
  timer: number;
  duration: number;
}

interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

interface SlashHitbox {
  active: boolean;
  timer: number;
  duration: number;
  dirX: number;
  dirY: number;
  isHeavy: boolean;
  isDashSlash: boolean;
  comboStep: 1 | 2 | 3;
  hitIds: Set<number>;
}

const MAX_PARTICLES = 64;
const MAX_PROJECTILES = 48;
const MAX_VFX = 24;
const MAX_FLOATING_TEXT = 24;

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onSaveUpdate: (nextSave: SaveState) => void;
  onRunComplete: (summary: RunSummary) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sprites: LoadedSprites;
  private callbacks: EngineCallbacks;

  private mode: 'title' | 'stage' = 'title';
  private paused = false;
  private rafId = 0;
  private lastTime = 0;

  private save: SaveState;
  private settings: GameSettings;
  private stage: StageData;
  private areaIndex = 0;
  private area: StageArea;

  // Input hub
  private held = new Set<VirtualButton>();
  private justPressed = new Set<VirtualButton>();
  private keyHeld = new Set<string>();
  private touchHeld = new Set<VirtualButton>();
  private jumpBuffer = 0;
  private swordBuffer = 0;
  private gunBuffer = 0;
  private dashBuffer = 0;

  // Hero state
  private hx = 40;
  private hy = 200;
  private hvx = 0;
  private hvy = 0;
  private hFacing: -1 | 1 = 1;
  private onGround = false;
  private onLadder = false;
  private onMonkeyBar = false;
  private monkeyBarCooldown = 0;
  private inWater = false;
  private waterSubmergedTimer = 0;
  private waterDamageTick = 0;
  private coyoteTimer = 0;
  private invulnTimer = 0;
  private hurtTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private shootCooldown = 0;
  private shootPoseTimer = 0;
  private shootAimDir: 'horiz' | 'up' | 'down' = 'horiz';
  private swordCooldown = 0;
  private comboStep: 1 | 2 | 3 = 1;
  private comboResetTimer = 0;
  private potionAnimTimer = 0;
  private landAnimTimer = 0;
  private deathTimer = 0;
  private isDead = false;
  private stageCleared = false;
  private clearDelayTimer = 0;

  private hp = 80;
  private maxHp = 80;
  private mp = 40;
  private maxMp = 40;
  private squashX = 1;
  private squashY = 1;

  private animName: HeroAnimName = 'idle';
  private animTime = 0;

  // Run & Area tracking
  private runTime = 0;
  private runScore = 0;
  private runDamageTaken = 0;
  private runEnemiesDefeated = 0;
  private areaKills = 0;
  private portalCooldown = 0;
  private runExpGained = 0;
  private runGoldGained = 0;
  private foundSwordInRun: SwordId | undefined;

  // Simulation polish
  private hitstopTimer = 0;
  private shakeTrauma = 0;
  private camX = 0;
  private titleScrollX = 0;
  private portalAnim = 0;
  private hudEmitAccum = 0;

  // World entities
  private slash: SlashHitbox = {
    active: false,
    timer: 0,
    duration: 0.18,
    dirX: 1,
    dirY: 0,
    isHeavy: false,
    isDashSlash: false,
    comboStep: 1,
    hitIds: new Set<number>(),
  };
  private movingPlatforms: ActiveMovingPlatform[] = [];
  private enemies: ActiveEnemy[] = [];
  private chests: ChestObj[] = [];
  private drops: DropItem[] = [];
  private nextDropId = 1;

  private particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 2,
  }));
  private particleCursor = 0;
  private projectiles: Projectile[] = Array.from({ length: MAX_PROJECTILES }, () => ({
    active: false,
    fromHero: true,
    useGunSheet: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    damage: 1,
    isCrit: false,
    spriteCol: 0,
    life: 0,
    distTraveled: 0,
    maxRange: 48,
    pierce: false,
    element: 'none',
  }));
  private vfxList: VfxSprite[] = Array.from({ length: MAX_VFX }, () => ({
    active: false, x: 0, y: 0, row: 2, colStart: 0, frames: 4, timer: 0, duration: 0.2,
  }));
  private floatingTexts: FloatingText[] = Array.from({ length: MAX_FLOATING_TEXT }, () => ({
    active: false, x: 0, y: 0, vy: 0, text: '', color: '#fff', life: 0,
  }));

  constructor(
    canvas: HTMLCanvasElement,
    sprites: LoadedSprites,
    initialSave: SaveState,
    initialSettings: GameSettings,
    callbacks: EngineCallbacks,
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D context');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.sprites = sprites;
    this.save = initialSave;
    this.settings = initialSettings;
    this.callbacks = callbacks;
    this.stage = generateStage(1);
    this.area = this.stage.areas[0];
    this.bindInputListeners();
  }

  public startLoop() {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const rawDt = Math.max(0, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearAllInputs);
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  public syncSave(save: SaveState) {
    this.save = save;
  }

  public syncSettings(settings: GameSettings) {
    this.settings = settings;
    gameAudio.muted = settings.muted;
    gameAudio.volume = settings.volume;
  }

  public setPaused(p: boolean) {
    this.paused = p;
    if (p) this.clearAllInputs();
  }

  public enterTitlePreview() {
    this.mode = 'title';
    this.paused = false;
    this.stage = generateStage(1);
    this.areaIndex = 0;
    this.area = this.stage.areas[0];
    this.hx = 56;
    this.hy = this.area.spawnY;
    this.hFacing = 1;
    this.animName = 'idle';
  }

  public startStage(stageNumber: number, save: SaveState) {
    this.save = save;
    this.mode = 'stage';
    this.paused = false;
    this.stage = generateStage(stageNumber);

    const stats = computeHeroStats(save);
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.maxMp = stats.maxMp;
    this.mp = stats.maxMp;

    this.hurtTimer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.shootCooldown = 0;
    this.shootPoseTimer = 0;
    this.swordCooldown = 0;
    this.comboStep = 1;
    this.comboResetTimer = 0;
    this.potionAnimTimer = 0;
    this.landAnimTimer = 0;
    this.deathTimer = 0;
    this.isDead = false;
    this.stageCleared = false;
    this.clearDelayTimer = 0;
    this.slash.active = false;
    this.squashX = 1;
    this.squashY = 1;

    this.runTime = 0;
    this.runScore = 0;
    this.runDamageTaken = 0;
    this.runEnemiesDefeated = 0;
    this.runExpGained = 0;
    this.runGoldGained = 0;
    this.foundSwordInRun = undefined;

    this.hitstopTimer = 0;
    this.shakeTrauma = 0;
    this.clearAllInputs();
    this.loadArea(0);
  }

  private loadArea(index: number) {
    this.areaIndex = index;
    this.area = this.stage.areas[index];
    this.areaKills = 0;
    this.portalCooldown = 0.8;

    this.hx = this.area.spawnX;
    this.hy = this.area.spawnY;
    this.hvx = 0;
    this.hvy = 0;
    this.hFacing = 1;
    this.onGround = true;
    this.onLadder = false;
    this.onMonkeyBar = false;
    this.monkeyBarCooldown = 0;
    this.inWater = false;
    this.waterSubmergedTimer = 0;
    this.waterDamageTick = 0;
    this.coyoteTimer = 0.1;
    this.invulnTimer = 0.7;
    this.camX = 0;
    this.animName = 'idle';
    this.animTime = 0;

    this.movingPlatforms = this.area.movingPlatforms.map((mp) => ({
      ...mp,
      prevX: mp.x,
      prevY: mp.y,
      dir: 1,
    }));

    this.enemies = this.area.enemies.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      enemyLevel: e.enemyLevel,
      spriteRow: e.spriteRow,
      behavior: e.behavior,
      bossDef: e.bossDef,
      x: e.x,
      y: e.y,
      vx: 0,
      vy: 0,
      w: e.kind === 'boss' ? 32 : 16,
      h: e.kind === 'boss' ? 36 : 18,
      hp: e.hp,
      maxHp: e.hp,
      atk: e.atk,
      speed: e.speed,
      facing: -1,
      expReward: e.expReward,
      goldReward: e.goldReward,
      aiTimer: Math.random() * 1.2,
      telegraphTimer: 0,
      attackCooldown: 0.7 + Math.random() * 0.8,
      hitFlash: 0,
      burnTimer: 0,
      burnTick: 0,
      slowTimer: 0,
      stunTimer: 0,
      koTimer: 0,
      dead: false,
      animTime: Math.random(),
    }));

    this.chests = this.area.chests.map((c) => ({ ...c, opened: false }));
    this.drops = [];
    for (const p of this.projectiles) p.active = false;
    for (const p of this.particles) p.active = false;
    for (const v of this.vfxList) v.active = false;
    for (const f of this.floatingTexts) f.active = false;

    this.spawnFloatingText(
      this.hx + 18,
      this.hy - 32,
      `${this.stage.biome.name.toUpperCase()} P${index + 1}/5`,
      '#38bdf8',
    );
    this.emitHud();
  }

  public setVirtualButton(btn: VirtualButton, down: boolean) {
    if (down) {
      if (!this.touchHeld.has(btn)) {
        this.justPressed.add(btn);
        if (btn === 'jump') this.jumpBuffer = 0.12;
        if (btn === 'sword') this.swordBuffer = 0.12;
        if (btn === 'gun') this.gunBuffer = 0.12;
        if (btn === 'dash') this.dashBuffer = 0.12;
      }
      this.touchHeld.add(btn);
    } else {
      this.touchHeld.delete(btn);
    }
    this.rebuildHeld();
  }

  private mapKeyToBtn(code: string): VirtualButton | null {
    switch (code) {
      case 'ArrowLeft':
      case 'KeyA':
        return 'left';
      case 'ArrowRight':
      case 'KeyD':
        return 'right';
      case 'ArrowUp':
      case 'KeyW':
        return 'up';
      case 'ArrowDown':
      case 'KeyS':
        return 'down';
      case 'Space':
      case 'KeyC':
        return 'jump';
      case 'KeyJ':
      case 'KeyZ':
        return 'sword';
      case 'KeyK':
      case 'KeyX':
        return 'gun';
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'KeyL':
        return 'dash';
      case 'KeyH':
        return 'potion';
      case 'KeyQ':
        return 'turnLeft';
      case 'KeyE':
        return 'turnRight';
      default:
        return null;
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.mode !== 'stage' || this.paused) return;
    const btn = this.mapKeyToBtn(e.code);
    if (!btn) return;
    e.preventDefault();
    if (!this.keyHeld.has(e.code)) {
      this.justPressed.add(btn);
      if (btn === 'jump') this.jumpBuffer = 0.12;
      if (btn === 'sword') this.swordBuffer = 0.12;
      if (btn === 'gun') this.gunBuffer = 0.12;
      if (btn === 'dash') this.dashBuffer = 0.12;
    }
    this.keyHeld.add(e.code);
    this.rebuildHeld();
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const btn = this.mapKeyToBtn(e.code);
    if (!btn) return;
    this.keyHeld.delete(e.code);
    this.rebuildHeld();
    if (btn === 'jump' && this.hvy < -55 && !this.onLadder && !this.onMonkeyBar && !this.inWater) {
      this.hvy *= 0.45;
    }
  };

  private handleVisibility = () => {
    if (document.hidden) this.clearAllInputs();
  };

  private clearAllInputs = () => {
    this.keyHeld.clear();
    this.touchHeld.clear();
    this.held.clear();
    this.justPressed.clear();
  };

  private rebuildHeld() {
    this.held.clear();
    for (const code of this.keyHeld) {
      const b = this.mapKeyToBtn(code);
      if (b) this.held.add(b);
    }
    for (const b of this.touchHeld) {
      this.held.add(b);
    }
  }

  private bindInputListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearAllInputs);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  // ---- Tile Helpers ----
  private getTile(col: number, row: number): number {
    if (row < 0) return 0;
    if (row >= this.area.rows) return 0;
    if (col < 0 || col >= this.area.cols) return 1;
    return this.area.tiles[row][col];
  }

  private isSolid(col: number, row: number): boolean {
    const t = this.getTile(col, row);
    return t === 1 || t === 2;
  }

  private isOneWay(col: number, row: number): boolean {
    return this.getTile(col, row) === 3;
  }

  private isLadderAt(x: number, y: number): boolean {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor((y - 2) / TILE_SIZE);
    return this.getTile(col, row) === 4;
  }

  private getMonkeyBarRowAt(x: number, y: number): number | null {
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor(y / TILE_SIZE);
    if (this.getTile(col, row) === 7) return row;
    return null;
  }

  // ---- Main Update ----
  private update(dt: number) {
    this.portalAnim += dt * 7;
    if (this.mode === 'title') {
      this.titleScrollX = (this.titleScrollX + dt * 22) % 256;
      this.animTime += dt;
      return;
    }

    if (this.paused) return;

    const scaledDt = dt * this.settings.gameSpeed;

    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.8);
    this.updateParticles(dt);
    this.updateVfx(dt);
    this.updateFloatingTexts(dt);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    if (this.stageCleared) {
      this.clearDelayTimer -= dt;
      this.animTime += dt;
      if (this.clearDelayTimer <= 0) {
        this.finishStageVictory();
      }
      return;
    }

    if (this.isDead) {
      this.deathTimer += dt;
      this.animTime += dt;
      if (this.deathTimer >= 0.72) {
        this.finishStageDefeat();
      }
      return;
    }

    this.runTime += scaledDt;
    this.portalCooldown = Math.max(0, this.portalCooldown - scaledDt);
    this.updateMovingPlatforms(scaledDt);
    this.updateHero(scaledDt);
    this.updateSlash(scaledDt);
    this.updateProjectiles(scaledDt);
    this.updateEnemies(scaledDt);
    this.updateDrops(scaledDt);
    this.updateChests();
    this.checkPortals();

    const targetCamX = Math.max(
      0,
      Math.min(this.area.cols * TILE_SIZE - CANVAS_SIZE, this.hx - CANVAS_SIZE * 0.38),
    );
    this.camX += (targetCamX - this.camX) * Math.min(1, scaledDt * 10);

    this.squashX += (1 - this.squashX) * Math.min(1, scaledDt * 16);
    this.squashY += (1 - this.squashY) * Math.min(1, scaledDt * 16);

    this.justPressed.clear();

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.1) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateMovingPlatforms(dt: number) {
    for (const mp of this.movingPlatforms) {
      mp.prevX = mp.x;
      mp.prevY = mp.y;
      if (mp.axis === 'x') {
        mp.x += mp.dir * mp.speed * dt;
        if (mp.x >= mp.maxPos) {
          mp.x = mp.maxPos;
          mp.dir = -1;
        } else if (mp.x <= mp.minPos) {
          mp.x = mp.minPos;
          mp.dir = 1;
        }
      } else {
        mp.y += mp.dir * mp.speed * dt;
        if (mp.y >= mp.maxPos) {
          mp.y = mp.maxPos;
          mp.dir = -1;
        } else if (mp.y <= mp.minPos) {
          mp.y = mp.minPos;
          mp.dir = 1;
        }
      }
    }
  }

  private updateHero(dt: number) {
    const stats = computeHeroStats(this.save);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.shootPoseTimer = Math.max(0, this.shootPoseTimer - dt);
    this.swordCooldown = Math.max(0, this.swordCooldown - dt);
    this.comboResetTimer = Math.max(0, this.comboResetTimer - dt);
    this.potionAnimTimer = Math.max(0, this.potionAnimTimer - dt);
    this.landAnimTimer = Math.max(0, this.landAnimTimer - dt);
    this.monkeyBarCooldown = Math.max(0, this.monkeyBarCooldown - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.swordBuffer = Math.max(0, this.swordBuffer - dt);
    this.gunBuffer = Math.max(0, this.gunBuffer - dt);
    this.dashBuffer = Math.max(0, this.dashBuffer - dt);

    if (this.comboResetTimer <= 0 && !this.slash.active) {
      this.comboStep = 1;
    }

    // Potion use
    if (this.justPressed.has('potion')) {
      if (this.save.hpPotions > 0 && this.hp < this.maxHp) {
        const heal = Math.round(this.maxHp * 0.45);
        this.hp = Math.min(this.maxHp, this.hp + heal);
        this.save = { ...this.save, hpPotions: this.save.hpPotions - 1 };
        this.callbacks.onSaveUpdate(this.save);
        this.potionAnimTimer = 0.36;
        gameAudio.playPotion();
        this.spawnFloatingText(this.hx, this.hy - 26, `+${heal} HP`, '#4ade80');
        this.spawnParticles(this.hx, this.hy - 12, '#4ade80', 8, 55);
        this.emitHud();
      } else if (this.save.hpPotions <= 0) {
        this.spawnFloatingText(this.hx, this.hy - 26, 'NO POTION', '#f87171');
      }
    }

    const moveLeft = this.held.has('left');
    const moveRight = this.held.has('right');
    const moveUp = this.held.has('up');
    const moveDown = this.held.has('down');
    const dirInput = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);

    // Explicit Turn Left / Turn Right buttons ("putar kanan kiri")
    if (this.justPressed.has('turnLeft') || this.held.has('turnLeft')) {
      this.hFacing = -1;
    } else if (this.justPressed.has('turnRight') || this.held.has('turnRight')) {
      this.hFacing = 1;
    } else if (dirInput !== 0 && this.dashTimer <= 0 && this.hurtTimer <= 0) {
      this.hFacing = dirInput as -1 | 1;
    }

    // Water obstacle detection
    const centerCol = Math.floor(this.hx / TILE_SIZE);
    const waistRow = Math.floor((this.hy - 8) / TILE_SIZE);
    const headRowCheck = Math.floor((this.hy - 18) / TILE_SIZE);
    const wasInWater = this.inWater;
    this.inWater = this.getTile(centerCol, waistRow) === 8;
    const headUnderWater = this.getTile(centerCol, headRowCheck) === 8;
    if (this.inWater && !wasInWater) {
      this.spawnParticles(this.hx, this.hy - 8, '#7dd3fc', 8, 55);
    }
    if (headUnderWater) {
      this.waterSubmergedTimer += dt;
      if (this.waterSubmergedTimer >= 4.0) {
        this.waterDamageTick += dt;
        if (this.waterDamageTick >= 1.0) {
          this.waterDamageTick = 0;
          this.damageHero(8, 0);
        }
      }
    } else {
      this.waterSubmergedTimer = Math.max(0, this.waterSubmergedTimer - dt * 2.5);
      this.waterDamageTick = 0;
    }

    // Ladder detection (Up / Down)
    const nearLadder = this.isLadderAt(this.hx, this.hy - 4) || this.isLadderAt(this.hx, this.hy - 12);
    if (nearLadder && (moveUp || moveDown) && this.dashTimer <= 0 && this.hurtTimer <= 0) {
      this.onLadder = true;
      this.onMonkeyBar = false;
      this.hvy = 0;
      this.hvx = 0;
    }
    if (this.onLadder && !nearLadder) {
      this.onLadder = false;
    }

    // Horizontal Overhead Monkey Bar detection ("bergelantung" left/right)
    if (!this.onLadder && !this.onMonkeyBar && this.monkeyBarCooldown <= 0 && this.hurtTimer <= 0 && this.dashTimer <= 0) {
      const barRow =
        this.getMonkeyBarRowAt(this.hx, this.hy - 22) ??
        (moveUp ? this.getMonkeyBarRowAt(this.hx, this.hy - 26) : null);
      if (barRow !== null && (!this.onGround || moveUp)) {
        this.onMonkeyBar = true;
        this.onGround = false;
        this.hy = barRow * TILE_SIZE + 26;
        this.hvy = 0;
        this.hvx = 0;
      }
    }

    // Dash
    if (this.dashBuffer > 0 && this.dashCooldown <= 0 && this.hurtTimer <= 0) {
      this.dashBuffer = 0;
      this.dashTimer = 0.19;
      this.dashCooldown = 0.42;
      this.onLadder = false;
      this.onMonkeyBar = false;
      this.hvy = 0;
      this.hvx = this.hFacing * 205 * stats.speedMult;
      this.squashX = 1.24;
      this.squashY = 0.78;
      gameAudio.playDash();
      this.spawnParticles(this.hx - this.hFacing * 6, this.hy - 8, '#38bdf8', 7, 70);
    }

    // Movement physics
    if (this.hurtTimer > 0) {
      this.onMonkeyBar = false;
      this.hvy += 520 * dt;
    } else if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.hvx = this.hFacing * 205 * stats.speedMult;
      this.hvy = 0;
    } else if (this.onMonkeyBar) {
      // Hanging hand-over-hand along horizontal bar
      const hangSpeed = 76 * stats.speedMult;
      this.hvx = dirInput * hangSpeed;
      this.hvy = 0;
      const barRow = this.getMonkeyBarRowAt(this.hx, this.hy - 24);
      if (barRow === null || moveDown) {
        this.onMonkeyBar = false;
        this.monkeyBarCooldown = 0.25;
      } else {
        this.hy = barRow * TILE_SIZE + 26;
      }
      if (this.jumpBuffer > 0) {
        this.jumpBuffer = 0;
        this.onMonkeyBar = false;
        this.monkeyBarCooldown = 0.25;
        this.hvy = -210;
        gameAudio.playJump();
      }
    } else if (this.onLadder) {
      const climbSpeed = 68;
      this.hvy = moveUp ? -climbSpeed : moveDown ? climbSpeed : 0;
      this.hvx = dirInput * 40;
      if (this.jumpBuffer > 0) {
        this.jumpBuffer = 0;
        this.onLadder = false;
        this.hvy = -215;
        gameAudio.playJump();
      }
    } else {
      const waterSlow = this.inWater ? 0.62 : 1;
      const maxSpeed = 104 * stats.speedMult * waterSlow;
      const targetVx = dirInput * maxSpeed;
      const accel = this.onGround ? 920 : this.inWater ? 420 : 620;
      if (this.hvx < targetVx) this.hvx = Math.min(targetVx, this.hvx + accel * dt);
      else if (this.hvx > targetVx) this.hvx = Math.max(targetVx, this.hvx - accel * dt);

      if (this.onGround) this.coyoteTimer = 0.1;
      else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

      if (this.jumpBuffer > 0) {
        if (this.inWater) {
          // Swim upward in water!
          this.jumpBuffer = 0;
          this.onGround = false;
          this.hvy = -142;
          this.spawnParticles(this.hx, this.hy - 10, '#bae6fd', 4, 35);
          gameAudio.playJump();
        } else if (this.coyoteTimer > 0) {
          this.jumpBuffer = 0;
          this.coyoteTimer = 0;
          this.onGround = false;
          this.hvy = -228;
          this.squashX = 0.82;
          this.squashY = 1.2;
          gameAudio.playJump();
          this.spawnParticles(this.hx, this.hy, '#cbd5e1', 5, 45);
        }
      }

      // Gravity (buoyant in water)
      const grav = this.inWater ? 220 : 580;
      const maxFall = this.inWater ? 95 : 310;
      this.hvy = Math.min(maxFall, this.hvy + grav * dt);
    }

    // Horizontal move & collision
    const halfW = 5;
    const heroH = 22;
    this.hx += this.hvx * dt;
    this.hx = Math.max(halfW + 1, Math.min(this.area.cols * TILE_SIZE - halfW - 1, this.hx));

    const topRow = Math.floor((this.hy - heroH) / TILE_SIZE);
    const botRow = Math.floor((this.hy - 2) / TILE_SIZE);
    if (this.hvx > 0) {
      const rightCol = Math.floor((this.hx + halfW) / TILE_SIZE);
      for (let r = topRow; r <= botRow; r++) {
        if (this.isSolid(rightCol, r)) {
          this.hx = rightCol * TILE_SIZE - halfW - 0.01;
          this.hvx = 0;
          break;
        }
      }
    } else if (this.hvx < 0) {
      const leftCol = Math.floor((this.hx - halfW) / TILE_SIZE);
      for (let r = topRow; r <= botRow; r++) {
        if (this.isSolid(leftCol, r)) {
          this.hx = (leftCol + 1) * TILE_SIZE + halfW + 0.01;
          this.hvx = 0;
          break;
        }
      }
    }

    // Vertical move & collision (Tiles + Moving Platforms)
    const prevY = this.hy;
    const wasOnGround = this.onGround;
    if (!this.onMonkeyBar) {
      this.hy += this.hvy * dt;
    }
    this.onGround = false;

    const leftCol = Math.floor((this.hx - halfW + 1) / TILE_SIZE);
    const rightCol = Math.floor((this.hx + halfW - 1) / TILE_SIZE);

    if (this.hvy >= 0 && !this.onLadder && !this.onMonkeyBar) {
      // Check Moving Platforms first
      let landedOnMoving = false;
      if (!moveDown) {
        for (const mp of this.movingPlatforms) {
          const withinX = this.hx + halfW >= mp.x && this.hx - halfW <= mp.x + mp.w;
          const crossedTop = prevY <= mp.prevY + 4 && this.hy >= mp.y - 1;
          if (withinX && crossedTop) {
            this.hy = mp.y;
            this.hx += mp.x - mp.prevX;
            this.hvy = 0;
            this.onGround = true;
            landedOnMoving = true;
            if (!wasOnGround) {
              this.landAnimTimer = 0.14;
              this.squashX = 1.2;
              this.squashY = 0.8;
              gameAudio.playLand();
            }
            break;
          }
        }
      }

      if (!landedOnMoving) {
        const footRow = Math.floor((this.hy - 0.01) / TILE_SIZE);
        const prevFootRow = Math.floor((prevY - 0.01) / TILE_SIZE);
        for (let c = leftCol; c <= rightCol; c++) {
          const hitSolid = this.isSolid(c, footRow);
          const hitOneWay = this.isOneWay(c, footRow) && prevFootRow < footRow && !moveDown;
          if (hitSolid || hitOneWay) {
            this.hy = footRow * TILE_SIZE;
            this.hvy = 0;
            this.onGround = true;
            if (!wasOnGround) {
              this.landAnimTimer = 0.14;
              this.squashX = 1.2;
              this.squashY = 0.8;
              gameAudio.playLand();
              this.spawnParticles(this.hx, this.hy, '#94a3b8', 4, 38);
            }
            break;
          }
        }
      }
    } else if (this.hvy < 0 && !this.onMonkeyBar) {
      const headRow = Math.floor((this.hy - heroH) / TILE_SIZE);
      for (let c = leftCol; c <= rightCol; c++) {
        if (this.isSolid(c, headRow)) {
          this.hy = (headRow + 1) * TILE_SIZE + heroH;
          this.hvy = 0;
          break;
        }
      }
    }

    // Pit fall recovery / damage
    if (this.hy > this.area.rows * TILE_SIZE + 18) {
      this.damageHero(18, -this.hFacing);
      if (!this.isDead) {
        this.hx = Math.max(24, this.hx - 24);
        this.hy = (this.area.rows - 4) * TILE_SIZE;
        this.hvy = -120;
      }
    }

    // Spike hazard check
    const bodyRow = Math.floor((this.hy - 6) / TILE_SIZE);
    if (this.getTile(centerCol, bodyRow) === 5 && this.invulnTimer <= 0) {
      this.damageHero(12, -this.hFacing);
    }

    // Sword attack
    if (this.swordBuffer > 0 && this.swordCooldown <= 0 && this.hurtTimer <= 0) {
      this.swordBuffer = 0;
      const isDashSlash = this.dashTimer > 0;
      const step = isDashSlash ? 3 : this.comboStep;
      const isHeavy = step === 3 || isDashSlash;
      const speedMult = stats.swordDef.speedMult;

      let dirX: number = this.hFacing;
      let dirY = 0;
      if (moveUp) {
        dirX = 0;
        dirY = -1;
      } else if (moveDown && !this.onGround) {
        dirX = 0;
        dirY = 1;
      }

      this.slash = {
        active: true,
        timer: 0,
        duration: (isHeavy ? 0.24 : 0.17) / speedMult,
        dirX,
        dirY,
        isHeavy,
        isDashSlash,
        comboStep: step,
        hitIds: new Set<number>(),
      };

      this.swordCooldown = (isHeavy ? 0.28 : 0.19) / speedMult;
      this.comboResetTimer = 0.52;
      this.comboStep = step === 1 ? 2 : step === 2 ? 3 : 1;
      this.onLadder = false;
      gameAudio.playSword(step, isHeavy);

      if (stats.swordDef.id === 'excalibur') {
        this.spawnProjectile({
          fromHero: true,
          useGunSheet: false,
          x: this.hx + this.hFacing * 10,
          y: this.hy - 12,
          vx: this.hFacing * 210,
          vy: 0,
          damage: Math.round(stats.atk * 0.75),
          isCrit: false,
          spriteCol: 5,
          maxRange: null,
          pierce: true,
          element: 'holy',
        });
      }
    }

    // Gun shoot
    if (this.gunBuffer > 0 && this.shootCooldown <= 0 && this.hurtTimer <= 0) {
      this.gunBuffer = 0;
      const ammoCheck = consumeAmmo(this.save.ammo, 1);
      if (!ammoCheck.ok) {
        this.shootCooldown = 0.22;
        gameAudio.playNoAmmo();
        this.spawnFloatingText(this.hx, this.hy - 26, 'NO AMMO!', '#f87171');
      } else {
        this.save = { ...this.save, ammo: ammoCheck.nextAmmo };
        this.callbacks.onSaveUpdate(this.save);
        this.emitHud();

        const gun = stats.gunDef;
        let baseAngle = this.hFacing > 0 ? 0 : Math.PI;
        let aim: 'horiz' | 'up' | 'down' = 'horiz';
        let sx = this.hx + this.hFacing * 11;
        let sy = this.hy - 12;

        if (moveUp && !this.onMonkeyBar) {
          baseAngle = -Math.PI / 2;
          aim = 'up';
          sx = this.hx + this.hFacing * 3;
          sy = this.hy - 22;
        } else if (moveDown && !this.onGround) {
          baseAngle = Math.PI / 2;
          aim = 'down';
          sx = this.hx + this.hFacing * 3;
          sy = this.hy - 4;
        }

        const pellets = gun.pellets;
        const spreadRad = (gun.spreadAngleDeg * Math.PI) / 180;
        for (let pIdx = 0; pIdx < pellets; pIdx++) {
          const offset = pellets === 1 ? 0 : (pIdx - (pellets - 1) / 2) * spreadRad;
          const ang = baseAngle + offset;
          const dmgRes = calculateAttackDamage({
            rawAtk: stats.gunAtk,
            critRate: stats.critRate,
            rngValue: Math.random(),
          });

          this.spawnProjectile({
            fromHero: true,
            useGunSheet: true,
            x: sx,
            y: sy,
            vx: Math.cos(ang) * gun.projectileSpeed,
            vy: Math.sin(ang) * gun.projectileSpeed,
            damage: dmgRes.damage,
            isCrit: dmgRes.isCrit,
            spriteCol: gun.spriteIndex,
            maxRange: gun.rangePx,
            pierce: gun.pierce,
            element: gun.element,
          });
        }

        this.shootCooldown = gun.cooldownSec;
        this.shootPoseTimer = 0.18;
        this.shootAimDir = aim;
        this.squashX = 0.92;
        this.squashY = 1.06;
        gameAudio.playShoot();
      }
    }

    // Resolve hero animation state across 18 animations (including hangClimb)
    let nextAnim: HeroAnimName = 'idle';
    if (this.isDead) nextAnim = 'death';
    else if (this.hurtTimer > 0) nextAnim = 'hurt';
    else if (this.potionAnimTimer > 0) nextAnim = 'potion';
    else if (this.slash.active) {
      nextAnim = this.slash.comboStep === 1 ? 'sword1' : this.slash.comboStep === 2 ? 'sword2' : 'sword3';
    } else if (this.shootPoseTimer > 0) {
      nextAnim = this.shootAimDir === 'up' ? 'shootUp' : this.shootAimDir === 'down' ? 'shootDown' : 'shoot';
    } else if (this.dashTimer > 0) nextAnim = 'dash';
    else if (this.onMonkeyBar) nextAnim = 'hangClimb';
    else if (this.onLadder) nextAnim = 'climb';
    else if (!this.onGround) nextAnim = this.hvy < 0 ? 'jump' : 'fall';
    else if (this.landAnimTimer > 0) nextAnim = 'land';
    else if (Math.abs(this.hvx) > 68) nextAnim = 'run';
    else if (Math.abs(this.hvx) > 10) nextAnim = 'walk';
    else nextAnim = 'idle';

    if (nextAnim !== this.animName) {
      this.animName = nextAnim;
      this.animTime = 0;
    } else {
      if (
        (this.animName === 'climb' && Math.abs(this.hvy) < 1 && Math.abs(this.hvx) < 1) ||
        (this.animName === 'hangClimb' && Math.abs(this.hvx) < 1)
      ) {
        // pause frame when stationary while holding ladder/bar
      } else {
        this.animTime += dt;
      }
    }
  }

  private updateSlash(dt: number) {
    if (!this.slash.active) return;
    this.slash.timer += dt;
    if (this.slash.timer >= this.slash.duration) {
      this.slash.active = false;
      return;
    }

    const stats = computeHeroStats(this.save);
    const reach = 22 + stats.swordDef.rangeBonus + (this.slash.isHeavy ? 6 : 0);
    const boxX = this.hx + this.slash.dirX * (reach * 0.55);
    const boxY = this.hy - 12 + this.slash.dirY * (reach * 0.55);
    const boxW = (this.slash.dirX !== 0 ? reach : 22) + (this.slash.isDashSlash ? 6 : 0);
    const boxH = this.slash.dirY !== 0 ? reach : 22;

    for (const enemy of this.enemies) {
      if (enemy.dead || this.slash.hitIds.has(enemy.id)) continue;
      const ex1 = enemy.x - enemy.w / 2;
      const ex2 = enemy.x + enemy.w / 2;
      const ey1 = enemy.y - enemy.h;
      const ey2 = enemy.y;

      if (boxX + boxW / 2 >= ex1 && boxX - boxW / 2 <= ex2 && boxY + boxH / 2 >= ey1 && boxY - boxH / 2 <= ey2) {
        this.slash.hitIds.add(enemy.id);

        const hittingFromFront =
          enemy.behavior === 'knight' &&
          enemy.telegraphTimer <= 0 &&
          !this.slash.isHeavy &&
          Math.sign(this.hx - enemy.x) === enemy.facing;

        if (hittingFromFront) {
          gameAudio.playNoAmmo();
          this.spawnVfx(enemy.x + enemy.facing * 6, enemy.y - 10, 2, 0, 4, 0.16);
          this.spawnFloatingText(enemy.x, enemy.y - 22, 'GUARD', '#94a3b8');
          continue;
        }

        const dmgRes = calculateAttackDamage({
          rawAtk: stats.atk,
          critRate: stats.critRate,
          rngValue: Math.random(),
          multiplier: this.slash.isHeavy ? 1.45 : this.slash.comboStep === 2 ? 1.15 : 1.0,
          isBossTarget: enemy.kind === 'boss',
          swordId: stats.swordDef.id,
        });

        this.applyDamageToEnemy(enemy, dmgRes.damage, dmgRes.isCrit, this.hFacing, stats.swordDef.element);

        if (this.slash.dirY > 0 && !this.onGround) {
          this.hvy = -190;
        }
      }
    }
  }

  private applyDamageToEnemy(
    enemy: ActiveEnemy,
    damage: number,
    isCrit: boolean,
    knockDir: number,
    element: string,
  ) {
    enemy.hp -= damage;
    enemy.hitFlash = 0.08;
    if (enemy.kind !== 'boss' && enemy.behavior !== 'turret') {
      enemy.vx = knockDir * (isCrit ? 90 : 55);
    }

    if (element === 'ice') enemy.slowTimer = 2.5;
    if (element === 'fire') enemy.burnTimer = 3.0;
    if (element === 'thunder') enemy.stunTimer = 0.65;

    this.hitstopTimer = isCrit || enemy.hp <= 0 ? 0.055 : 0.03;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + (isCrit ? 0.42 : 0.22));
    gameAudio.playHit(isCrit);

    this.spawnVfx(enemy.x, enemy.y - enemy.h * 0.5, isCrit ? 3 : 2, 0, 4, 0.22);
    this.spawnParticles(enemy.x, enemy.y - enemy.h * 0.5, isCrit ? '#facc15' : '#38bdf8', isCrit ? 12 : 6, 85);
    this.spawnFloatingText(
      enemy.x,
      enemy.y - enemy.h - 4,
      isCrit ? `CRIT ${damage}!` : `${damage}`,
      isCrit ? '#facc15' : '#ffffff',
    );

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.dead = true;
      enemy.koTimer = 0.32;
      this.runEnemiesDefeated += 1;
      this.areaKills += 1;
      this.runExpGained += enemy.expReward;
      this.runGoldGained += enemy.goldReward;
      this.runScore += enemy.kind === 'boss' ? 500 : 100;

      if (this.save.equippedSword === 'dark_sword' || this.save.equippedSword === 'shadow_katana') {
        this.hp = Math.min(this.maxHp, this.hp + 4);
      }

      gameAudio.playExplosion();
      this.spawnVfx(enemy.x, enemy.y - enemy.h * 0.5, 2, 4, 4, 0.28);
      this.spawnParticles(enemy.x, enemy.y - enemy.h * 0.5, '#f97316', 16, 110);
      this.spawnEnemyDrops(enemy);

      const expRes = addExpAndLevelUp(
        {
          ...this.save,
          gold: this.save.gold + enemy.goldReward,
          stats: {
            ...this.save.stats,
            enemiesKilled: this.save.stats.enemiesKilled + 1,
            bossesKilled: this.save.stats.bossesKilled + (enemy.kind === 'boss' ? 1 : 0),
          },
        },
        enemy.expReward,
      );
      this.save = expRes.next;
      if (expRes.levelsGained > 0) {
        const nextStats = computeHeroStats(this.save);
        this.maxHp = nextStats.maxHp;
        this.hp = this.maxHp;
        this.spawnFloatingText(this.hx, this.hy - 30, `LEVEL UP ${this.save.level}!`, '#38bdf8');
        gameAudio.playPickup(true);
      }
      this.callbacks.onSaveUpdate(this.save);

      if (!this.area.isBossArea && this.areaKills === KILLS_TO_OPEN_EXIT) {
        this.spawnFloatingText(this.hx, this.hy - 34, 'EXIT PORTAL OPEN!', '#4ade80');
        gameAudio.playPickup(true);
      }
      if (enemy.kind === 'boss') {
        this.spawnFloatingText(this.hx, this.hy - 34, 'BOSS DEFEATED! PORTAL OPEN!', '#fde047');
        gameAudio.playPickup(true);
      }
      this.emitHud();
    }
  }

  private spawnEnemyDrops(enemy: ActiveEnemy) {
    // Only 10% drop rate on regular keroco enemies! Bosses guarantee loot drops.
    if (enemy.kind !== 'boss' && !shouldEnemyDropItem(Math.random())) {
      return;
    }

    const dropBurst = enemy.kind === 'boss' ? 4 : 1;
    for (let i = 0; i < dropBurst; i++) {
      const kind = rollEnemyDropKind(Math.random(), Math.random());
      let spriteCol = 5;
      let amount = 1;

      switch (kind) {
        case 'ammo_small':
          spriteCol = 0;
          amount = 5;
          break;
        case 'ammo_medium':
          spriteCol = 1;
          amount = 12;
          break;
        case 'ammo_large':
          spriteCol = 2;
          amount = 25;
          break;
        case 'hp_potion':
          spriteCol = 3;
          amount = 1;
          break;
        case 'mana_potion':
          spriteCol = 4;
          amount = 1;
          break;
        case 'gold':
          spriteCol = 5;
          amount = 14 + this.stage.stageNumber * 2;
          break;
        case 'rare_crystal':
          spriteCol = 6;
          amount = 1;
          break;
        case 'weapon_material':
          spriteCol = 7;
          amount = 1;
          break;
      }

      if (enemy.kind === 'boss' && i === 0) {
        this.drops.push({
          id: this.nextDropId++,
          kind: 'rare_crystal',
          x: enemy.x,
          y: enemy.y - 8,
          vx: (Math.random() - 0.5) * 90,
          vy: -140,
          life: 14,
          spriteCol: 6,
          amount: 3,
        });
        continue;
      }

      this.drops.push({
        id: this.nextDropId++,
        kind,
        x: enemy.x,
        y: enemy.y - 8,
        vx: (Math.random() - 0.5) * 90,
        vy: -130 - Math.random() * 50,
        life: 14,
        spriteCol,
        amount,
      });
    }
  }

  private updateEnemies(dt: number) {
    let activeAttackers = 0;
    for (const e of this.enemies) {
      if (!e.dead && (e.telegraphTimer > 0 || e.attackCooldown > 1.2)) activeAttackers++;
    }

    for (const e of this.enemies) {
      e.animTime += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);

      if (e.dead) {
        e.koTimer = Math.max(0, e.koTimer - dt);
        continue;
      }

      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.burnTick += dt;
        if (e.burnTick >= 0.65) {
          e.burnTick = 0;
          this.applyDamageToEnemy(e, Math.max(2, Math.round(e.maxHp * 0.06)), false, 0, 'none');
          if (e.dead) continue;
        }
      }

      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
        continue;
      }

      e.slowTimer = Math.max(0, e.slowTimer - dt);
      const speedMult = e.slowTimer > 0 ? 0.45 : 1;

      const dx = this.hx - e.x;
      const dy = this.hy - e.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > 4) e.facing = dx >= 0 ? 1 : -1;

      e.attackCooldown = Math.max(0, e.attackCooldown - dt);

      const b = e.behavior;
      if (b === 'slime' || b === 'crawler') {
        e.aiTimer -= dt;
        if (b === 'slime') {
          if (e.aiTimer <= 0 && dist < 170) {
            e.aiTimer = 1.15;
            e.vy = -140;
            e.vx = e.facing * e.speed * 1.6 * speedMult;
          }
        } else {
          e.vx = dist < 165 ? e.facing * e.speed * speedMult : 0;
        }
        e.vy += 460 * dt;
      } else if (b === 'bat' || b === 'ghost') {
        const hoverY = this.hy - 32 + Math.sin(e.animTime * 4.5) * 14;
        if (dist < 170) {
          e.vx = Math.sign(dx) * e.speed * speedMult;
          e.vy = Math.sign(hoverY - e.y) * e.speed * 0.8 * speedMult;
        } else {
          e.vx = Math.sin(e.animTime * 2) * 20;
          e.vy = Math.cos(e.animTime * 3) * 14;
        }
      } else if (b === 'trooper' || b === 'mage') {
        if (e.telegraphTimer > 0) {
          e.vx = 0;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const ang = b === 'mage' ? Math.atan2(this.hy - 12 - (e.y - 10), this.hx - e.x) : e.facing > 0 ? 0 : Math.PI;
            this.spawnProjectile({
              fromHero: false,
              useGunSheet: false,
              x: e.x + e.facing * 8,
              y: e.y - 10,
              vx: Math.cos(ang) * 135,
              vy: Math.sin(ang) * 135,
              damage: e.atk,
              isCrit: false,
              spriteCol: 3,
              maxRange: 260,
              pierce: false,
              element: 'none',
            });
            e.attackCooldown = 1.7;
          }
        } else if (dist < 185) {
          if (dist < 52) e.vx = -e.facing * e.speed * speedMult;
          else if (dist > 95) e.vx = e.facing * e.speed * speedMult;
          else e.vx = 0;
          if (e.attackCooldown <= 0 && activeAttackers < 3) {
            e.telegraphTimer = 0.42;
            activeAttackers++;
          }
        }
        e.vy += 480 * dt;
      } else if (b === 'knight' || b === 'skeleton' || b === 'golem') {
        if (e.telegraphTimer > 0) {
          e.vx = 0;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            e.vx = e.facing * (b === 'golem' ? 115 : 95) * speedMult;
            e.attackCooldown = 1.4;
          }
        } else if (dist < 155) {
          e.vx = e.facing * e.speed * speedMult;
          if (dist < 28 && e.attackCooldown <= 0 && activeAttackers < 3) {
            e.telegraphTimer = 0.48;
            activeAttackers++;
          }
        } else {
          e.vx = 0;
        }
        e.vy += 480 * dt;
      } else if (b === 'turret') {
        e.vx = 0;
        e.vy = 0;
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const ang = Math.atan2(this.hy - 12 - (e.y - 10), this.hx - e.x);
            this.spawnProjectile({
              fromHero: false,
              useGunSheet: false,
              x: e.x,
              y: e.y - 10,
              vx: Math.cos(ang) * 145,
              vy: Math.sin(ang) * 145,
              damage: e.atk,
              isCrit: false,
              spriteCol: 3,
              maxRange: 280,
              pierce: false,
              element: 'none',
            });
            e.attackCooldown = 1.85;
          }
        } else if (dist < 190 && e.attackCooldown <= 0 && activeAttackers < 3) {
          e.telegraphTimer = 0.5;
          activeAttackers++;
        }
      } else if (b === 'boss') {
        const pattern = e.bossDef?.pattern ?? 'firebreath';
        if (e.telegraphTimer > 0) {
          e.vx = 0;
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            if (pattern === 'final_abyss') {
              // Final boss fires 5-way burst + dash leap
              for (const vyOff of [-55, -25, 0, 25, 55]) {
                this.spawnProjectile({
                  fromHero: false,
                  useGunSheet: false,
                  x: e.x + e.facing * 14,
                  y: e.y - 20,
                  vx: e.facing * 165,
                  vy: vyOff,
                  damage: e.atk,
                  isCrit: false,
                  spriteCol: 4,
                  maxRange: 340,
                  pierce: false,
                  element: 'dark',
                });
              }
              if (Math.random() < 0.4) {
                e.vx = e.facing * 160 * speedMult;
                e.vy = -165;
              }
            } else if (pattern === 'orb_burst' || pattern === 'firebreath' || Math.random() < 0.55) {
              for (const vyOff of [-35, 0, 35]) {
                this.spawnProjectile({
                  fromHero: false,
                  useGunSheet: false,
                  x: e.x + e.facing * 14,
                  y: e.y - 20,
                  vx: e.facing * 155,
                  vy: vyOff,
                  damage: e.atk,
                  isCrit: false,
                  spriteCol: 4,
                  maxRange: 300,
                  pierce: false,
                  element: 'fire',
                });
              }
            } else {
              e.vx = e.facing * 155 * speedMult;
              e.vy = -155;
            }
            e.attackCooldown = e.bossDef?.isFinalBoss ? 1.25 : 1.5;
          }
        } else {
          e.vx = e.facing * e.speed * 0.75 * speedMult;
          if (e.attackCooldown <= 0) {
            e.telegraphTimer = 0.55;
            gameAudio.playBossTelegraph();
          }
        }
        e.vy += 480 * dt;
      }

      // Enemy movement & ground clamp
      e.x = Math.max(16, Math.min(this.area.cols * TILE_SIZE - 16, e.x + e.vx * dt));
      if (b !== 'bat' && b !== 'ghost' && b !== 'turret') {
        e.y += e.vy * dt;
        const col = Math.floor(e.x / TILE_SIZE);
        const row = Math.floor(e.y / TILE_SIZE);
        if (this.isSolid(col, row)) {
          e.y = row * TILE_SIZE;
          e.vy = 0;
          if (b === 'slime') e.vx *= 0.7;
        }
        if (e.y > this.area.rows * TILE_SIZE) {
          e.y = (this.area.rows - 2) * TILE_SIZE;
          e.vy = 0;
        }
      } else if (b === 'bat' || b === 'ghost') {
        e.y = Math.max(32, Math.min((this.area.rows - 3) * TILE_SIZE, e.y + e.vy * dt));
      }

      // Hero contact damage
      if (
        this.invulnTimer <= 0 &&
        Math.abs(this.hx - e.x) < e.w * 0.45 + 4 &&
        this.hy > e.y - e.h + 2 &&
        this.hy - 20 < e.y - 2
      ) {
        this.damageHero(e.atk, this.hx < e.x ? -1 : 1);
      }
    }
  }

  private damageHero(rawDmg: number, knockDir: number) {
    if (this.invulnTimer > 0 || this.isDead || this.stageCleared) return;
    const stats = computeHeroStats(this.save);
    const dmg = Math.max(2, Math.round(rawDmg - stats.def * 0.35));
    this.hp = Math.max(0, this.hp - dmg);
    this.runDamageTaken += dmg;
    this.invulnTimer = 1.1;
    this.hurtTimer = 0.24;
    this.dashTimer = 0;
    this.onLadder = false;
    this.onMonkeyBar = false;
    if (knockDir !== 0) {
      this.hvx = knockDir * 110;
      this.hvy = -125;
    }
    this.hitstopTimer = 0.05;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.55);

    gameAudio.playHurt();
    this.spawnFloatingText(this.hx, this.hy - 24, `-${dmg}`, '#f87171');
    this.spawnParticles(this.hx, this.hy - 12, '#ef4444', 10, 80);

    if (this.hp <= 0) {
      this.isDead = true;
      this.deathTimer = 0;
      this.animName = 'death';
      this.animTime = 0;
      gameAudio.playGameOver();
    }
    this.emitHud();
  }

  private spawnProjectile(opts: Omit<Projectile, 'active' | 'life' | 'distTraveled'>) {
    const slot = this.projectiles.find((p) => !p.active);
    if (!slot) return;
    slot.active = true;
    slot.fromHero = opts.fromHero;
    slot.useGunSheet = opts.useGunSheet;
    slot.x = opts.x;
    slot.y = opts.y;
    slot.vx = opts.vx;
    slot.vy = opts.vy;
    slot.damage = opts.damage;
    slot.isCrit = opts.isCrit;
    slot.spriteCol = opts.spriteCol;
    slot.maxRange = opts.maxRange;
    slot.pierce = opts.pierce;
    slot.element = opts.element;
    slot.distTraveled = 0;
    slot.life = opts.maxRange === null ? 4.5 : 2.2;
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      const dx = p.vx * dt;
      const dy = p.vy * dt;
      p.x += dx;
      p.y += dy;
      p.distTraveled += Math.hypot(dx, dy);

      if (p.maxRange !== null && p.distTraveled >= p.maxRange) {
        p.active = false;
        this.spawnParticles(p.x, p.y, '#94a3b8', 3, 25);
        continue;
      }

      const outOfArea =
        p.x < 0 ||
        p.x > this.area.cols * TILE_SIZE ||
        p.y < 16 ||
        p.y > CANVAS_SIZE;
      const outOfScreenForFinite =
        p.maxRange !== null && (p.x < this.camX - 24 || p.x > this.camX + CANVAS_SIZE + 24);

      if (p.life <= 0 || outOfArea || outOfScreenForFinite) {
        p.active = false;
        continue;
      }

      const col = Math.floor(p.x / TILE_SIZE);
      const row = Math.floor(p.y / TILE_SIZE);
      if (!p.pierce && this.isSolid(col, row)) {
        p.active = false;
        this.spawnVfx(p.x, p.y, 2, 4, 4, 0.18);
        continue;
      }

      if (p.fromHero) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.abs(p.x - e.x) < e.w * 0.55 && p.y >= e.y - e.h && p.y <= e.y) {
            if (e.behavior === 'knight' && !p.pierce && Math.sign(p.vx) !== e.facing && e.telegraphTimer <= 0) {
              p.active = false;
              gameAudio.playNoAmmo();
              this.spawnVfx(p.x, p.y, 2, 0, 4, 0.15);
              this.spawnFloatingText(e.x, e.y - 22, 'BLOCK', '#94a3b8');
              break;
            }
            if (!p.pierce) p.active = false;
            else p.life = Math.min(p.life, 0.25);
            this.spawnVfx(p.x, p.y, 2, 4, 4, 0.22);
            this.applyDamageToEnemy(e, p.damage, p.isCrit, Math.sign(p.vx) || 1, p.element);
            break;
          }
        }
      } else {
        if (this.invulnTimer <= 0 && Math.abs(p.x - this.hx) < 8 && p.y >= this.hy - 20 && p.y <= this.hy) {
          p.active = false;
          this.spawnVfx(p.x, p.y, 2, 4, 4, 0.2);
          this.damageHero(p.damage, Math.sign(p.vx) || -1);
        }
      }
    }
  }

  private updateDrops(dt: number) {
    const stats = computeHeroStats(this.save);
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.drops.splice(i, 1);
        continue;
      }
      d.vy += 460 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      const col = Math.floor(d.x / TILE_SIZE);
      const row = Math.floor((d.y + 6) / TILE_SIZE);
      if (this.isSolid(col, row) || this.isOneWay(col, row)) {
        d.y = row * TILE_SIZE - 6;
        d.vy = Math.abs(d.vy) > 40 ? -Math.abs(d.vy) * 0.4 : 0;
        d.vx *= 0.65;
      }

      const dist = Math.hypot(this.hx - d.x, this.hy - 10 - d.y);
      if (dist < 28) {
        d.x += (this.hx - d.x) * Math.min(1, dt * 10);
        d.y += (this.hy - 10 - d.y) * Math.min(1, dt * 10);
      }

      if (dist < 14) {
        let label = '';
        let color = '#fef08a';
        let nextSave = { ...this.save };

        switch (d.kind) {
          case 'ammo_small':
          case 'ammo_medium':
          case 'ammo_large':
            nextSave.ammo = refillAmmo(nextSave.ammo, stats.effectiveMaxAmmo, d.amount);
            label = `+${d.amount} AMMO`;
            color = '#facc15';
            break;
          case 'hp_potion': {
            const potRes = addHpPotion(nextSave.hpPotions, 1);
            nextSave.hpPotions = potRes.nextPotions;
            if (potRes.overflow > 0) {
              const heal = 15;
              this.hp = Math.min(this.maxHp, this.hp + heal);
              label = '+15 HP (MAX POT)';
              color = '#4ade80';
            } else {
              label = '+1 HP POT';
              color = '#f87171';
            }
            break;
          }
          case 'mana_potion':
            nextSave.manaPotions += 1;
            label = '+1 MP POT';
            color = '#60a5fa';
            break;
          case 'gold':
            nextSave.gold += d.amount;
            this.runGoldGained += d.amount;
            label = `+${d.amount}G`;
            color = '#fde047';
            break;
          case 'rare_crystal':
            nextSave.rareCrystals += d.amount;
            nextSave.stats = {
              ...nextSave.stats,
              crystalsCollected: nextSave.stats.crystalsCollected + d.amount,
            };
            label = '+CRYSTAL';
            color = '#22d3ee';
            break;
          case 'weapon_material':
            nextSave.weaponMaterials += d.amount;
            label = '+1 IRON';
            color = '#cbd5e1';
            break;
        }

        this.save = nextSave;
        this.callbacks.onSaveUpdate(this.save);
        this.emitHud();
        gameAudio.playPickup(d.kind === 'rare_crystal' || d.kind === 'ammo_large');
        this.spawnFloatingText(d.x, d.y - 8, label, color);
        this.drops.splice(i, 1);
      }
    }
  }

  private updateChests() {
    for (const c of this.chests) {
      if (c.opened) continue;
      if (Math.hypot(this.hx - c.x, this.hy - 8 - c.y) < 18) {
        c.opened = true;
        let nextSave: SaveState = {
          ...this.save,
          gold: this.save.gold + c.gold,
          rareCrystals: this.save.rareCrystals + c.crystals,
          stats: {
            ...this.save.stats,
            crystalsCollected: this.save.stats.crystalsCollected + c.crystals,
          },
        };
        if (c.swordReward && !nextSave.ownedSwords.includes(c.swordReward)) {
          nextSave = {
            ...nextSave,
            ownedSwords: [...nextSave.ownedSwords, c.swordReward],
            swordUpgrades: { ...nextSave.swordUpgrades, [c.swordReward]: 0 },
          };
          this.foundSwordInRun = c.swordReward;
          this.spawnFloatingText(c.x, c.y - 20, `${getSwordDef(c.swordReward).name}!`, '#fde047');
        } else {
          this.spawnFloatingText(c.x, c.y - 16, `+${c.gold}G +${c.crystals} CRYS`, '#22d3ee');
        }
        this.save = nextSave;
        this.callbacks.onSaveUpdate(this.save);
        gameAudio.playPickup(true);
        this.spawnParticles(c.x, c.y - 8, '#fde047', 12, 75);
      }
    }
  }

  private checkPortals() {
    if (this.portalCooldown > 0) return;
    for (const portal of this.area.portals) {
      if (Math.hypot(this.hx - portal.x, this.hy - 10 - (portal.y - 12)) < 18) {
        if (portal.kind === 'warp' && portal.targetPortalId !== undefined) {
          const dest = this.area.portals.find((p) => p.id === portal.targetPortalId);
          if (dest) {
            this.portalCooldown = 1.1;
            this.hx = dest.x;
            this.hy = dest.y;
            this.hvy = -60;
            this.onMonkeyBar = false;
            this.onLadder = false;
            gameAudio.playDash();
            this.spawnParticles(dest.x, dest.y - 12, '#38bdf8', 14, 75);
            this.spawnFloatingText(dest.x, dest.y - 26, 'WARP!', '#38bdf8');
          }
          return;
        }

        if (portal.kind === 'exit') {
          if (this.area.isBossArea) {
            const bossAlive = this.enemies.some((e) => e.kind === 'boss' && !e.dead);
            if (bossAlive) {
              this.portalCooldown = 0.6;
              this.spawnFloatingText(portal.x, portal.y - 26, 'DEFEAT BOSS!', '#f87171');
              return;
            }
          } else if (this.areaKills < portal.requiredKills) {
            this.portalCooldown = 0.6;
            this.spawnFloatingText(
              portal.x,
              portal.y - 26,
              `KILL ${this.areaKills}/${portal.requiredKills}`,
              '#facc15',
            );
            return;
          }

          if (this.areaIndex < PORTALS_PER_STAGE - 1) {
            gameAudio.playPickup(true);
            this.loadArea(this.areaIndex + 1);
          } else {
            this.stageCleared = true;
            this.clearDelayTimer = 0.6;
            gameAudio.playVictory();
            this.spawnParticles(portal.x, portal.y - 12, '#38bdf8', 18, 95);
          }
          return;
        }
      }
    }
  }

  private finishStageVictory() {
    const sNum = this.stage.stageNumber;
    const clearedStages = this.save.clearedStages.includes(sNum)
      ? this.save.clearedStages
      : [...this.save.clearedStages, sNum];
    const highestUnlockedStage = Math.min(100, Math.max(this.save.highestUnlockedStage, sNum + 1));
    const bonusExp = 25 + sNum * 6;
    const bonusGold = 30 + sNum * 5;
    const finalScore =
      this.runScore +
      Math.max(0, Math.round(400 - this.runTime * 5)) +
      (this.runDamageTaken === 0 ? 250 : 0);
    const bestScore = Math.max(this.save.stats.bestScore, finalScore);

    let nextSave: SaveState = {
      ...this.save,
      gold: this.save.gold + bonusGold,
      clearedStages,
      highestUnlockedStage,
      stats: { ...this.save.stats, bestScore },
    };
    const expRes = addExpAndLevelUp(nextSave, bonusExp);
    nextSave = expRes.next;
    this.save = nextSave;
    this.callbacks.onSaveUpdate(nextSave);

    this.callbacks.onRunComplete({
      outcome: 'victory',
      stage: sNum,
      clearTimeSec: this.runTime,
      score: finalScore,
      bestScore,
      damageTaken: this.runDamageTaken,
      enemiesDefeated: this.runEnemiesDefeated,
      expGained: this.runExpGained + bonusExp,
      goldGained: this.runGoldGained + bonusGold,
      unlockedNextStage: highestUnlockedStage,
      foundSword: this.foundSwordInRun,
    });
  }

  private finishStageDefeat() {
    const boss = this.enemies.find((e) => e.kind === 'boss');
    const bossHpRemainingPct = boss ? Math.round((boss.hp / boss.maxHp) * 100) : undefined;
    const bestScore = Math.max(this.save.stats.bestScore, this.runScore);
    if (bestScore > this.save.stats.bestScore) {
      this.save = { ...this.save, stats: { ...this.save.stats, bestScore } };
      this.callbacks.onSaveUpdate(this.save);
    }
    this.callbacks.onRunComplete({
      outcome: 'defeat',
      stage: this.stage.stageNumber,
      clearTimeSec: this.runTime,
      score: this.runScore,
      bestScore,
      damageTaken: this.runDamageTaken,
      enemiesDefeated: this.runEnemiesDefeated,
      expGained: this.runExpGained,
      goldGained: this.runGoldGained,
      bossHpRemainingPct,
    });
  }

  // ---- Pooled VFX / Particles / Text ----
  private spawnParticles(x: number, y: number, color: string, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 20;
      p.life = 0.25 + Math.random() * 0.25;
      p.maxLife = p.life;
      p.color = color;
      p.size = Math.random() > 0.5 ? 2 : 1;
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += 180 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private spawnVfx(x: number, y: number, row: number, colStart: number, frames: number, duration: number) {
    const slot = this.vfxList.find((v) => !v.active);
    if (!slot) return;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.row = row;
    slot.colStart = colStart;
    slot.frames = frames;
    slot.timer = 0;
    slot.duration = duration;
  }

  private updateVfx(dt: number) {
    for (const v of this.vfxList) {
      if (!v.active) continue;
      v.timer += dt;
      if (v.timer >= v.duration) v.active = false;
    }
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string) {
    const slot = this.floatingTexts.find((f) => !f.active);
    if (!slot) return;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vy = -26;
    slot.text = text;
    slot.color = color;
    slot.life = 0.7;
  }

  private updateFloatingTexts(dt: number) {
    for (const f of this.floatingTexts) {
      if (!f.active) continue;
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) f.active = false;
    }
  }

  private emitHud() {
    const stats = computeHeroStats(this.save);
    const boss = this.enemies.find((e) => e.kind === 'boss' && !e.dead);
    const req = this.area.isBossArea ? 0 : KILLS_TO_OPEN_EXIT;
    this.callbacks.onHudUpdate({
      hp: Math.round(this.hp),
      maxHp: Math.round(this.maxHp),
      mp: Math.round(this.mp),
      maxMp: Math.round(this.maxMp),
      ammo: Math.round(this.save.ammo),
      maxAmmo: stats.effectiveMaxAmmo,
      hpPotions: this.save.hpPotions,
      level: this.save.level,
      stage: this.stage.stageNumber,
      portal: this.areaIndex + 1,
      totalPortals: PORTALS_PER_STAGE,
      areaKills: this.areaKills,
      requiredKills: req,
      biomeName: this.stage.biome.name,
      score: this.runScore,
      bossHpPct: boss ? Math.max(0, Math.round((boss.hp / boss.maxHp) * 100)) : null,
    });
  }

  // ---- Rendering (PNG Sprite Sheets, Pixel-Exact!) ----
  private render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const shakeMag = this.shakeTrauma * this.shakeTrauma * 5;
    const shakeX = shakeMag > 0.1 ? Math.round((Math.random() - 0.5) * 2 * shakeMag) : 0;
    const shakeY = shakeMag > 0.1 ? Math.round((Math.random() - 0.5) * 2 * shakeMag) : 0;

    // 1. Parallax Background PNG (6 Biomes x 256x240)
    const biomeIdx = this.stage.biome.index;
    const bgY = biomeIdx * 240;
    const scrollSrc = this.mode === 'title' ? this.titleScrollX : this.camX * 0.35;
    const pOffset = Math.floor(scrollSrc) % 256;
    const bgDestY = this.mode === 'title' ? 0 : HUD_BAR_HEIGHT;
    ctx.drawImage(this.sprites.backgrounds, pOffset, bgY, 256 - pOffset, 240, 0, bgDestY, 256 - pOffset, 240);
    if (pOffset > 0) {
      ctx.drawImage(this.sprites.backgrounds, 0, bgY, pOffset, 240, 256 - pOffset, bgDestY, pOffset, 240);
    }

    ctx.save();
    ctx.translate(shakeX, (this.mode === 'title' ? 0 : HUD_BAR_HEIGHT) + shakeY);

    if (this.mode === 'title') {
      const gRow = this.area.rows - 1;
      for (let c = 0; c < 17; c++) {
        const dx = c * TILE_SIZE - (Math.floor(this.titleScrollX * 1.4) % TILE_SIZE);
        ctx.drawImage(this.sprites.tiles, 0, 0, 16, 16, dx, gRow * TILE_SIZE, 16, 16);
        ctx.drawImage(this.sprites.tiles, 16, 0, 16, 16, dx, (gRow + 1) * TILE_SIZE, 16, 16);
      }
      const spec = HERO_ANIMS.run;
      const frame = Math.floor(this.animTime * spec.fps) % spec.frames;
      ctx.drawImage(this.sprites.hero, frame * 32, spec.row * 32, 32, 32, 36, gRow * TILE_SIZE - 28, 32, 32);
      ctx.restore();
      return;
    }

    // 2. Stage Tiles PNG (including Monkey Bar tile 7 and Water tile 8)
    const camI = Math.floor(this.camX);
    const startCol = Math.max(0, Math.floor(camI / TILE_SIZE));
    const endCol = Math.min(this.area.cols - 1, startCol + 17);
    const tileBiomeY = biomeIdx * 16;

    for (let r = 0; r < this.area.rows; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const t = this.area.tiles[r][c];
        if (t === 0) continue;
        const dx = c * TILE_SIZE - camI;
        const dy = r * TILE_SIZE;
        let srcCol = 0;
        if (t === 1) srcCol = 0;
        else if (t === 2) srcCol = 1;
        else if (t === 3) srcCol = 2;
        else if (t === 4) srcCol = 3;
        else if (t === 5) srcCol = 4;
        else if (t === 6) srcCol = 5;
        else if (t === 7) srcCol = 7; // Monkey bar rail
        else if (t === 8) {
          const aboveIsWater = r > 0 && this.area.tiles[r - 1][c] === 8;
          srcCol = aboveIsWater ? 9 : 8;
          ctx.globalAlpha = 0.82;
        }
        ctx.drawImage(this.sprites.tiles, srcCol * 16, tileBiomeY, 16, 16, dx, dy, 16, 16);
        ctx.globalAlpha = 1;
      }
    }

    // 2b. Moving Platforms (Horizontal & Vertical)
    for (const mp of this.movingPlatforms) {
      const mx = Math.round(mp.x - camI);
      const my = Math.round(mp.y);
      ctx.drawImage(this.sprites.tiles, 6 * 16, tileBiomeY, 16, 16, mx, my, 16, 16);
      ctx.drawImage(this.sprites.tiles, 6 * 16, tileBiomeY, 16, 16, mx + 16, my, 16, 16);
    }

    // 3. Large Rotating Square Portals (Branch Warp + Exit Portal)
    const bossBlocking = this.area.isBossArea && this.enemies.some((e) => e.kind === 'boss' && !e.dead);
    const pFrame = Math.floor(this.portalAnim) % 8;

    for (const portal of this.area.portals) {
      const px = Math.round(portal.x - camI) - 16;
      const py = Math.round(portal.y) - 30;
      if (px < -36 || px > CANVAS_SIZE + 36) continue;

      const isExit = portal.kind === 'exit';
      const locked = isExit && (bossBlocking || (!this.area.isBossArea && this.areaKills < portal.requiredKills));
      const row = isExit ? 0 : 1;

      if (locked) ctx.globalAlpha = 0.38;
      ctx.drawImage(this.sprites.portals, pFrame * 32, row * 32, 32, 32, px, py, 32, 32);
      ctx.globalAlpha = 1;

      // Crisp portal label above
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      const label = !isExit
        ? 'WARP'
        : bossBlocking
          ? 'BOSS'
          : locked
            ? `${this.areaKills}/${portal.requiredKills}`
            : 'EXIT!';
      ctx.fillStyle = '#0f111a';
      ctx.fillText(label, px + 17, py - 1);
      ctx.fillStyle = !isExit ? '#38bdf8' : locked ? '#facc15' : '#4ade80';
      ctx.fillText(label, px + 16, py - 2);
    }

    // 4. Treasure Chests PNG
    for (const c of this.chests) {
      const cx = Math.round(c.x - camI) - 8;
      const cy = Math.round(c.y) - 15;
      ctx.drawImage(this.sprites.itemsVfx, (c.opened ? 7 : 6) * 16, 16, 16, 16, cx, cy, 16, 16);
    }

    // 5. Drops PNG
    for (const d of this.drops) {
      const dx = Math.round(d.x - camI) - 8;
      const dy = Math.round(d.y) - 8;
      ctx.drawImage(this.sprites.itemsVfx, d.spriteCol * 16, 0, 16, 16, dx, dy, 16, 16);
    }

    // 6. 40 Keroco Enemies & 10+1 Bosses PNG + Enemy Level Label (Lv.X)
    for (const e of this.enemies) {
      if (e.dead && e.koTimer <= 0) continue;
      const sxScreen = Math.round(e.x - camI);
      const syScreen = Math.round(e.y);
      if (sxScreen < -48 || sxScreen > CANVAS_SIZE + 48) continue;

      if (e.dead) {
        ctx.globalAlpha = Math.max(0, e.koTimer / 0.32);
      }

      const frame = e.hitFlash > 0 ? 3 : e.telegraphTimer > 0 ? 2 : Math.floor(e.animTime * 6) % 3;
      const cellSize = e.kind === 'boss' ? 48 : 32;
      const sheet = e.kind === 'boss' ? this.sprites.bosses : this.sprites.enemiesKeroco;
      const srcY = e.spriteRow * cellSize;

      ctx.save();
      ctx.translate(sxScreen, syScreen);
      if (e.facing > 0) ctx.scale(-1, 1);
      ctx.drawImage(
        sheet,
        frame * cellSize,
        srcY,
        cellSize,
        cellSize,
        -cellSize / 2,
        -cellSize + 4,
        cellSize,
        cellSize,
      );
      ctx.restore();
      ctx.globalAlpha = 1;

      // Enemy Level Label above head ("keterangan level musuh")
      if (!e.dead) {
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        const lvlText = `Lv.${e.enemyLevel}`;
        const ly = syScreen - e.h - 4;
        ctx.fillStyle = '#0f111a';
        ctx.fillText(lvlText, sxScreen + 1, ly + 1);
        ctx.fillStyle = e.kind === 'boss' ? '#fde047' : '#e2e8f0';
        ctx.fillText(lvlText, sxScreen, ly);

        if (e.telegraphTimer > 0) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(sxScreen - 1, ly - 10, 2, 4);
          ctx.fillRect(sxScreen - 1, ly - 5, 2, 2);
        }
      }
    }

    // 7. Hero Sprite PNG (18 animations incl. hangClimb)
    const spec = HERO_ANIMS[this.animName];
    const rawFrame = Math.floor(this.animTime * spec.fps);
    const frameIdx = spec.loop ? rawFrame % spec.frames : Math.min(spec.frames - 1, rawFrame);

    const drawHx = Math.round(this.hx - camI);
    const drawHy = Math.round(this.hy);

    if (!(this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0)) {
      ctx.save();
      ctx.translate(drawHx, drawHy);
      ctx.scale(this.hFacing * this.squashX, this.squashY);
      ctx.drawImage(this.sprites.hero, frameIdx * 32, spec.row * 32, 32, 32, -16, -28, 32, 32);
      ctx.restore();
    }

    // Breath O2 Bar when submerged in water
    if (this.waterSubmergedTimer > 0.15 && !this.isDead) {
      const o2Ratio = Math.max(0, 1 - this.waterSubmergedTimer / 4.0);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(drawHx - 9, drawHy - 31, 18, 4);
      ctx.fillStyle = o2Ratio > 0.35 ? '#38bdf8' : '#ef4444';
      ctx.fillRect(drawHx - 8, drawHy - 30, Math.round(16 * o2Ratio), 2);
    }

    // 8. Sword Slash Arc PNG
    if (this.slash.active) {
      const swordDef = getSwordDef(this.save.equippedSword);
      const slashProgress = this.slash.timer / this.slash.duration;
      const slashFrame = Math.min(2, Math.floor(slashProgress * 3));
      const srcY = 16 + swordDef.spriteIndex * 32;

      ctx.save();
      ctx.translate(drawHx + this.slash.dirX * 10, drawHy - 13 + this.slash.dirY * 10);
      if (this.slash.dirY < 0) ctx.rotate(-Math.PI / 2);
      else if (this.slash.dirY > 0) ctx.rotate(Math.PI / 2);
      else if (this.hFacing < 0) ctx.scale(-1, 1);
      if (this.slash.isHeavy) ctx.scale(1.25, 1.25);
      ctx.drawImage(this.sprites.swords, slashFrame * 32, srcY, 32, 32, -16, -16, 32, 32);
      ctx.restore();
    }

    // 9. Projectiles PNG
    for (const p of this.projectiles) {
      if (!p.active) continue;
      const px = Math.round(p.x - camI) - 8;
      const py = Math.round(p.y) - 8;
      if (p.useGunSheet) {
        ctx.drawImage(this.sprites.guns, p.spriteCol * 16, 16, 16, 16, px, py, 16, 16);
      } else {
        ctx.drawImage(this.sprites.itemsVfx, p.spriteCol * 16, 16, 16, 16, px, py, 16, 16);
      }
    }

    // 10. VFX Sprites PNG
    for (const v of this.vfxList) {
      if (!v.active) continue;
      const f = Math.min(v.frames - 1, Math.floor((v.timer / v.duration) * v.frames));
      ctx.drawImage(
        this.sprites.itemsVfx,
        (v.colStart + f) * 16,
        v.row * 16,
        16,
        16,
        Math.round(v.x - camI) - 8,
        Math.round(v.y) - 8,
        16,
        16,
      );
    }

    // 11. Pooled Particles
    for (const p of this.particles) {
      if (!p.active) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camI), Math.round(p.y), p.size, p.size);
    }

    // 12. Floating Damage / Pickup Numbers
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    for (const f of this.floatingTexts) {
      if (!f.active) continue;
      const fx = Math.round(f.x - camI);
      const fy = Math.round(f.y);
      ctx.fillStyle = '#0f111a';
      ctx.fillText(f.text, fx + 1, fy + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, fx, fy);
    }

    ctx.restore();

    // 13. Compact 16px Top GBC HUD Strip
    this.renderTopGbcHud(ctx);
  }

  private renderTopGbcHud(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#0c101b';
    ctx.fillRect(0, 0, CANVAS_SIZE, HUD_BAR_HEIGHT);
    ctx.fillStyle = '#25314d';
    ctx.fillRect(0, HUD_BAR_HEIGHT - 1, CANVAS_SIZE, 1);

    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f87171';
    ctx.fillText('HP', 4, 10);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(15, 4, 34, 7);
    const hpRatio = Math.max(0, Math.min(1, this.hp / Math.max(1, this.maxHp)));
    ctx.fillStyle = hpRatio > 0.3 ? '#22c55e' : '#ef4444';
    ctx.fillRect(16, 5, Math.round(32 * hpRatio), 5);

    ctx.drawImage(this.sprites.itemsVfx, 0, 0, 16, 16, 51, 1, 13, 13);
    ctx.fillStyle = this.save.ammo > 0 ? '#facc15' : '#ef4444';
    ctx.fillText(`${this.save.ammo}`, 64, 10);

    const swordDef = getSwordDef(this.save.equippedSword);
    const gunDef = getGunDef(this.save.equippedGun ?? 'buster_mk1');
    ctx.drawImage(this.sprites.swords, swordDef.spriteIndex * 16, 0, 16, 16, 80, 1, 13, 13);
    ctx.drawImage(this.sprites.guns, gunDef.spriteIndex * 16, 0, 16, 16, 94, 1, 13, 13);
    ctx.drawImage(this.sprites.itemsVfx, 3 * 16, 0, 16, 16, 108, 1, 13, 13);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`${this.save.hpPotions}`, 121, 10);

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`L${this.save.level}`, 136, 10);

    // Kill gate status + Portal 1/5
    if (this.area.isBossArea) {
      ctx.fillStyle = '#f87171';
      ctx.fillText('BOSS', 162, 10);
    } else {
      const open = this.areaKills >= KILLS_TO_OPEN_EXIT;
      ctx.fillStyle = open ? '#4ade80' : '#facc15';
      ctx.fillText(open ? 'EXIT' : `K${this.areaKills}/5`, 162, 10);
    }

    ctx.fillStyle = '#fde047';
    ctx.fillText(`P${this.areaIndex + 1}/5`, 192, 10);

    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(`S${this.stage.stageNumber}`, 251, 10);

    const boss = this.enemies.find((e) => e.kind === 'boss' && !e.dead);
    if (boss) {
      ctx.fillStyle = 'rgba(12, 16, 27, 0.85)';
      ctx.fillRect(48, 20, 160, 12);
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`${boss.name} Lv.${boss.enemyLevel}`, 128, 26);
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(50, 28, 156, 3);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(50, 28, Math.round(156 * (boss.hp / boss.maxHp)), 3);
    }
  }
}
