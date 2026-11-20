export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';
export type PlaySubMode = 'hub' | 'stage';
export type HubTab = 'world' | 'quest' | 'shop' | 'blacksmith' | 'equipment';
export type ScreenPalette = 'vivid' | 'pocket' | 'lcd';
export type TouchMode = 'auto' | 'always' | 'hidden';

export type SwordId =
  | 'iron_sword'
  | 'crystal_sword'
  | 'flame_sword'
  | 'thunder_sword'
  | 'dark_sword'
  | 'holy_sword'
  | 'dragon_slayer'
  | 'great_sword'
  | 'shadow_katana'
  | 'excalibur';

export type GunId =
  | 'buster_mk1'
  | 'pulse_pistol'
  | 'iron_shotgun'
  | 'crystal_carbine'
  | 'dragon_shotgun'
  | 'volt_rifle'
  | 'inferno_cannon'
  | 'shadow_railgun'
  | 'hyper_buster'
  | 'omega_infinite';

export type ElementType = 'none' | 'ice' | 'fire' | 'thunder' | 'dark' | 'holy';

export interface SwordDef {
  id: SwordId;
  spriteIndex: number;
  name: string;
  baseDamage: number;
  speedMult: number; // >1 faster, <1 slower
  critBonus: number; // 0..1
  rangeBonus: number; // pixels
  element: ElementType;
  effectLabel: string;
  sourceHint: string;
  shopPrice?: number;
  craftCost?: { gold: number; materials: number; crystals: number };
}

export interface GunDef {
  id: GunId;
  spriteIndex: number;
  name: string;
  baseDamage: number;
  pellets: number; // 1 for rifle/blaster, 3 for shotgun
  spreadAngleDeg: number;
  rangePx: number | null; // null = Infinite range
  projectileSpeed: number;
  cooldownSec: number;
  pierce: boolean;
  element: ElementType;
  isShotgun?: boolean;
  effectLabel: string;
  craftCost?: { gold: number; materials: number; crystals: number };
}

export interface ArmorDef {
  id: string;
  name: string;
  defBonus: number;
  hpBonus: number;
  price: number;
}

export interface AccessoryDef {
  id: string;
  name: string;
  atkBonus: number;
  critBonus: number;
  ammoBonus: number;
  speedBonus: number;
  price: number;
  effectText: string;
}

export interface QuestDef {
  id: string;
  title: string;
  type: 'main' | 'side';
  description: string;
  targetType: 'clear_stage' | 'kill_enemies' | 'collect_crystals' | 'kill_bosses' | 'upgrade_sword';
  targetCount: number;
  rewardGold: number;
  rewardExp: number;
  rewardCrystals: number;
  rewardMaterials: number;
  rewardSwordId?: SwordId;
}

export interface GameSettings {
  muted: boolean;
  volume: number; // 0..1
  palette: ScreenPalette;
  gameSpeed: 0.85 | 1 | 1.2;
  touchMode: TouchMode;
}

export interface SaveState {
  version: number;
  level: number; // 1..100
  exp: number;
  gold: number;
  rareCrystals: number;
  weaponMaterials: number;
  hpPotions: number; // max 10
  manaPotions: number;
  ammo: number;
  maxAmmo: number; // starts 30, upgrades to 100
  highestUnlockedStage: number; // 1..100
  clearedStages: number[];
  ownedSwords: SwordId[];
  swordUpgrades: Partial<Record<SwordId, number>>; // +0..+10
  equippedSword: SwordId;
  ownedGuns: GunId[];
  gunUpgrades: Partial<Record<GunId, number>>; // +0..+10
  equippedGun: GunId;
  ownedArmors: string[];
  equippedArmor: string;
  ownedAccessories: string[];
  equippedAccessory: string | null;
  claimedQuests: string[];
  stats: {
    enemiesKilled: number;
    bossesKilled: number;
    crystalsCollected: number;
    swordsUpgraded: number;
    bestScore: number;
  };
}

export interface RunSummary {
  outcome: 'victory' | 'defeat';
  stage: number;
  clearTimeSec: number;
  score: number;
  bestScore: number;
  damageTaken: number;
  enemiesDefeated: number;
  expGained: number;
  goldGained: number;
  bossHpRemainingPct?: number;
  unlockedNextStage?: number;
  foundSword?: SwordId;
}

export const WORLD_NAMES = [
  'Emerald Ruins',
  'Crystal Cavern',
  'Ember Foundry',
  'Storm Citadel',
  'Abyssal Spire',
] as const;

export const MAX_HP_POTIONS = 10;

export const SWORDS: SwordDef[] = [
  {
    id: 'iron_sword',
    spriteIndex: 0,
    name: 'Iron Sword',
    baseDamage: 14,
    speedMult: 1.0,
    critBonus: 0.05,
    rangeBonus: 0,
    element: 'none',
    effectLabel: 'Balanced Starter Blade',
    sourceHint: 'Starter Weapon',
  },
  {
    id: 'crystal_sword',
    spriteIndex: 1,
    name: 'Crystal Sword',
    baseDamage: 20,
    speedMult: 1.05,
    critBonus: 0.08,
    rangeBonus: 2,
    element: 'ice',
    effectLabel: 'Frost Slow on Hit',
    sourceHint: 'Shop / Blacksmith',
    shopPrice: 220,
    craftCost: { gold: 140, materials: 3, crystals: 20 },
  },
  {
    id: 'flame_sword',
    spriteIndex: 2,
    name: 'Flame Sword',
    baseDamage: 24,
    speedMult: 1.0,
    critBonus: 0.08,
    rangeBonus: 2,
    element: 'fire',
    effectLabel: 'Burn DoT Damage',
    sourceHint: 'Shop / Blacksmith',
    shopPrice: 360,
    craftCost: { gold: 240, materials: 4, crystals: 35 },
  },
  {
    id: 'thunder_sword',
    spriteIndex: 3,
    name: 'Thunder Sword',
    baseDamage: 28,
    speedMult: 1.15,
    critBonus: 0.12,
    rangeBonus: 2,
    element: 'thunder',
    effectLabel: 'Shock Stun Strike',
    sourceHint: 'Blacksmith / Hidden Chest (Stage 12)',
    craftCost: { gold: 380, materials: 6, crystals: 55 },
  },
  {
    id: 'dark_sword',
    spriteIndex: 4,
    name: 'Dark Sword',
    baseDamage: 33,
    speedMult: 1.05,
    critBonus: 0.14,
    rangeBonus: 3,
    element: 'dark',
    effectLabel: 'Lifesteal +4 HP on Kill',
    sourceHint: 'Blacksmith / Boss Drop (Stage 25)',
    craftCost: { gold: 520, materials: 8, crystals: 80 },
  },
  {
    id: 'holy_sword',
    spriteIndex: 5,
    name: 'Holy Sword',
    baseDamage: 38,
    speedMult: 1.1,
    critBonus: 0.15,
    rangeBonus: 4,
    element: 'holy',
    effectLabel: '+35% vs Boss & Dark',
    sourceHint: 'Quest Reward / Shop',
    shopPrice: 820,
  },
  {
    id: 'dragon_slayer',
    spriteIndex: 6,
    name: 'Dragon Slayer',
    baseDamage: 46,
    speedMult: 0.9,
    critBonus: 0.18,
    rangeBonus: 7,
    element: 'fire',
    effectLabel: '+50% Boss Buster',
    sourceHint: 'Blacksmith / Boss Drop (Stage 40)',
    craftCost: { gold: 900, materials: 12, crystals: 120 },
  },
  {
    id: 'great_sword',
    spriteIndex: 7,
    name: 'Great Sword',
    baseDamage: 52,
    speedMult: 0.82,
    critBonus: 0.14,
    rangeBonus: 9,
    element: 'none',
    effectLabel: 'Heavy Knockback Arc',
    sourceHint: 'Shop / Hidden Chest (Stage 32)',
    shopPrice: 1250,
  },
  {
    id: 'shadow_katana',
    spriteIndex: 8,
    name: 'Shadow Katana',
    baseDamage: 44,
    speedMult: 1.45,
    critBonus: 0.30,
    rangeBonus: 4,
    element: 'dark',
    effectLabel: 'Hyper Slash & 30% Crit',
    sourceHint: 'Blacksmith / Boss Drop (Stage 60)',
    craftCost: { gold: 1450, materials: 15, crystals: 160 },
  },
  {
    id: 'excalibur',
    spriteIndex: 9,
    name: 'Excalibur',
    baseDamage: 68,
    speedMult: 1.25,
    critBonus: 0.28,
    rangeBonus: 10,
    element: 'holy',
    effectLabel: 'Fires Radiant Sword Wave',
    sourceHint: 'Blacksmith Legend / Stage 80 Boss',
    craftCost: { gold: 2400, materials: 24, crystals: 200 },
  },
];

export const GUNS: GunDef[] = [
  {
    id: 'buster_mk1',
    spriteIndex: 0,
    name: 'Buster MK-I',
    baseDamage: 10,
    pellets: 1,
    spreadAngleDeg: 0,
    rangePx: 115,
    projectileSpeed: 225,
    cooldownSec: 0.18,
    pierce: false,
    element: 'none',
    effectLabel: 'Short-Mid Starter Gun (115px)',
  },
  {
    id: 'pulse_pistol',
    spriteIndex: 1,
    name: 'Pulse Pistol',
    baseDamage: 14,
    pellets: 1,
    spreadAngleDeg: 0,
    rangePx: 145,
    projectileSpeed: 245,
    cooldownSec: 0.15,
    pierce: false,
    element: 'none',
    effectLabel: 'Fast Sidearm (145px)',
    craftCost: { gold: 150, materials: 3, crystals: 20 },
  },
  {
    id: 'iron_shotgun',
    spriteIndex: 2,
    name: 'Iron Shotgun',
    baseDamage: 11,
    pellets: 3,
    spreadAngleDeg: 14,
    rangePx: 54,
    projectileSpeed: 250,
    cooldownSec: 0.28,
    pierce: false,
    element: 'none',
    isShotgun: true,
    effectLabel: 'Shotgun 3-Pellet · Very Short (54px)',
    craftCost: { gold: 260, materials: 5, crystals: 35 },
  },
  {
    id: 'crystal_carbine',
    spriteIndex: 3,
    name: 'Crystal Carbine',
    baseDamage: 19,
    pellets: 1,
    spreadAngleDeg: 0,
    rangePx: 185,
    projectileSpeed: 260,
    cooldownSec: 0.17,
    pierce: false,
    element: 'ice',
    effectLabel: 'Frost Shot · Mid Range (185px)',
    craftCost: { gold: 380, materials: 6, crystals: 55 },
  },
  {
    id: 'dragon_shotgun',
    spriteIndex: 4,
    name: 'Dragon Shotgun',
    baseDamage: 16,
    pellets: 3,
    spreadAngleDeg: 16,
    rangePx: 62,
    projectileSpeed: 265,
    cooldownSec: 0.27,
    pierce: false,
    element: 'fire',
    isShotgun: true,
    effectLabel: 'Fire 3-Pellet · Very Short (62px)',
    craftCost: { gold: 520, materials: 8, crystals: 75 },
  },
  {
    id: 'volt_rifle',
    spriteIndex: 5,
    name: 'Volt Rifle',
    baseDamage: 25,
    pellets: 1,
    spreadAngleDeg: 0,
    rangePx: 235,
    projectileSpeed: 280,
    cooldownSec: 0.17,
    pierce: false,
    element: 'thunder',
    effectLabel: 'Shock Stun · Long Range (235px)',
    craftCost: { gold: 700, materials: 10, crystals: 95 },
  },
  {
    id: 'inferno_cannon',
    spriteIndex: 6,
    name: 'Inferno Cannon',
    baseDamage: 32,
    pellets: 1,
    spreadAngleDeg: 0,
    rangePx: 290,
    projectileSpeed: 270,
    cooldownSec: 0.22,
    pierce: false,
    element: 'fire',
    effectLabel: 'Burn Blast · Long Range (290px)',
    craftCost: { gold: 920, materials: 12, crystals: 120 },
  },
  {
    id: 'shadow_railgun',
    spriteIndex: 7,
    name: 'Shadow Railgun',
    baseDamage: 38,
    pellets: 1,
    spreadAngleDeg: 0,
    rangePx: 420,
    projectileSpeed: 330,
    cooldownSec: 0.21,
    pierce: true,
    element: 'dark',
    effectLabel: 'Piercing Bolt · Ultra Range (420px)',
    craftCost: { gold: 1200, materials: 15, crystals: 150 },
  },
  {
    id: 'hyper_buster',
    spriteIndex: 8,
    name: 'Hyper Buster',
    baseDamage: 44,
    pellets: 1,
    spreadAngleDeg: 0,
    rangePx: null,
    projectileSpeed: 340,
    cooldownSec: 0.13,
    pierce: false,
    element: 'none',
    effectLabel: 'Rapid Fire · Infinite Range',
    craftCost: { gold: 1600, materials: 19, crystals: 175 },
  },
  {
    id: 'omega_infinite',
    spriteIndex: 9,
    name: 'Omega Infinite',
    baseDamage: 56,
    pellets: 1,
    spreadAngleDeg: 0,
    rangePx: null,
    projectileSpeed: 370,
    cooldownSec: 0.15,
    pierce: true,
    element: 'holy',
    effectLabel: 'Piercing Beam · Infinite Range',
    craftCost: { gold: 2400, materials: 24, crystals: 200 },
  },
];

export const ARMORS: ArmorDef[] = [
  { id: 'adventurer_vest', name: 'Adventurer Vest', defBonus: 2, hpBonus: 0, price: 0 },
  { id: 'iron_mail', name: 'Iron Mail', defBonus: 6, hpBonus: 25, price: 180 },
  { id: 'crystal_plate', name: 'Crystal Plate', defBonus: 12, hpBonus: 60, price: 460 },
  { id: 'dragon_scale', name: 'Dragon Scale', defBonus: 20, hpBonus: 120, price: 950 },
  { id: 'aegis_armor', name: 'Aegis Armor', defBonus: 32, hpBonus: 220, price: 1850 },
];

export const ACCESSORIES: AccessoryDef[] = [
  { id: 'ammo_belt', name: 'Ammo Belt', atkBonus: 2, critBonus: 0, ammoBonus: 10, speedBonus: 0, price: 160, effectText: '+10 Max Ammo, +2 ATK' },
  { id: 'crit_ring', name: 'Crit Ring', atkBonus: 3, critBonus: 0.12, ammoBonus: 0, speedBonus: 0, price: 280, effectText: '+12% Crit Rate, +3 ATK' },
  { id: 'power_gauntlet', name: 'Power Gauntlet', atkBonus: 10, critBonus: 0.04, ammoBonus: 0, speedBonus: 0, price: 520, effectText: '+10 ATK, +4% Crit' },
  { id: 'dash_boots', name: 'Wind Boots', atkBonus: 4, critBonus: 0.05, ammoBonus: 0, speedBonus: 0.15, price: 680, effectText: '+15% Move Speed, +4 ATK' },
];

export const QUESTS: QuestDef[] = [
  {
    id: 'q_main_1',
    title: 'First Expedition',
    type: 'main',
    description: 'Clear Stage 1 in Emerald Ruins.',
    targetType: 'clear_stage',
    targetCount: 1,
    rewardGold: 120,
    rewardExp: 60,
    rewardCrystals: 8,
    rewardMaterials: 3,
  },
  {
    id: 'q_side_slayer',
    title: 'Hunter Trial',
    type: 'side',
    description: 'Defeat 15 monsters across any stages.',
    targetType: 'kill_enemies',
    targetCount: 15,
    rewardGold: 180,
    rewardExp: 100,
    rewardCrystals: 12,
    rewardMaterials: 4,
  },
  {
    id: 'q_main_boss1',
    title: 'Ruin Guardian',
    type: 'main',
    description: 'Clear Stage 5 Boss in Emerald Ruins.',
    targetType: 'clear_stage',
    targetCount: 5,
    rewardGold: 320,
    rewardExp: 240,
    rewardCrystals: 20,
    rewardMaterials: 6,
    rewardSwordId: 'holy_sword',
  },
  {
    id: 'q_side_crystal',
    title: 'Crystal Seeker',
    type: 'side',
    description: 'Collect 10 Rare Crystals from chests or drops.',
    targetType: 'collect_crystals',
    targetCount: 10,
    rewardGold: 260,
    rewardExp: 160,
    rewardCrystals: 15,
    rewardMaterials: 5,
  },
  {
    id: 'q_side_forge',
    title: 'Master Smithing',
    type: 'side',
    description: 'Upgrade any weapon at the Blacksmith.',
    targetType: 'upgrade_sword',
    targetCount: 1,
    rewardGold: 200,
    rewardExp: 120,
    rewardCrystals: 10,
    rewardMaterials: 5,
  },
  {
    id: 'q_main_world2',
    title: 'Cavern Breaker',
    type: 'main',
    description: 'Reach & Clear Stage 20 Boss.',
    targetType: 'clear_stage',
    targetCount: 20,
    rewardGold: 700,
    rewardExp: 600,
    rewardCrystals: 35,
    rewardMaterials: 10,
  },
  {
    id: 'q_main_bosses',
    title: 'Dragon Bane',
    type: 'main',
    description: 'Defeat 4 Stage Bosses.',
    targetType: 'kill_bosses',
    targetCount: 4,
    rewardGold: 950,
    rewardExp: 800,
    rewardCrystals: 45,
    rewardMaterials: 14,
    rewardSwordId: 'dragon_slayer',
  },
  {
    id: 'q_main_spire',
    title: 'Abyssal Legend',
    type: 'main',
    description: 'Clear Stage 100 Final Boss.',
    targetType: 'clear_stage',
    targetCount: 100,
    rewardGold: 5000,
    rewardExp: 3000,
    rewardCrystals: 100,
    rewardMaterials: 30,
    rewardSwordId: 'excalibur',
  },
];

export type HeroAnimName =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'fall'
  | 'land'
  | 'sword1'
  | 'sword2'
  | 'sword3'
  | 'shoot'
  | 'shootUp'
  | 'shootDown'
  | 'hurt'
  | 'death'
  | 'climb'
  | 'dash'
  | 'potion';

export type DropKind =
  | 'ammo_small'
  | 'ammo_medium'
  | 'ammo_large'
  | 'hp_potion'
  | 'mana_potion'
  | 'gold'
  | 'rare_crystal'
  | 'weapon_material';

export type EnemyKind = 'slime' | 'bat' | 'trooper' | 'knight' | 'turret' | 'boss';

export const SAVE_STORAGE_KEY = 'gbc_sword_gun_rpg_save_v1';
export const SETTINGS_STORAGE_KEY = 'gbc_sword_gun_rpg_settings_v1';
