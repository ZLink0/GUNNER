import { HeroAnimName } from './types';

export interface HeroAnimSpec {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
}

export const HERO_ANIMS: Record<HeroAnimName, HeroAnimSpec> = {
  idle: { row: 0, frames: 4, fps: 6, loop: true },
  walk: { row: 1, frames: 4, fps: 8, loop: true },
  run: { row: 2, frames: 6, fps: 13, loop: true },
  jump: { row: 3, frames: 3, fps: 10, loop: false },
  fall: { row: 4, frames: 3, fps: 9, loop: true },
  land: { row: 5, frames: 2, fps: 14, loop: false },
  sword1: { row: 6, frames: 4, fps: 16, loop: false },
  sword2: { row: 7, frames: 4, fps: 16, loop: false },
  sword3: { row: 8, frames: 5, fps: 17, loop: false },
  shoot: { row: 9, frames: 3, fps: 15, loop: false },
  shootUp: { row: 10, frames: 3, fps: 15, loop: false },
  shootDown: { row: 11, frames: 3, fps: 15, loop: false },
  hurt: { row: 12, frames: 3, fps: 12, loop: false },
  death: { row: 13, frames: 5, fps: 9, loop: false },
  climb: { row: 14, frames: 4, fps: 8, loop: true },
  dash: { row: 15, frames: 3, fps: 14, loop: true },
  potion: { row: 16, frames: 4, fps: 10, loop: false },
};

export interface LoadedSprites {
  hero: HTMLImageElement;
  swords: HTMLImageElement;
  guns: HTMLImageElement;
  enemies: HTMLImageElement;
  itemsVfx: HTMLImageElement;
  menuIcons: HTMLImageElement;
  tiles: HTMLImageElement;
  backgrounds: HTMLImageElement;
}

export interface ExtractedUiIcons {
  menuIcons: string[]; // 5 data URLs
  swordIcons: string[]; // 10 data URLs
  gunIcons: string[]; // 10 data URLs
  itemIcons: string[]; // 8 data URLs
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

function cropToPngDataUrl(img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number): string {
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return c.toDataURL('image/png');
}

let cachedPromise: Promise<{ sprites: LoadedSprites; icons: ExtractedUiIcons }> | null = null;

export function loadAllSprites(): Promise<{ sprites: LoadedSprites; icons: ExtractedUiIcons }> {
  if (cachedPromise) return cachedPromise;
  cachedPromise = Promise.all([
    loadImg('/sprites/hero.png'),
    loadImg('/sprites/swords.png'),
    loadImg('/sprites/guns.png'),
    loadImg('/sprites/enemies.png'),
    loadImg('/sprites/items_vfx.png'),
    loadImg('/sprites/menu_icons.png'),
    loadImg('/sprites/tiles.png'),
    loadImg('/sprites/backgrounds.png'),
  ]).then(([hero, swords, guns, enemies, itemsVfx, menuIcons, tiles, backgrounds]) => {
    const icons: ExtractedUiIcons = {
      menuIcons: Array.from({ length: 5 }, (_, i) => cropToPngDataUrl(menuIcons, i * 24, 0, 24, 24)),
      swordIcons: Array.from({ length: 10 }, (_, i) => cropToPngDataUrl(swords, i * 16, 0, 16, 16)),
      gunIcons: Array.from({ length: 10 }, (_, i) => cropToPngDataUrl(guns, i * 16, 0, 16, 16)),
      itemIcons: Array.from({ length: 8 }, (_, i) => cropToPngDataUrl(itemsVfx, i * 16, 0, 16, 16)),
    };
    return {
      sprites: { hero, swords, guns, enemies, itemsVfx, menuIcons, tiles, backgrounds },
      icons,
    };
  });
  return cachedPromise;
}
