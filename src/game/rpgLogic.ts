import {
  ACCESSORIES,
  ARMORS,
  DropKind,
  GUNS,
  GameSettings,
  GunDef,
  GunId,
  MAX_HP_POTIONS,
  QUESTS,
  QuestDef,
  SAVE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  SWORDS,
  SaveState,
  SwordDef,
  SwordId,
} from './types';

export const MAX_LEVEL = 100;
export const MAX_STAGE = 100;
export const BASE_AMMO_CAP = 30;
export const MAX_AMMO_CAP = 100;

export const AMMO_UPGRADE_TIERS = [
  { targetCap: 45, cost: 120 },
  { targetCap: 60, cost: 240 },
  { targetCap: 80, cost: 420 },
  { targetCap: 100, cost: 680 },
] as const;

export function createDefaultSave(): SaveState {
  return {
    version: 2,
    level: 1,
    exp: 0,
    gold: 120,
    rareCrystals: 2,
    weaponMaterials: 2,
    hpPotions: 3,
    manaPotions: 2,
    ammo: BASE_AMMO_CAP,
    maxAmmo: BASE_AMMO_CAP,
    highestUnlockedStage: 1,
    clearedStages: [],
    ownedSwords: ['iron_sword'],
    swordUpgrades: { iron_sword: 0 },
    equippedSword: 'iron_sword',
    ownedGuns: ['buster_mk1'],
    gunUpgrades: { buster_mk1: 0 },
    equippedGun: 'buster_mk1',
    ownedArmors: ['adventurer_vest'],
    equippedArmor: 'adventurer_vest',
    ownedAccessories: [],
    equippedAccessory: null,
    claimedQuests: [],
    stats: {
      enemiesKilled: 0,
      bossesKilled: 0,
      crystalsCollected: 2,
      swordsUpgraded: 0,
      bestScore: 0,
    },
  };
}

export function createDefaultSettings(): GameSettings {
  return {
    muted: false,
    volume: 0.65,
    palette: 'vivid',
    gameSpeed: 1,
    touchMode: 'auto',
  };
}

export function getSwordDef(id: SwordId): SwordDef {
  return SWORDS.find((s) => s.id === id) ?? SWORDS[0];
}

export function getGunDef(id: GunId): GunDef {
  return GUNS.find((g) => g.id === id) ?? GUNS[0];
}

export function getExpForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.round(45 + level * 28 + Math.pow(level, 1.45) * 6);
}

export interface HeroComputedStats {
  level: number;
  maxHp: number;
  maxMp: number;
  atk: number;
  gunAtk: number;
  def: number;
  critRate: number;
  speedMult: number;
  effectiveMaxAmmo: number;
  swordDef: SwordDef;
  swordUpgradeLevel: number;
  gunDef: GunDef;
  gunUpgradeLevel: number;
}

export function computeHeroStats(save: SaveState): HeroComputedStats {
  const swordDef = getSwordDef(save.equippedSword);
  const swordUpgradeLevel = save.swordUpgrades[save.equippedSword] ?? 0;
  const gunDef = getGunDef(save.equippedGun ?? 'buster_mk1');
  const gunUpgradeLevel = save.gunUpgrades?.[save.equippedGun ?? 'buster_mk1'] ?? 0;
  const armor = ARMORS.find((a) => a.id === save.equippedArmor) ?? ARMORS[0];
  const acc = ACCESSORIES.find((a) => a.id === save.equippedAccessory) ?? null;

  const lvl = Math.max(1, Math.min(MAX_LEVEL, save.level));
  const maxHp = 80 + (lvl - 1) * 12 + armor.hpBonus;
  const maxMp = 40 + (lvl - 1) * 4;
  const swordAtk = swordDef.baseDamage + swordUpgradeLevel * 4;
  const baseHeroAtk = 6 + Math.floor((lvl - 1) * 1.8);
  const atk = baseHeroAtk + swordAtk + (acc?.atkBonus ?? 0);
  const gunBase = gunDef.baseDamage + gunUpgradeLevel * 3;
  const gunAtk = Math.round(gunBase + (lvl - 1) * 1.6 + (acc?.atkBonus ?? 0) * 0.6);
  const def = 2 + Math.floor((lvl - 1) * 0.9) + armor.defBonus;
  const critRate = Math.min(0.75, 0.06 + swordDef.critBonus + (acc?.critBonus ?? 0) + lvl * 0.0015);
  const speedMult = 1 + (acc?.speedBonus ?? 0);
  const effectiveMaxAmmo = Math.min(MAX_AMMO_CAP + 10, save.maxAmmo + (acc?.ammoBonus ?? 0));

  return {
    level: lvl,
    maxHp,
    maxMp,
    atk,
    gunAtk,
    def,
    critRate,
    speedMult,
    effectiveMaxAmmo,
    swordDef,
    swordUpgradeLevel,
    gunDef,
    gunUpgradeLevel,
  };
}

export function addExpAndLevelUp(save: SaveState, amount: number): { next: SaveState; levelsGained: number } {
  let next: SaveState = { ...save, exp: save.exp + Math.max(0, Math.round(amount)) };
  let levelsGained = 0;
  while (next.level < MAX_LEVEL) {
    const needed = getExpForNextLevel(next.level);
    if (next.exp >= needed) {
      next = {
        ...next,
        exp: next.exp - needed,
        level: next.level + 1,
      };
      levelsGained += 1;
    } else {
      break;
    }
  }
  if (next.level >= MAX_LEVEL) {
    next = { ...next, level: MAX_LEVEL, exp: 0 };
  }
  return { next, levelsGained };
}

export function calculateAttackDamage(params: {
  rawAtk: number;
  targetDef?: number;
  critRate: number;
  rngValue: number; // 0..1
  multiplier?: number;
  isBossTarget?: boolean;
  swordId?: SwordId;
}): { damage: number; isCrit: boolean } {
  const {
    rawAtk,
    targetDef = 0,
    critRate,
    rngValue,
    multiplier = 1,
    isBossTarget = false,
    swordId,
  } = params;
  let bonus = 1;
  if (isBossTarget && swordId === 'dragon_slayer') bonus = 1.5;
  else if (isBossTarget && swordId === 'holy_sword') bonus = 1.35;

  const isCrit = rngValue < critRate;
  const critMult = isCrit ? 1.75 : 1;
  const mitigated = Math.max(2, rawAtk * multiplier * bonus - targetDef * 0.45);
  return {
    damage: Math.max(1, Math.round(mitigated * critMult)),
    isCrit,
  };
}

export function consumeAmmo(currentAmmo: number, amount = 1): { ok: boolean; nextAmmo: number } {
  if (currentAmmo < amount) {
    return { ok: false, nextAmmo: currentAmmo };
  }
  return { ok: true, nextAmmo: currentAmmo - amount };
}

export function refillAmmo(currentAmmo: number, maxAmmo: number, amount: number): number {
  return Math.min(maxAmmo, Math.max(0, currentAmmo + amount));
}

export function addHpPotion(currentPotions: number, add = 1): { nextPotions: number; overflow: number } {
  const total = currentPotions + add;
  if (total <= MAX_HP_POTIONS) {
    return { nextPotions: total, overflow: 0 };
  }
  return { nextPotions: MAX_HP_POTIONS, overflow: total - MAX_HP_POTIONS };
}

/**
 * Exact drop rate distribution:
 * - 10% Rare Crystal [0.00 .. 0.10)
 * - 10% Weapon Material [0.10 .. 0.20)
 * - 10% HP Potion [0.20 .. 0.30)
 * - 10% Ammo (Small/Med/Large) [0.30 .. 0.40)
 * - 15% Mana Potion [0.40 .. 0.55)
 * - 45% Gold [0.55 .. 1.00)
 */
export function rollEnemyDropKind(rngDrop: number, rngSub: number): DropKind {
  if (rngDrop < 0.10) return 'rare_crystal';
  if (rngDrop < 0.20) return 'weapon_material';
  if (rngDrop < 0.30) return 'hp_potion';
  if (rngDrop < 0.40) {
    if (rngSub < 0.55) return 'ammo_small';
    if (rngSub < 0.85) return 'ammo_medium';
    return 'ammo_large';
  }
  if (rngDrop < 0.55) return 'mana_potion';
  return 'gold';
}

export function getNextAmmoUpgradeTier(currentCap: number): { targetCap: number; cost: number } | null {
  return AMMO_UPGRADE_TIERS.find((t) => t.targetCap > currentCap) ?? null;
}

export function upgradeAmmoCapacity(save: SaveState): { ok: boolean; next: SaveState; message: string } {
  const tier = getNextAmmoUpgradeTier(save.maxAmmo);
  if (!tier) return { ok: false, next: save, message: 'Ammo already at Max (100)!' };
  if (save.gold < tier.cost) return { ok: false, next: save, message: `Need ${tier.cost}G` };
  return {
    ok: true,
    next: {
      ...save,
      gold: save.gold - tier.cost,
      maxAmmo: tier.targetCap,
      ammo: tier.targetCap,
    },
    message: `Max Ammo -> ${tier.targetCap}!`,
  };
}

export function getSwordUpgradeCost(currentUpgrade: number): { gold: number; materials: number; crystals: number } {
  const lvl = currentUpgrade + 1;
  return {
    gold: 60 + lvl * 55,
    materials: 1 + Math.floor(lvl / 2),
    crystals: lvl >= 4 ? Math.floor((lvl - 2) / 2) : 0,
  };
}

export function upgradeSword(save: SaveState, swordId: SwordId): { ok: boolean; next: SaveState; message: string } {
  if (!save.ownedSwords.includes(swordId)) {
    return { ok: false, next: save, message: 'Sword not owned' };
  }
  const cur = save.swordUpgrades[swordId] ?? 0;
  if (cur >= 10) return { ok: false, next: save, message: 'Max +10 reached' };
  const cost = getSwordUpgradeCost(cur);
  if (save.gold < cost.gold || save.weaponMaterials < cost.materials || save.rareCrystals < cost.crystals) {
    return { ok: false, next: save, message: 'Not enough Gold/Materials' };
  }
  return {
    ok: true,
    next: {
      ...save,
      gold: save.gold - cost.gold,
      weaponMaterials: save.weaponMaterials - cost.materials,
      rareCrystals: save.rareCrystals - cost.crystals,
      swordUpgrades: { ...save.swordUpgrades, [swordId]: cur + 1 },
      stats: { ...save.stats, swordsUpgraded: save.stats.swordsUpgraded + 1 },
    },
    message: `${getSwordDef(swordId).name} +${cur + 1}!`,
  };
}

export function craftSword(save: SaveState, swordId: SwordId): { ok: boolean; next: SaveState; message: string } {
  if (save.ownedSwords.includes(swordId)) {
    return { ok: false, next: save, message: 'Already owned' };
  }
  const def = getSwordDef(swordId);
  if (!def.craftCost) return { ok: false, next: save, message: 'Cannot be forged' };
  const { gold, materials, crystals } = def.craftCost;
  if (save.gold < gold || save.weaponMaterials < materials || save.rareCrystals < crystals) {
    return { ok: false, next: save, message: `Need ${gold}G, ${materials}MT, ${crystals}CR` };
  }
  return {
    ok: true,
    next: {
      ...save,
      gold: save.gold - gold,
      weaponMaterials: save.weaponMaterials - materials,
      rareCrystals: save.rareCrystals - crystals,
      ownedSwords: [...save.ownedSwords, swordId],
      swordUpgrades: { ...save.swordUpgrades, [swordId]: 0 },
      equippedSword: swordId,
    },
    message: `Forged ${def.name}!`,
  };
}

export function upgradeGun(save: SaveState, gunId: GunId): { ok: boolean; next: SaveState; message: string } {
  if (!save.ownedGuns.includes(gunId)) {
    return { ok: false, next: save, message: 'Gun not owned' };
  }
  const cur = save.gunUpgrades[gunId] ?? 0;
  if (cur >= 10) return { ok: false, next: save, message: 'Max +10 reached' };
  const cost = getSwordUpgradeCost(cur);
  if (save.gold < cost.gold || save.weaponMaterials < cost.materials || save.rareCrystals < cost.crystals) {
    return { ok: false, next: save, message: 'Not enough Gold/Materials' };
  }
  return {
    ok: true,
    next: {
      ...save,
      gold: save.gold - cost.gold,
      weaponMaterials: save.weaponMaterials - cost.materials,
      rareCrystals: save.rareCrystals - cost.crystals,
      gunUpgrades: { ...save.gunUpgrades, [gunId]: cur + 1 },
      stats: { ...save.stats, swordsUpgraded: save.stats.swordsUpgraded + 1 },
    },
    message: `${getGunDef(gunId).name} +${cur + 1}!`,
  };
}

export function craftGun(save: SaveState, gunId: GunId): { ok: boolean; next: SaveState; message: string } {
  if (save.ownedGuns.includes(gunId)) {
    return { ok: false, next: save, message: 'Already owned' };
  }
  const def = getGunDef(gunId);
  if (!def.craftCost) return { ok: false, next: save, message: 'Cannot be forged' };
  const { gold, materials, crystals } = def.craftCost;
  if (save.gold < gold || save.weaponMaterials < materials || save.rareCrystals < crystals) {
    return { ok: false, next: save, message: `Need ${gold}G, ${materials}MT, ${crystals}CR` };
  }
  return {
    ok: true,
    next: {
      ...save,
      gold: save.gold - gold,
      weaponMaterials: save.weaponMaterials - materials,
      rareCrystals: save.rareCrystals - crystals,
      ownedGuns: [...save.ownedGuns, gunId],
      gunUpgrades: { ...save.gunUpgrades, [gunId]: 0 },
      equippedGun: gunId,
    },
    message: `Forged ${def.name}!`,
  };
}

export function buyShopItem(
  save: SaveState,
  item: 'hp_potion' | 'mana_potion' | 'ammo_pack' | 'ammo_upgrade' | { swordId: SwordId } | { armorId: string } | { accessoryId: string },
): { ok: boolean; next: SaveState; message: string } {
  const stats = computeHeroStats(save);
  if (item === 'hp_potion') {
    if (save.hpPotions >= MAX_HP_POTIONS) {
      return { ok: false, next: save, message: `HP Potion Max (${MAX_HP_POTIONS})!` };
    }
    const cost = 40;
    if (save.gold < cost) return { ok: false, next: save, message: 'Need 40G' };
    return {
      ok: true,
      next: { ...save, gold: save.gold - cost, hpPotions: Math.min(MAX_HP_POTIONS, save.hpPotions + 1) },
      message: 'Bought HP Potion',
    };
  }
  if (item === 'mana_potion') {
    const cost = 45;
    if (save.gold < cost) return { ok: false, next: save, message: 'Need 45G' };
    return { ok: true, next: { ...save, gold: save.gold - cost, manaPotions: save.manaPotions + 1 }, message: 'Bought Mana Potion' };
  }
  if (item === 'ammo_pack') {
    const cost = 35;
    if (save.gold < cost) return { ok: false, next: save, message: 'Need 35G' };
    if (save.ammo >= stats.effectiveMaxAmmo) return { ok: false, next: save, message: 'Ammo already full' };
    return {
      ok: true,
      next: {
        ...save,
        gold: save.gold - cost,
        ammo: refillAmmo(save.ammo, stats.effectiveMaxAmmo, 20),
      },
      message: '+20 Ammo!',
    };
  }
  if (item === 'ammo_upgrade') {
    return upgradeAmmoCapacity(save);
  }
  if ('swordId' in item) {
    const def = getSwordDef(item.swordId);
    if (!def.shopPrice) return { ok: false, next: save, message: 'Not sold here' };
    if (save.ownedSwords.includes(item.swordId)) return { ok: false, next: save, message: 'Already owned' };
    if (save.gold < def.shopPrice) return { ok: false, next: save, message: `Need ${def.shopPrice}G` };
    return {
      ok: true,
      next: {
        ...save,
        gold: save.gold - def.shopPrice,
        ownedSwords: [...save.ownedSwords, item.swordId],
        swordUpgrades: { ...save.swordUpgrades, [item.swordId]: 0 },
        equippedSword: item.swordId,
      },
      message: `Bought ${def.name}!`,
    };
  }
  if ('armorId' in item) {
    const armor = ARMORS.find((a) => a.id === item.armorId);
    if (!armor) return { ok: false, next: save, message: 'Unknown armor' };
    if (save.ownedArmors.includes(armor.id)) return { ok: false, next: save, message: 'Already owned' };
    if (save.gold < armor.price) return { ok: false, next: save, message: `Need ${armor.price}G` };
    return {
      ok: true,
      next: {
        ...save,
        gold: save.gold - armor.price,
        ownedArmors: [...save.ownedArmors, armor.id],
        equippedArmor: armor.id,
      },
      message: `Equipped ${armor.name}!`,
    };
  }
  if ('accessoryId' in item) {
    const acc = ACCESSORIES.find((a) => a.id === item.accessoryId);
    if (!acc) return { ok: false, next: save, message: 'Unknown accessory' };
    if (save.ownedAccessories.includes(acc.id)) return { ok: false, next: save, message: 'Already owned' };
    if (save.gold < acc.price) return { ok: false, next: save, message: `Need ${acc.price}G` };
    return {
      ok: true,
      next: {
        ...save,
        gold: save.gold - acc.price,
        ownedAccessories: [...save.ownedAccessories, acc.id],
        equippedAccessory: acc.id,
      },
      message: `Equipped ${acc.name}!`,
    };
  }
  return { ok: false, next: save, message: 'Invalid item' };
}

export function getQuestProgress(save: SaveState, quest: QuestDef): number {
  switch (quest.targetType) {
    case 'clear_stage':
      return save.clearedStages.includes(quest.targetCount) ? quest.targetCount : Math.min(quest.targetCount - 1, save.clearedStages.length);
    case 'kill_enemies':
      return Math.min(quest.targetCount, save.stats.enemiesKilled);
    case 'collect_crystals':
      return Math.min(quest.targetCount, save.stats.crystalsCollected);
    case 'kill_bosses':
      return Math.min(quest.targetCount, save.stats.bossesKilled);
    case 'upgrade_sword':
      return Math.min(quest.targetCount, save.stats.swordsUpgraded);
  }
}

export function isQuestComplete(save: SaveState, quest: QuestDef): boolean {
  if (quest.targetType === 'clear_stage') {
    return save.clearedStages.includes(quest.targetCount);
  }
  return getQuestProgress(save, quest) >= quest.targetCount;
}

export function claimQuestReward(save: SaveState, questId: string): { ok: boolean; next: SaveState; message: string } {
  const quest = QUESTS.find((q) => q.id === questId);
  if (!quest) return { ok: false, next: save, message: 'Quest not found' };
  if (save.claimedQuests.includes(questId)) return { ok: false, next: save, message: 'Already claimed' };
  if (!isQuestComplete(save, quest)) return { ok: false, next: save, message: 'Quest incomplete' };

  const ownedSwords =
    quest.rewardSwordId && !save.ownedSwords.includes(quest.rewardSwordId)
      ? [...save.ownedSwords, quest.rewardSwordId]
      : save.ownedSwords;
  const swordUpgrades =
    quest.rewardSwordId && save.swordUpgrades[quest.rewardSwordId] === undefined
      ? { ...save.swordUpgrades, [quest.rewardSwordId]: 0 }
      : save.swordUpgrades;

  const withLoot: SaveState = {
    ...save,
    gold: save.gold + quest.rewardGold,
    rareCrystals: save.rareCrystals + quest.rewardCrystals,
    weaponMaterials: save.weaponMaterials + quest.rewardMaterials,
    ownedSwords,
    swordUpgrades,
    claimedQuests: [...save.claimedQuests, questId],
  };
  const { next } = addExpAndLevelUp(withLoot, quest.rewardExp);
  return {
    ok: true,
    next,
    message: quest.rewardSwordId
      ? `Claimed + ${getSwordDef(quest.rewardSwordId).name}!`
      : `Claimed ${quest.rewardGold}G!`,
  };
}

export function loadSaveState(): SaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveState;
    if (!parsed || typeof parsed.level !== 'number') return null;
    const def = createDefaultSave();
    return {
      ...def,
      ...parsed,
      hpPotions: Math.min(MAX_HP_POTIONS, parsed.hpPotions ?? def.hpPotions),
      ownedGuns: parsed.ownedGuns?.length ? parsed.ownedGuns : def.ownedGuns,
      gunUpgrades: parsed.gunUpgrades ?? def.gunUpgrades,
      equippedGun: parsed.equippedGun ?? def.equippedGun,
    };
  } catch {
    return null;
  }
}

export function persistSaveState(save: SaveState): void {
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // ignore quota errors
  }
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    return { ...createDefaultSettings(), ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return createDefaultSettings();
  }
}

export function persistSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
