import React, { useEffect, useRef, useState } from 'react';
import { gameAudio } from '../game/audio';
import {
  buyShopItem,
  claimQuestReward,
  computeHeroStats,
  craftGun,
  craftSword,
  getExpForNextLevel,
  getGunDef,
  getNextAmmoUpgradeTier,
  getQuestProgress,
  getSwordDef,
  getSwordUpgradeCost,
  isQuestComplete,
  upgradeGun,
  upgradeSword,
} from '../game/rpgLogic';
import { ExtractedUiIcons } from '../game/spriteAtlas';
import {
  ACCESSORIES,
  ARMORS,
  GUNS,
  GunId,
  HubTab,
  MAX_HP_POTIONS,
  QUESTS,
  SWORDS,
  SaveState,
  SwordId,
  WORLD_NAMES,
} from '../game/types';

interface RpgHubProps {
  save: SaveState;
  icons: ExtractedUiIcons | null;
  activeTab: HubTab;
  onChangeTab: (tab: HubTab) => void;
  onUpdateSave: (next: SaveState) => void;
  onEnterStage: (stageNumber: number) => void;
  onReturnTitle: () => void;
}

const HUB_TABS: { id: HubTab; label: string; iconIdx: number }[] = [
  { id: 'world', label: 'World Map', iconIdx: 0 },
  { id: 'quest', label: 'Quest', iconIdx: 1 },
  { id: 'shop', label: 'Shop', iconIdx: 2 },
  { id: 'blacksmith', label: 'Smith', iconIdx: 3 },
  { id: 'equipment', label: 'Equip', iconIdx: 4 },
];

export const RpgHub: React.FC<RpgHubProps> = ({
  save,
  icons,
  activeTab,
  onChangeTab,
  onUpdateSave,
  onEnterStage,
  onReturnTitle,
}) => {
  const [selectedWorld, setSelectedWorld] = useState<number>(
    Math.floor((save.highestUnlockedStage - 1) / 20),
  );
  const [smithFilter, setSmithFilter] = useState<'all' | 'guns' | 'swords'>('all');
  const [toast, setToast] = useState<string | null>(null);
  const hubRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const startBtn = hubRef.current?.querySelector<HTMLButtonElement>('[data-start="true"]');
    startBtn?.focus({ preventScroll: true });
  }, []);

  const stats = computeHeroStats(save);
  const nextExp = getExpForNextLevel(save.level);

  const notify = (msg: string, ok = true) => {
    setToast(msg);
    if (ok) gameAudio.playPickup(false);
    else gameAudio.playNoAmmo();
    window.setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur));
    }, 1800);
  };

  const handleAction = (res: { ok: boolean; next: SaveState; message: string }) => {
    if (res.ok) onUpdateSave(res.next);
    notify(res.message, res.ok);
  };

  const worldStartStage = selectedWorld * 20 + 1;
  const ammoTier = getNextAmmoUpgradeTier(save.maxAmmo);
  const hpPotionFull = save.hpPotions >= MAX_HP_POTIONS;

  return (
    <div
      ref={hubRef}
      data-menu-root="true"
      className="absolute inset-0 z-20 flex flex-col bg-[#0b101d] text-[#f8fafc] select-none overflow-hidden"
    >
      {/* Compact Top RPG Status Bar */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#111827] border-b border-[#26324d] text-[9px] tabular-nums shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-pixel-title text-[#38bdf8]">LV.{save.level}</span>
          <span className="text-[#facc15]">{save.gold}G</span>
          <span className="text-[#22d3ee]">CR:{save.rareCrystals}</span>
          <span className="text-[#cbd5e1]">MT:{save.weaponMaterials}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[#fde047]">
            AMMO {save.ammo}/{stats.effectiveMaxAmmo}
          </span>
          <button
            type="button"
            data-back="true"
            onClick={() => {
              gameAudio.playMenuSelect();
              onReturnTitle();
            }}
            className="px-1.5 py-0.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[8px] text-[#cbd5e1] cursor-pointer"
          >
            TITLE
          </button>
        </div>
      </div>

      {/* 5 PNG-Icon Navigation Tabs */}
      <nav aria-label="RPG Hub Menu" className="grid grid-cols-5 bg-[#0f172a] border-b border-[#26324d] shrink-0">
        {HUB_TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                gameAudio.playMenuMove();
                onChangeTab(t.id);
              }}
              className={`flex flex-col items-center justify-center py-1 px-0.5 border-r last:border-r-0 border-[#1e293b] text-[8px] leading-tight cursor-pointer transition-colors ${
                active
                  ? 'bg-[#1d4ed8] text-white'
                  : 'bg-[#0f172a] text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'
              }`}
            >
              {icons?.menuIcons[t.iconIdx] ? (
                <img
                  src={icons.menuIcons[t.iconIdx]}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 pixelated mb-0.5"
                />
              ) : (
                <span className="w-5 h-5 mb-0.5 bg-[#1e293b]" />
              )}
              <span className="truncate max-w-full whitespace-nowrap">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Feedback */}
      {toast && (
        <div className="bg-[#1e3a8a] border-b border-[#38bdf8] text-[#fef08a] text-[9px] text-center py-0.5 px-2 shrink-0">
          {toast}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto gbc-scroll p-2.5 text-[9px]">
        {activeTab === 'world' && (
          <div className="space-y-2">
            {/* Quick Enter Stage CTA */}
            <div className="flex items-center justify-between gap-2 bg-[#111827] border border-[#26324d] p-2">
              <div>
                <div className="text-[#facc15] font-bold">
                  {WORLD_NAMES[Math.floor((save.highestUnlockedStage - 1) / 20)]}
                </div>
                <div className="text-[#94a3b8] text-[8px] tabular-nums">
                  Cleared: {save.clearedStages.length}/100 · 5 Portals/Stage · Next: {save.highestUnlockedStage}
                </div>
              </div>
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  gameAudio.playMenuSelect();
                  onEnterStage(save.highestUnlockedStage);
                }}
                className="px-2.5 py-1.5 bg-[#16a34a] hover:bg-[#22c55e] border border-[#fde047] font-pixel-title text-[8px] text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                PLAY STG {save.highestUnlockedStage}
              </button>
            </div>

            {/* 5 Worlds Selector */}
            <div className="grid grid-cols-5 gap-1">
              {WORLD_NAMES.map((wName, idx) => (
                <button
                  key={wName}
                  type="button"
                  onClick={() => {
                    gameAudio.playMenuMove();
                    setSelectedWorld(idx);
                  }}
                  className={`py-1 px-1 border text-[8px] cursor-pointer truncate ${
                    selectedWorld === idx
                      ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                      : 'bg-[#111827] border-[#26324d] text-[#94a3b8]'
                  }`}
                >
                  W{idx + 1}
                </button>
              ))}
            </div>

            <div className="text-[#38bdf8] font-bold">
              World {selectedWorld + 1}: {WORLD_NAMES[selectedWorld]} (Stages {worldStartStage}–{worldStartStage + 19})
            </div>

            {/* 20 Stages Grid */}
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 20 }, (_, i) => {
                const stg = worldStartStage + i;
                const unlocked = stg <= save.highestUnlockedStage;
                const cleared = save.clearedStages.includes(stg);
                const isBoss = stg % 5 === 0;
                return (
                  <button
                    key={stg}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      gameAudio.playMenuSelect();
                      onEnterStage(stg);
                    }}
                    className={`py-1.5 px-1 border text-center tabular-nums leading-tight ${
                      !unlocked
                        ? 'bg-[#090d16] border-[#1e293b] text-[#475569] cursor-not-allowed'
                        : cleared
                          ? 'bg-[#14532d] hover:bg-[#166534] border-[#4ade80] text-white cursor-pointer'
                          : isBoss
                            ? 'bg-[#7f1d1d] hover:bg-[#991b1b] border-[#facc15] text-[#fef08a] cursor-pointer'
                            : 'bg-[#1e293b] hover:bg-[#334155] border-[#38bdf8] text-white cursor-pointer'
                    }`}
                  >
                    <div className="font-bold">{stg}</div>
                    <div className="text-[7px]">{isBoss ? 'BOSS' : cleared ? 'CLR' : unlocked ? 'GO' : 'LCK'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'quest' && (
          <div className="space-y-2">
            {QUESTS.map((q) => {
              const prog = getQuestProgress(save, q);
              const complete = isQuestComplete(save, q);
              const claimed = save.claimedQuests.includes(q.id);
              return (
                <div
                  key={q.id}
                  className="bg-[#111827] border border-[#26324d] p-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={q.type === 'main' ? 'text-[#facc15]' : 'text-[#38bdf8]'}>
                        [{q.type === 'main' ? 'MAIN' : 'SIDE'}]
                      </span>
                      <span className="font-bold text-white truncate">{q.title}</span>
                    </div>
                    <div className="text-[#94a3b8] text-[8px] mt-0.5">{q.description}</div>
                    <div className="text-[#cbd5e1] text-[8px] mt-0.5 tabular-nums">
                      Progress: {prog}/{q.targetCount} · Reward: {q.rewardGold}G, {q.rewardExp}EXP
                      {q.rewardSwordId ? `, ${getSwordDef(q.rewardSwordId).name}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!complete || claimed}
                    onClick={() => handleAction(claimQuestReward(save, q.id))}
                    className={`px-2 py-1 border text-[8px] shrink-0 whitespace-nowrap ${
                      claimed
                        ? 'bg-[#090d16] border-[#1e293b] text-[#64748b] cursor-default'
                        : complete
                          ? 'bg-[#16a34a] hover:bg-[#22c55e] border-[#fde047] text-white cursor-pointer'
                          : 'bg-[#1e293b] border-[#334155] text-[#64748b] cursor-not-allowed'
                    }`}
                  >
                    {claimed ? 'CLAIMED' : complete ? 'CLAIM' : `${prog}/${q.targetCount}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="space-y-2">
            {/* Consumables & Ammo Upgrade */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={hpPotionFull}
                onClick={() => handleAction(buyShopItem(save, 'hp_potion'))}
                className={`flex items-center gap-1.5 border p-1.5 text-left ${
                  hpPotionFull
                    ? 'bg-[#090d16] border-[#1e293b] opacity-65 cursor-not-allowed'
                    : 'bg-[#111827] hover:bg-[#1e293b] border-[#26324d] cursor-pointer'
                }`}
              >
                {icons?.itemIcons[3] && (
                  <img src={icons.itemIcons[3]} alt="HP Potion" referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-white font-bold truncate">
                    HP Potion ({save.hpPotions}/{MAX_HP_POTIONS})
                  </div>
                  <div className="text-[#facc15] text-[8px]">
                    {hpPotionFull ? 'MAX 10/10' : '40G · Heal 45%'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAction(buyShopItem(save, 'mana_potion'))}
                className="flex items-center gap-1.5 bg-[#111827] hover:bg-[#1e293b] border border-[#26324d] p-1.5 text-left cursor-pointer"
              >
                {icons?.itemIcons[4] && (
                  <img src={icons.itemIcons[4]} alt="Mana Potion" referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-white font-bold truncate">MP Potion ({save.manaPotions})</div>
                  <div className="text-[#facc15] text-[8px]">45G</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleAction(buyShopItem(save, 'ammo_pack'))}
                className="flex items-center gap-1.5 bg-[#111827] hover:bg-[#1e293b] border border-[#26324d] p-1.5 text-left cursor-pointer"
              >
                {icons?.itemIcons[1] && (
                  <img src={icons.itemIcons[1]} alt="Ammo Pack" referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-white font-bold truncate">Ammo +20</div>
                  <div className="text-[#facc15] text-[8px]">35G</div>
                </div>
              </button>

              <button
                type="button"
                disabled={!ammoTier}
                onClick={() => handleAction(buyShopItem(save, 'ammo_upgrade'))}
                className={`flex items-center gap-1.5 border p-1.5 text-left ${
                  ammoTier
                    ? 'bg-[#111827] hover:bg-[#1e293b] border-[#38bdf8] cursor-pointer'
                    : 'bg-[#090d16] border-[#1e293b] opacity-60 cursor-not-allowed'
                }`}
              >
                {icons?.itemIcons[2] && (
                  <img src={icons.itemIcons[2]} alt="Ammo Cap" referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-white font-bold truncate">
                    {ammoTier ? `Ammo Cap -> ${ammoTier.targetCap}` : 'Ammo Cap MAX'}
                  </div>
                  <div className="text-[#facc15] text-[8px]">
                    {ammoTier ? `${ammoTier.cost}G` : '100/100'}
                  </div>
                </div>
              </button>
            </div>

            {/* Shop Swords */}
            <div className="text-[#38bdf8] font-bold pt-1">Swords</div>
            <div className="space-y-1">
              {SWORDS.filter((s) => s.shopPrice).map((s) => {
                const owned = save.ownedSwords.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-[#111827] border border-[#26324d] p-1.5 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {icons?.swordIcons[s.spriteIndex] && (
                        <img src={icons.swordIcons[s.spriteIndex]} alt={s.name} referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-white font-bold truncate">{s.name}</div>
                        <div className="text-[#94a3b8] text-[8px] truncate">
                          ATK {s.baseDamage} · {s.effectLabel}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={owned}
                      onClick={() => handleAction(buyShopItem(save, { swordId: s.id }))}
                      className={`px-2 py-1 border text-[8px] shrink-0 ${
                        owned
                          ? 'bg-[#090d16] border-[#1e293b] text-[#4ade80]'
                          : 'bg-[#1d4ed8] hover:bg-[#2563eb] border-[#facc15] text-white cursor-pointer'
                      }`}
                    >
                      {owned ? 'OWNED' : `${s.shopPrice}G`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Armors & Accessories */}
            <div className="text-[#38bdf8] font-bold pt-1">Armor &amp; Accessories</div>
            <div className="space-y-1">
              {ARMORS.filter((a) => a.price > 0).map((a) => {
                const owned = save.ownedArmors.includes(a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between bg-[#111827] border border-[#26324d] p-1.5">
                    <div>
                      <div className="text-white font-bold">{a.name}</div>
                      <div className="text-[#94a3b8] text-[8px]">+{a.defBonus} DEF · +{a.hpBonus} HP</div>
                    </div>
                    <button
                      type="button"
                      disabled={owned}
                      onClick={() => handleAction(buyShopItem(save, { armorId: a.id }))}
                      className={`px-2 py-1 border text-[8px] ${
                        owned ? 'bg-[#090d16] border-[#1e293b] text-[#4ade80]' : 'bg-[#1d4ed8] border-[#facc15] text-white cursor-pointer'
                      }`}
                    >
                      {owned ? 'OWNED' : `${a.price}G`}
                    </button>
                  </div>
                );
              })}
              {ACCESSORIES.map((acc) => {
                const owned = save.ownedAccessories.includes(acc.id);
                return (
                  <div key={acc.id} className="flex items-center justify-between bg-[#111827] border border-[#26324d] p-1.5">
                    <div>
                      <div className="text-white font-bold">{acc.name}</div>
                      <div className="text-[#94a3b8] text-[8px]">{acc.effectText}</div>
                    </div>
                    <button
                      type="button"
                      disabled={owned}
                      onClick={() => handleAction(buyShopItem(save, { accessoryId: acc.id }))}
                      className={`px-2 py-1 border text-[8px] ${
                        owned ? 'bg-[#090d16] border-[#1e293b] text-[#4ade80]' : 'bg-[#1d4ed8] border-[#facc15] text-white cursor-pointer'
                      }`}
                    >
                      {owned ? 'OWNED' : `${acc.price}G`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'blacksmith' && (
          <div className="space-y-2">
            {/* Blacksmith Filter Toggle */}
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'all', label: 'ALL WEAPONS' },
                  { id: 'guns', label: 'GUNS (10)' },
                  { id: 'swords', label: 'SWORDS (10)' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    gameAudio.playMenuMove();
                    setSmithFilter(f.id);
                  }}
                  className={`py-1 px-1 border text-[8px] cursor-pointer ${
                    smithFilter === f.id
                      ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                      : 'bg-[#111827] border-[#26324d] text-[#94a3b8]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {smithFilter !== 'swords' && (
              <>
                <div className="text-[#38bdf8] font-bold">Upgrade Owned Guns (+1 to +10)</div>
                <div className="space-y-1">
                  {save.ownedGuns.map((gid) => {
                    const g = getGunDef(gid);
                    const lvl = save.gunUpgrades[gid] ?? 0;
                    const cost = getSwordUpgradeCost(lvl);
                    return (
                      <div key={gid} className="flex items-center justify-between bg-[#111827] border border-[#26324d] p-1.5 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {icons?.gunIcons[g.spriteIndex] && (
                            <img src={icons.gunIcons[g.spriteIndex]} alt={g.name} referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-white font-bold truncate">
                              {g.name} <span className="text-[#facc15]">+{lvl}</span>
                            </div>
                            <div className="text-[#94a3b8] text-[8px] truncate">
                              {lvl >= 10
                                ? 'MAX LEVEL'
                                : `${cost.gold}G · ${cost.materials}MT${cost.crystals ? ` · ${cost.crystals}CR` : ''}`}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={lvl >= 10}
                          onClick={() => handleAction(upgradeGun(save, gid))}
                          className={`px-2 py-1 border text-[8px] shrink-0 ${
                            lvl >= 10
                              ? 'bg-[#090d16] border-[#1e293b] text-[#4ade80]'
                              : 'bg-[#b45309] hover:bg-[#d97706] border-[#fde047] text-white cursor-pointer'
                          }`}
                        >
                          {lvl >= 10 ? 'MAX' : 'UPGRADE'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[#facc15] font-bold pt-1">Forge 10 Guns (20–200 Crystals)</div>
                <div className="space-y-1">
                  {GUNS.filter((g) => g.craftCost && !save.ownedGuns.includes(g.id)).map((g) => (
                    <div key={g.id} className="flex items-center justify-between bg-[#111827] border border-[#26324d] p-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {icons?.gunIcons[g.spriteIndex] && (
                          <img src={icons.gunIcons[g.spriteIndex]} alt={g.name} referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-white font-bold truncate">
                            {g.name}{' '}
                            <span className={g.rangePx === null ? 'text-[#38bdf8]' : g.isShotgun ? 'text-[#f97316]' : 'text-[#94a3b8]'}>
                              [{g.rangePx === null ? 'INF' : g.isShotgun ? '3x SHT' : `${g.rangePx}px`}]
                            </span>
                          </div>
                          <div className="text-[#94a3b8] text-[8px] truncate">
                            {g.craftCost!.gold}G · {g.craftCost!.materials}MT ·{' '}
                            <span className="text-[#22d3ee]">{g.craftCost!.crystals}CR</span> · {g.effectLabel}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAction(craftGun(save, g.id))}
                        className="px-2 py-1 bg-[#1d4ed8] hover:bg-[#2563eb] border border-[#38bdf8] text-white text-[8px] shrink-0 cursor-pointer"
                      >
                        FORGE
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {smithFilter !== 'guns' && (
              <>
                <div className="text-[#facc15] font-bold pt-1">Upgrade Owned Swords (+1 to +10)</div>
                <div className="space-y-1">
                  {save.ownedSwords.map((sid) => {
                    const s = getSwordDef(sid);
                    const lvl = save.swordUpgrades[sid] ?? 0;
                    const cost = getSwordUpgradeCost(lvl);
                    return (
                      <div key={sid} className="flex items-center justify-between bg-[#111827] border border-[#26324d] p-1.5 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {icons?.swordIcons[s.spriteIndex] && (
                            <img src={icons.swordIcons[s.spriteIndex]} alt={s.name} referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-white font-bold truncate">
                              {s.name} <span className="text-[#facc15]">+{lvl}</span>
                            </div>
                            <div className="text-[#94a3b8] text-[8px]">
                              {lvl >= 10
                                ? 'MAX LEVEL'
                                : `${cost.gold}G · ${cost.materials}MT${cost.crystals ? ` · ${cost.crystals}CR` : ''}`}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={lvl >= 10}
                          onClick={() => handleAction(upgradeSword(save, sid))}
                          className={`px-2 py-1 border text-[8px] shrink-0 ${
                            lvl >= 10
                              ? 'bg-[#090d16] border-[#1e293b] text-[#4ade80]'
                              : 'bg-[#b45309] hover:bg-[#d97706] border-[#fde047] text-white cursor-pointer'
                          }`}
                        >
                          {lvl >= 10 ? 'MAX' : 'UPGRADE'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[#38bdf8] font-bold pt-1">Forge Swords (20–200 Crystals)</div>
                <div className="space-y-1">
                  {SWORDS.filter((s) => s.craftCost && !save.ownedSwords.includes(s.id)).map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-[#111827] border border-[#26324d] p-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {icons?.swordIcons[s.spriteIndex] && (
                          <img src={icons.swordIcons[s.spriteIndex]} alt={s.name} referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-white font-bold truncate">{s.name}</div>
                          <div className="text-[#94a3b8] text-[8px]">
                            {s.craftCost!.gold}G · {s.craftCost!.materials}MT ·{' '}
                            <span className="text-[#22d3ee]">{s.craftCost!.crystals}CR</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAction(craftSword(save, s.id))}
                        className="px-2 py-1 bg-[#1d4ed8] hover:bg-[#2563eb] border border-[#38bdf8] text-white text-[8px] shrink-0 cursor-pointer"
                      >
                        FORGE
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'equipment' && (
          <div className="space-y-2">
            {/* Hero Stats Summary */}
            <div className="bg-[#111827] border border-[#26324d] p-2 grid grid-cols-3 gap-1.5 tabular-nums">
              <div>HP: <span className="text-[#4ade80]">{stats.maxHp}</span></div>
              <div>ATK: <span className="text-[#facc15]">{stats.atk}</span></div>
              <div>GUN: <span className="text-[#38bdf8]">{stats.gunAtk}</span></div>
              <div>DEF: <span className="text-[#cbd5e1]">{stats.def}</span></div>
              <div>CRIT: <span className="text-[#f472b6]">{Math.round(stats.critRate * 100)}%</span></div>
              <div>EXP: <span className="text-[#94a3b8]">{save.exp}/{nextExp || 'MAX'}</span></div>
            </div>

            <div className="text-[#38bdf8] font-bold">Guns ({save.ownedGuns.length}/10)</div>
            <div className="space-y-1">
              {GUNS.map((g) => {
                const owned = save.ownedGuns.includes(g.id);
                const equipped = save.equippedGun === g.id;
                const upg = save.gunUpgrades[g.id] ?? 0;
                const rangeText = g.rangePx === null ? 'Infinite' : `${g.rangePx}px`;
                return (
                  <div
                    key={g.id}
                    className={`flex items-center justify-between border p-1.5 gap-2 ${
                      equipped
                        ? 'bg-[#172554] border-[#facc15]'
                        : owned
                          ? 'bg-[#111827] border-[#26324d]'
                          : 'bg-[#090d16] border-[#1e293b] opacity-55'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {icons?.gunIcons[g.spriteIndex] && (
                        <img src={icons.gunIcons[g.spriteIndex]} alt={g.name} referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-white font-bold truncate">
                          {g.name} {owned && upg > 0 ? `+${upg}` : ''}
                        </div>
                        <div className="text-[#94a3b8] text-[8px] truncate">
                          {owned
                            ? `DMG ${g.baseDamage + upg * 3}${g.pellets > 1 ? ` x${g.pellets}` : ''} · Range: ${rangeText}`
                            : `Forge in Smith (${g.craftCost?.crystals ?? 0}CR) · ${rangeText}`}
                        </div>
                      </div>
                    </div>
                    {owned && (
                      <button
                        type="button"
                        disabled={equipped}
                        onClick={() => {
                          gameAudio.playMenuSelect();
                          onUpdateSave({ ...save, equippedGun: g.id as GunId });
                        }}
                        className={`px-2 py-1 border text-[8px] shrink-0 ${
                          equipped
                            ? 'bg-[#16a34a] border-[#fde047] text-white'
                            : 'bg-[#1e293b] hover:bg-[#334155] border-[#475569] text-[#cbd5e1] cursor-pointer'
                        }`}
                      >
                        {equipped ? 'EQUIPPED' : 'EQUIP'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[#facc15] font-bold pt-1">Swords ({save.ownedSwords.length}/10)</div>
            <div className="space-y-1">
              {SWORDS.map((s) => {
                const owned = save.ownedSwords.includes(s.id);
                const equipped = save.equippedSword === s.id;
                const upg = save.swordUpgrades[s.id] ?? 0;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between border p-1.5 gap-2 ${
                      equipped
                        ? 'bg-[#172554] border-[#facc15]'
                        : owned
                          ? 'bg-[#111827] border-[#26324d]'
                          : 'bg-[#090d16] border-[#1e293b] opacity-55'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {icons?.swordIcons[s.spriteIndex] && (
                        <img src={icons.swordIcons[s.spriteIndex]} alt={s.name} referrerPolicy="no-referrer" className="w-5 h-5 pixelated shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-white font-bold truncate">
                          {s.name} {owned && upg > 0 ? `+${upg}` : ''}
                        </div>
                        <div className="text-[#94a3b8] text-[8px] truncate">
                          {owned ? `ATK ${s.baseDamage + upg * 4} · ${s.effectLabel}` : s.sourceHint}
                        </div>
                      </div>
                    </div>
                    {owned && (
                      <button
                        type="button"
                        disabled={equipped}
                        onClick={() => {
                          gameAudio.playMenuSelect();
                          onUpdateSave({ ...save, equippedSword: s.id as SwordId });
                        }}
                        className={`px-2 py-1 border text-[8px] shrink-0 ${
                          equipped
                            ? 'bg-[#16a34a] border-[#fde047] text-white'
                            : 'bg-[#1e293b] hover:bg-[#334155] border-[#475569] text-[#cbd5e1] cursor-pointer'
                        }`}
                      >
                        {equipped ? 'EQUIPPED' : 'EQUIP'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-[#38bdf8] font-bold pt-1">Armor</div>
            <div className="grid grid-cols-2 gap-1">
              {save.ownedArmors.map((aid) => {
                const a = ARMORS.find((x) => x.id === aid);
                if (!a) return null;
                const eq = save.equippedArmor === aid;
                return (
                  <button
                    key={aid}
                    type="button"
                    onClick={() => {
                      gameAudio.playMenuSelect();
                      onUpdateSave({ ...save, equippedArmor: aid });
                    }}
                    className={`p-1.5 border text-left cursor-pointer ${
                      eq ? 'bg-[#172554] border-[#facc15] text-white' : 'bg-[#111827] border-[#26324d] text-[#94a3b8]'
                    }`}
                  >
                    <div className="font-bold truncate">{a.name}</div>
                    <div className="text-[8px]">+{a.defBonus} DEF · {eq ? 'EQUIPPED' : 'Click Equip'}</div>
                  </button>
                );
              })}
            </div>

            {save.ownedAccessories.length > 0 && (
              <>
                <div className="text-[#38bdf8] font-bold pt-1">Accessories</div>
                <div className="grid grid-cols-2 gap-1">
                  {save.ownedAccessories.map((accId) => {
                    const acc = ACCESSORIES.find((x) => x.id === accId);
                    if (!acc) return null;
                    const eq = save.equippedAccessory === accId;
                    return (
                      <button
                        key={accId}
                        type="button"
                        onClick={() => {
                          gameAudio.playMenuSelect();
                          onUpdateSave({ ...save, equippedAccessory: eq ? null : accId });
                        }}
                        className={`p-1.5 border text-left cursor-pointer ${
                          eq ? 'bg-[#172554] border-[#facc15] text-white' : 'bg-[#111827] border-[#26324d] text-[#94a3b8]'
                        }`}
                      >
                        <div className="font-bold truncate">{acc.name}</div>
                        <div className="text-[8px]">{acc.effectText}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
