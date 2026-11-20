import { BiomeId } from './types';

export type KerocoBehavior =
  | 'slime'
  | 'crawler'
  | 'bat'
  | 'ghost'
  | 'trooper'
  | 'mage'
  | 'knight'
  | 'skeleton'
  | 'turret'
  | 'golem';

export interface KerocoDef {
  id: string;
  name: string;
  spriteRow: number; // 0..39 in enemies_keroco.png
  behavior: KerocoBehavior;
  biomes: BiomeId[];
  hpMult: number;
  atkMult: number;
  speed: number;
}

export type BossPattern = 'firebreath' | 'dash_slam' | 'orb_burst' | 'laser_sweep' | 'final_abyss';

export interface BossDef {
  id: string;
  name: string;
  spriteRow: number; // 0..10 in bosses.png (0..9 = 10 Bosses, 10 = Final Boss)
  pattern: BossPattern;
  hpMult: number;
  atkMult: number;
  speed: number;
  isFinalBoss?: boolean;
}

export const KEROCO_CATALOG: KerocoDef[] = [
  // 0..9: Slimes & Crawlers
  { id: 'moss_slime', name: 'Moss Slime', spriteRow: 0, behavior: 'slime', biomes: ['waterfall', 'graveyard'], hpMult: 0.9, atkMult: 0.9, speed: 30 },
  { id: 'aqua_gel', name: 'Aqua Gel', spriteRow: 1, behavior: 'slime', biomes: ['waterfall', 'snow'], hpMult: 0.95, atkMult: 0.9, speed: 34 },
  { id: 'ember_ooze', name: 'Ember Ooze', spriteRow: 2, behavior: 'slime', biomes: ['volcano', 'desert'], hpMult: 1.0, atkMult: 1.05, speed: 34 },
  { id: 'void_blob', name: 'Void Blob', spriteRow: 3, behavior: 'slime', biomes: ['galaxy', 'graveyard'], hpMult: 1.05, atkMult: 1.0, speed: 36 },
  { id: 'sand_jelly', name: 'Sand Jelly', spriteRow: 4, behavior: 'slime', biomes: ['desert'], hpMult: 0.95, atkMult: 0.95, speed: 35 },
  { id: 'dune_scorp', name: 'Dune Scorpion', spriteRow: 5, behavior: 'crawler', biomes: ['desert'], hpMult: 1.05, atkMult: 1.1, speed: 46 },
  { id: 'mire_spider', name: 'Mire Spider', spriteRow: 6, behavior: 'crawler', biomes: ['waterfall', 'graveyard'], hpMult: 1.0, atkMult: 1.05, speed: 48 },
  { id: 'frost_crab', name: 'Frost Crab', spriteRow: 7, behavior: 'crawler', biomes: ['snow', 'waterfall'], hpMult: 1.15, atkMult: 1.0, speed: 42 },
  { id: 'star_mite', name: 'Star Mite', spriteRow: 8, behavior: 'crawler', biomes: ['galaxy'], hpMult: 1.1, atkMult: 1.15, speed: 52 },
  { id: 'lava_beetle', name: 'Lava Beetle', spriteRow: 9, behavior: 'crawler', biomes: ['volcano'], hpMult: 1.2, atkMult: 1.15, speed: 45 },

  // 10..17: Bats & Ghosts (Aerial)
  { id: 'cyber_bat', name: 'Cyber Bat', spriteRow: 10, behavior: 'bat', biomes: ['galaxy', 'graveyard'], hpMult: 0.85, atkMult: 1.0, speed: 50 },
  { id: 'crimson_bat', name: 'Crimson Bat', spriteRow: 11, behavior: 'bat', biomes: ['volcano', 'graveyard'], hpMult: 0.9, atkMult: 1.1, speed: 54 },
  { id: 'ice_wing', name: 'Ice Wing', spriteRow: 12, behavior: 'bat', biomes: ['snow', 'waterfall'], hpMult: 0.9, atkMult: 1.0, speed: 52 },
  { id: 'jungle_wasp', name: 'Jungle Wasp', spriteRow: 13, behavior: 'bat', biomes: ['waterfall', 'desert'], hpMult: 0.85, atkMult: 1.05, speed: 58 },
  { id: 'tomb_wisp', name: 'Tomb Wisp', spriteRow: 14, behavior: 'ghost', biomes: ['graveyard', 'snow'], hpMult: 0.95, atkMult: 1.05, speed: 44 },
  { id: 'astral_shade', name: 'Astral Shade', spriteRow: 15, behavior: 'ghost', biomes: ['galaxy'], hpMult: 1.05, atkMult: 1.15, speed: 48 },
  { id: 'banshee_orb', name: 'Banshee Orb', spriteRow: 16, behavior: 'ghost', biomes: ['graveyard', 'volcano'], hpMult: 1.0, atkMult: 1.2, speed: 46 },
  { id: 'mist_spirit', name: 'Mist Spirit', spriteRow: 17, behavior: 'ghost', biomes: ['waterfall', 'snow'], hpMult: 1.0, atkMult: 1.05, speed: 45 },

  // 18..25: Troopers & Mages (Ranged)
  { id: 'blaster_bot', name: 'Blaster Bot', spriteRow: 18, behavior: 'trooper', biomes: ['volcano', 'galaxy'], hpMult: 1.1, atkMult: 1.0, speed: 24 },
  { id: 'frost_gunner', name: 'Frost Gunner', spriteRow: 19, behavior: 'trooper', biomes: ['snow'], hpMult: 1.1, atkMult: 1.05, speed: 24 },
  { id: 'scout_ranger', name: 'Scout Ranger', spriteRow: 20, behavior: 'trooper', biomes: ['waterfall'], hpMult: 1.05, atkMult: 1.0, speed: 28 },
  { id: 'desert_sniper', name: 'Desert Sniper', spriteRow: 21, behavior: 'trooper', biomes: ['desert'], hpMult: 1.05, atkMult: 1.15, speed: 24 },
  { id: 'hex_mage', name: 'Hex Mage', spriteRow: 22, behavior: 'mage', biomes: ['graveyard', 'galaxy'], hpMult: 1.0, atkMult: 1.25, speed: 20 },
  { id: 'pyro_warlock', name: 'Pyro Warlock', spriteRow: 23, behavior: 'mage', biomes: ['volcano', 'desert'], hpMult: 1.05, atkMult: 1.3, speed: 20 },
  { id: 'hydro_sage', name: 'Hydro Sage', spriteRow: 24, behavior: 'mage', biomes: ['waterfall', 'snow'], hpMult: 1.05, atkMult: 1.2, speed: 22 },
  { id: 'void_cultist', name: 'Void Cultist', spriteRow: 25, behavior: 'mage', biomes: ['galaxy', 'graveyard'], hpMult: 1.1, atkMult: 1.3, speed: 22 },

  // 26..33: Knights & Skeletons (Melee / Shield)
  { id: 'shield_knight', name: 'Shield Knight', spriteRow: 26, behavior: 'knight', biomes: ['waterfall', 'graveyard'], hpMult: 1.4, atkMult: 1.1, speed: 24 },
  { id: 'magma_guard', name: 'Magma Guard', spriteRow: 27, behavior: 'knight', biomes: ['volcano'], hpMult: 1.5, atkMult: 1.2, speed: 24 },
  { id: 'glacier_paladin', name: 'Glacier Paladin', spriteRow: 28, behavior: 'knight', biomes: ['snow'], hpMult: 1.45, atkMult: 1.15, speed: 24 },
  { id: 'star_sentinel', name: 'Star Sentinel', spriteRow: 29, behavior: 'knight', biomes: ['galaxy'], hpMult: 1.55, atkMult: 1.25, speed: 26 },
  { id: 'bone_swordsman', name: 'Bone Swordsman', spriteRow: 30, behavior: 'skeleton', biomes: ['graveyard'], hpMult: 1.0, atkMult: 1.15, speed: 36 },
  { id: 'mummy_blade', name: 'Mummy Blade', spriteRow: 31, behavior: 'skeleton', biomes: ['desert'], hpMult: 1.15, atkMult: 1.15, speed: 32 },
  { id: 'cursed_reaper', name: 'Cursed Reaper', spriteRow: 32, behavior: 'skeleton', biomes: ['graveyard', 'galaxy'], hpMult: 1.2, atkMult: 1.25, speed: 38 },
  { id: 'swamp_ghoul', name: 'Swamp Ghoul', spriteRow: 33, behavior: 'skeleton', biomes: ['waterfall'], hpMult: 1.1, atkMult: 1.1, speed: 36 },

  // 34..39: Turrets & Golems (Heavy)
  { id: 'auto_turret', name: 'Auto Turret', spriteRow: 34, behavior: 'turret', biomes: ['galaxy', 'waterfall'], hpMult: 1.25, atkMult: 1.05, speed: 0 },
  { id: 'flame_cannon', name: 'Flame Cannon', spriteRow: 35, behavior: 'turret', biomes: ['volcano', 'desert'], hpMult: 1.35, atkMult: 1.2, speed: 0 },
  { id: 'pulse_pod', name: 'Pulse Pod', spriteRow: 36, behavior: 'turret', biomes: ['snow', 'galaxy'], hpMult: 1.3, atkMult: 1.15, speed: 0 },
  { id: 'sand_golem', name: 'Sand Golem', spriteRow: 37, behavior: 'golem', biomes: ['desert', 'volcano'], hpMult: 1.7, atkMult: 1.25, speed: 18 },
  { id: 'ice_colossus', name: 'Ice Colossus', spriteRow: 38, behavior: 'golem', biomes: ['snow', 'waterfall'], hpMult: 1.75, atkMult: 1.25, speed: 18 },
  { id: 'iron_brute', name: 'Iron Brute', spriteRow: 39, behavior: 'golem', biomes: ['graveyard', 'galaxy'], hpMult: 1.85, atkMult: 1.35, speed: 20 },
];

export const BOSS_CATALOG: BossDef[] = [
  { id: 'ruin_dragon', name: 'Ruin Wyvern', spriteRow: 0, pattern: 'firebreath', hpMult: 1.0, atkMult: 1.0, speed: 30 },
  { id: 'frost_titan', name: 'Frost Titan', spriteRow: 1, pattern: 'dash_slam', hpMult: 1.1, atkMult: 1.05, speed: 28 },
  { id: 'sand_sphinx', name: 'Pharaoh Sphinx', spriteRow: 2, pattern: 'orb_burst', hpMult: 1.15, atkMult: 1.1, speed: 32 },
  { id: 'magma_king', name: 'Magma Kaiser', spriteRow: 3, pattern: 'firebreath', hpMult: 1.25, atkMult: 1.15, speed: 30 },
  { id: 'storm_mech', name: 'Storm Valiant', spriteRow: 4, pattern: 'laser_sweep', hpMult: 1.3, atkMult: 1.2, speed: 34 },
  { id: 'crypt_reaper', name: 'Crypt Lich', spriteRow: 5, pattern: 'orb_burst', hpMult: 1.35, atkMult: 1.25, speed: 34 },
  { id: 'hydra_serpent', name: 'Aqua Leviathan', spriteRow: 6, pattern: 'dash_slam', hpMult: 1.4, atkMult: 1.25, speed: 36 },
  { id: 'void_warden', name: 'Void Warden', spriteRow: 7, pattern: 'orb_burst', hpMult: 1.45, atkMult: 1.3, speed: 36 },
  { id: 'solar_golem', name: 'Solar Colossus', spriteRow: 8, pattern: 'dash_slam', hpMult: 1.55, atkMult: 1.35, speed: 30 },
  { id: 'cyber_overlord', name: 'Cyber Sigma', spriteRow: 9, pattern: 'laser_sweep', hpMult: 1.65, atkMult: 1.4, speed: 38 },
];

export const FINAL_BOSS: BossDef = {
  id: 'abyss_emperor',
  name: 'Abyss Emperor',
  spriteRow: 10,
  pattern: 'final_abyss',
  hpMult: 2.3,
  atkMult: 1.65,
  speed: 40,
  isFinalBoss: true,
};

export function getKerocoForBiome(biome: BiomeId, rng: () => number, allowAll = false): KerocoDef {
  const pool = allowAll
    ? KEROCO_CATALOG
    : KEROCO_CATALOG.filter((k) => k.biomes.includes(biome));
  const list = pool.length > 0 ? pool : KEROCO_CATALOG;
  return list[Math.floor(rng() * list.length) % list.length];
}

export function getBossForStage(stage: number): BossDef {
  if (stage >= 100) return FINAL_BOSS;
  const bossIdx = Math.max(0, Math.floor((stage - 1) / 5)) % BOSS_CATALOG.length;
  return BOSS_CATALOG[bossIdx];
}
