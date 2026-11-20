import React from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Pause,
  Settings,
  Sword,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { VirtualButton } from '../game/engine';
import { TouchMode } from '../game/types';

export type MenuNavAction = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';

interface HandheldShellProps {
  children: React.ReactNode;
  touchMode: TouchMode;
  muted: boolean;
  isStagePlaying: boolean;
  onVirtualButton: (btn: VirtualButton, down: boolean) => void;
  onMenuNav: (action: MenuNavAction) => void;
  onToggleMute: () => void;
  onPause: () => void;
  onOptions: () => void;
}

export const HandheldShell: React.FC<HandheldShellProps> = ({
  children,
  touchMode,
  muted,
  isStagePlaying,
  onVirtualButton,
  onMenuNav,
  onToggleMute,
  onPause,
  onOptions,
}) => {
  const showPad = touchMode !== 'hidden';

  const safeCapture = (el: HTMLElement, pointerId: number) => {
    try {
      el.setPointerCapture?.(pointerId);
    } catch {
      // Ignore synthetic pointer events without an active pointerId
    }
  };

  const dpadProps = (dir: 'up' | 'down' | 'left' | 'right') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      if (isStagePlaying) {
        safeCapture(e.currentTarget as HTMLElement, e.pointerId);
        onVirtualButton(dir, true);
      } else {
        onMenuNav(dir);
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      if (isStagePlaying) onVirtualButton(dir, false);
    },
    onPointerCancel: () => {
      if (isStagePlaying) onVirtualButton(dir, false);
    },
    onLostPointerCapture: () => {
      if (isStagePlaying) onVirtualButton(dir, false);
    },
  });

  const abxyProps = (btn: 'A' | 'B' | 'X' | 'Y') => {
    const stageMap: Record<'A' | 'B' | 'X' | 'Y', VirtualButton> = {
      A: 'sword',
      B: 'jump',
      X: 'gun',
      Y: 'dash',
    };
    const stageBtn = stageMap[btn];

    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        if (isStagePlaying) {
          safeCapture(e.currentTarget as HTMLElement, e.pointerId);
          onVirtualButton(stageBtn, true);
        } else if (btn === 'A') {
          onMenuNav('ok');
        } else if (btn === 'B') {
          onMenuNav('back');
        }
      },
      onPointerUp: (e: React.PointerEvent) => {
        e.preventDefault();
        if (isStagePlaying) onVirtualButton(stageBtn, false);
      },
      onPointerCancel: () => {
        if (isStagePlaying) onVirtualButton(stageBtn, false);
      },
      onLostPointerCapture: () => {
        if (isStagePlaying) onVirtualButton(stageBtn, false);
      },
    };
  };

  const potionProps = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      if (isStagePlaying) {
        safeCapture(e.currentTarget as HTMLElement, e.pointerId);
        onVirtualButton('potion', true);
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      if (isStagePlaying) onVirtualButton('potion', false);
    },
    onPointerCancel: () => {
      if (isStagePlaying) onVirtualButton('potion', false);
    },
    onLostPointerCapture: () => {
      if (isStagePlaying) onVirtualButton('potion', false);
    },
  };

  const transparentWhiteBtn =
    'bg-white/10 hover:bg-white/20 active:bg-white/35 border-2 border-white/60 text-white/95 backdrop-blur-[1px] transition-colors cursor-pointer select-none flex flex-col items-center justify-center';

  const dpadBtnClass =
    'bg-white/10 hover:bg-white/20 active:bg-white/35 border-2 border-white/55 text-white/90 flex items-center justify-center cursor-pointer select-none transition-colors';

  const renderAbxyDiamond = (sizeClass: string, iconSize: string) => (
    <div className="grid grid-cols-3 grid-rows-3 gap-1.5 items-center justify-items-center touch-none">
      {/* Row 1: X (Shoot) at Top */}
      <div />
      <button
        type="button"
        data-btn="X"
        aria-label="X Shoot Gun"
        tabIndex={-1}
        {...abxyProps('X')}
        className={`${sizeClass} rounded-full ${transparentWhiteBtn}`}
      >
        <Crosshair className={iconSize} strokeWidth={2.25} />
        <span className="font-pixel-title text-[8px] leading-none mt-0.5">X</span>
      </button>
      <div />

      {/* Row 2: Y (Dash) Left, Center Dot, A (Attack / OK) Right */}
      <button
        type="button"
        data-btn="Y"
        aria-label="Y Dash"
        tabIndex={-1}
        {...abxyProps('Y')}
        className={`${sizeClass} rounded-full ${transparentWhiteBtn}`}
      >
        <Zap className={iconSize} strokeWidth={2.25} />
        <span className="font-pixel-title text-[8px] leading-none mt-0.5">Y</span>
      </button>
      <div className="w-2.5 h-2.5 rounded-full bg-white/15 border border-white/25" />
      <button
        type="button"
        data-btn="A"
        aria-label={isStagePlaying ? 'A Attack Sword' : 'A OK Select'}
        tabIndex={-1}
        {...abxyProps('A')}
        className={`${sizeClass} rounded-full ${transparentWhiteBtn}`}
      >
        <Sword className={iconSize} strokeWidth={2.25} />
        <span className="font-pixel-title text-[8px] leading-none mt-0.5">A</span>
      </button>

      {/* Row 3: B (Jump / Back) at Bottom */}
      <div />
      <button
        type="button"
        data-btn="B"
        aria-label={isStagePlaying ? 'B Jump' : 'B Back'}
        tabIndex={-1}
        {...abxyProps('B')}
        className={`${sizeClass} rounded-full ${transparentWhiteBtn}`}
      >
        <ArrowUp className={iconSize} strokeWidth={2.25} />
        <span className="font-pixel-title text-[8px] leading-none mt-0.5">B</span>
      </button>
      <div />
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#12141f] flex flex-col items-center justify-center p-2 sm:p-4">
      {/* Retro GBC Handheld Casing */}
      <div className="w-full max-w-[980px] h-full max-h-[840px] flex flex-col md:flex-row items-center justify-evenly md:justify-center gap-2 md:gap-5 bg-[#23273a] border-4 border-[#3a415e] rounded-2xl p-2.5 sm:p-4 shadow-[0_12px_0_#0b0d14]">
        {/* Left Handheld Wing (Desktop D-Pad & Info) */}
        {showPad && (
          <div className="hidden md:flex flex-col items-center justify-center gap-4 w-44 shrink-0">
            <div className="text-[9px] font-pixel-title text-white/75 tracking-wider">
              {isStagePlaying ? 'D-PAD' : 'PILIH MENU'}
            </div>
            <div className="grid grid-cols-3 grid-rows-3 gap-1 w-32 h-32">
              <div />
              <button
                type="button"
                aria-label="D-Pad Up"
                tabIndex={-1}
                {...dpadProps('up')}
                className={`${dpadBtnClass} rounded-t`}
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div />
              <button
                type="button"
                aria-label="D-Pad Left"
                tabIndex={-1}
                {...dpadProps('left')}
                className={`${dpadBtnClass} rounded-l`}
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div className="bg-white/10 border border-white/30 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white/25" />
              </div>
              <button
                type="button"
                aria-label="D-Pad Right"
                tabIndex={-1}
                {...dpadProps('right')}
                className={`${dpadBtnClass} rounded-r`}
              >
                <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div />
              <button
                type="button"
                aria-label="D-Pad Down"
                tabIndex={-1}
                {...dpadProps('down')}
                className={`${dpadBtnClass} rounded-b`}
              >
                <ArrowDown className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                onClick={onToggleMute}
                tabIndex={-1}
                onMouseUp={(e) => e.currentTarget.blur()}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 border-2 border-white/50 rounded flex items-center justify-center text-white cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 text-[#f87171]" /> : <Volume2 className="w-4 h-4 text-[#4ade80]" />}
              </button>
              <button
                type="button"
                aria-label="Open Options"
                onClick={onOptions}
                tabIndex={-1}
                onMouseUp={(e) => e.currentTarget.blur()}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 border-2 border-white/50 rounded flex items-center justify-center text-white cursor-pointer"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Center 1:1 Square Game Boy Color LCD Screen Bezel */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="bg-[#0d1018] border-4 border-[#171b26] rounded-xl p-2 sm:p-3 shadow-inner flex flex-col items-center">
            <div className="w-full flex items-center justify-between px-1 pb-1.5 text-[9px] text-[#94a3b8]">
              <span className="font-pixel-title tracking-wider text-[#cbd5e1]">COLOR-LCD 1:1</span>
              <div className="flex items-center gap-1.5">
                {isStagePlaying && (
                  <button
                    type="button"
                    aria-label="Pause Game"
                    onClick={onPause}
                    tabIndex={-1}
                    className="px-2 py-0.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[8px] text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Pause className="w-2.5 h-2.5" /> PAUSE
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Toggle Mute"
                  onClick={onToggleMute}
                  tabIndex={-1}
                  className="md:hidden px-1.5 py-0.5 bg-[#1e293b] border border-[#475569] text-[8px] text-white"
                >
                  {muted ? 'MUTE' : 'SFX'}
                </button>
                <button
                  type="button"
                  aria-label="Options"
                  onClick={onOptions}
                  tabIndex={-1}
                  className="md:hidden px-1.5 py-0.5 bg-[#1e293b] border border-[#475569] text-[8px] text-white"
                >
                  OPT
                </button>
              </div>
            </div>

            {/* 1:1 Square Playfield Screen */}
            <div className="relative aspect-square w-[min(86vw,380px)] md:w-[min(68vh,512px)] bg-[#080c14] border-2 border-[#2a334d] overflow-hidden">
              {children}
            </div>
          </div>
        </div>

        {/* Right Handheld Wing (Desktop Transparent-White ABXY Cluster) */}
        {showPad && (
          <div className="hidden md:flex flex-col items-center justify-center gap-3 w-44 shrink-0">
            <div className="text-[9px] font-pixel-title text-white/75 tracking-wider">ABXY PAD</div>
            {renderAbxyDiamond('w-12 h-12', 'w-4 h-4')}
            <div className="text-[8px] text-white/70 text-center leading-tight">
              {isStagePlaying ? 'A:Atk B:Jmp X:Sht Y:Dsh' : 'A: OK  ·  B: Back'}
            </div>
            <button
              type="button"
              aria-label="Use HP Potion"
              tabIndex={-1}
              {...potionProps}
              className="w-28 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/35 border-2 border-white/55 rounded text-[8px] font-pixel-title text-white cursor-pointer"
            >
              POTION [H]
            </button>
          </div>
        )}

        {/* Android / Mobile Portrait Touch Controls Bar */}
        {showPad && (
          <div className="flex md:hidden w-full items-center justify-between px-1 pt-1 gap-2 flex-1 max-h-[210px]">
            {/* Mobile D-Pad */}
            <div className="grid grid-cols-3 grid-rows-3 gap-1 w-32 h-32 shrink-0 touch-none">
              <div />
              <button
                type="button"
                aria-label="D-Pad Up"
                tabIndex={-1}
                {...dpadProps('up')}
                className={`min-w-[40px] min-h-[40px] rounded-t ${dpadBtnClass}`}
              >
                <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div />
              <button
                type="button"
                aria-label="D-Pad Left"
                tabIndex={-1}
                {...dpadProps('left')}
                className={`min-w-[40px] min-h-[40px] rounded-l ${dpadBtnClass}`}
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div className="bg-white/10 border border-white/30" />
              <button
                type="button"
                aria-label="D-Pad Right"
                tabIndex={-1}
                {...dpadProps('right')}
                className={`min-w-[40px] min-h-[40px] rounded-r ${dpadBtnClass}`}
              >
                <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div />
              <button
                type="button"
                aria-label="D-Pad Down"
                tabIndex={-1}
                {...dpadProps('down')}
                className={`min-w-[40px] min-h-[40px] rounded-b ${dpadBtnClass}`}
              >
                <ArrowDown className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <div />
            </div>

            {/* Center Potion & Hint */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                aria-label="Drink Potion"
                tabIndex={-1}
                {...potionProps}
                className="min-h-[44px] px-2.5 bg-white/10 active:bg-white/35 border-2 border-white/55 rounded text-[8px] font-pixel-title text-white"
              >
                POT
              </button>
              <span className="text-[7px] text-white/65 text-center leading-tight">
                {isStagePlaying ? 'A:Atk B:Jmp' : 'A:OK B:Bck'}
              </span>
            </div>

            {/* Mobile ABXY Diamond (>= 44px touch targets) */}
            <div className="shrink-0">
              {renderAbxyDiamond('w-11 h-11', 'w-3.5 h-3.5')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
