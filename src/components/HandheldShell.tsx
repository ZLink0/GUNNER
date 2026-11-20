import React, { useEffect, useRef, useState } from 'react';
import {
  Anchor,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Pause,
  RefreshCw,
  Shield,
  Sword,
  Zap,
} from 'lucide-react';
import { VirtualButton } from '../game/engine';
import { ButtonLayoutConfig, TouchMode } from '../game/types';

export type MenuNavAction = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';

interface HandheldShellProps {
  children: React.ReactNode;
  touchMode: TouchMode;
  buttonLayout: ButtonLayoutConfig;
  isStagePlaying: boolean;
  onVirtualButton: (btn: VirtualButton, down: boolean) => void;
  onGrappleAimPreview?: (angleRad: number | null) => void;
  onGrappleFire?: (angleRad: number | null) => void;
  onMenuNav: (action: MenuNavAction) => void;
  onPause: () => void;
  onStart: () => void;
}

export const HandheldShell: React.FC<HandheldShellProps> = ({
  children,
  touchMode,
  buttonLayout,
  isStagePlaying,
  onVirtualButton,
  onGrappleAimPreview,
  onGrappleFire,
  onMenuNav,
  onPause,
  onStart,
}) => {
  const showPad = touchMode !== 'hidden';
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
  );

  const grappleDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, moved: false });

  useEffect(() => {
    const updateOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

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

  const holdBtnProps = (btn: VirtualButton) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      if (isStagePlaying) {
        safeCapture(e.currentTarget as HTMLElement, e.pointerId);
        onVirtualButton(btn, true);
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      if (isStagePlaying) onVirtualButton(btn, false);
    },
    onPointerCancel: () => {
      if (isStagePlaying) onVirtualButton(btn, false);
    },
    onLostPointerCapture: () => {
      if (isStagePlaying) onVirtualButton(btn, false);
    },
  });

  const grappleBtnProps = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      if (!isStagePlaying) return;
      safeCapture(e.currentTarget as HTMLElement, e.pointerId);
      grappleDragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!isStagePlaying || !grappleDragRef.current.active) return;
      const dx = e.clientX - grappleDragRef.current.startX;
      const dy = e.clientY - grappleDragRef.current.startY;
      if (Math.hypot(dx, dy) >= 8) {
        grappleDragRef.current.moved = true;
        onGrappleAimPreview?.(Math.atan2(dy, dx));
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      if (!isStagePlaying || !grappleDragRef.current.active) return;
      const dx = e.clientX - grappleDragRef.current.startX;
      const dy = e.clientY - grappleDragRef.current.startY;
      const angle = grappleDragRef.current.moved ? Math.atan2(dy, dx) : null;
      grappleDragRef.current.active = false;
      grappleDragRef.current.moved = false;
      onGrappleAimPreview?.(null);
      if (onGrappleFire) {
        onGrappleFire(angle);
      } else {
        onVirtualButton('grapple', true);
        onVirtualButton('grapple', false);
      }
    },
    onPointerCancel: () => {
      grappleDragRef.current.active = false;
      grappleDragRef.current.moved = false;
      onGrappleAimPreview?.(null);
    },
    onLostPointerCapture: () => {
      grappleDragRef.current.active = false;
      grappleDragRef.current.moved = false;
      onGrappleAimPreview?.(null);
    },
  };

  const transparentWhiteBtn =
    'bg-white/10 hover:bg-white/20 active:bg-white/35 border-2 border-white/60 text-white/95 backdrop-blur-[1px] transition-colors cursor-pointer select-none flex flex-col items-center justify-center';

  const dpadBtnClass =
    'bg-white/10 hover:bg-white/20 active:bg-white/35 border-2 border-white/55 text-white/90 flex items-center justify-center cursor-pointer select-none transition-colors';

  const alignClass =
    buttonLayout.verticalAlign === 'top'
      ? 'justify-start pt-1'
      : buttonLayout.verticalAlign === 'bottom'
        ? 'justify-end pb-1'
        : 'justify-center';

  const gapClass =
    buttonLayout.gapSize === 'tight'
      ? 'gap-1'
      : buttonLayout.gapSize === 'wide'
        ? 'gap-3'
        : 'gap-2';

  const abxyBtnSize = isPortrait
    ? buttonLayout.buttonScale === 0.85
      ? 'w-8 h-8'
      : buttonLayout.buttonScale === 1.15
        ? 'w-10 h-10'
        : 'w-9 h-9'
    : buttonLayout.buttonScale === 0.85
      ? 'w-7 h-7 sm:w-9 sm:h-9'
      : buttonLayout.buttonScale === 1.15
        ? 'w-8 h-8 sm:w-11 sm:h-11'
        : 'w-7 h-7 sm:w-10 sm:h-10';

  const dpadGridSize = isPortrait
    ? buttonLayout.buttonScale === 0.85
      ? 'w-[92px] h-[92px]'
      : buttonLayout.buttonScale === 1.15
        ? 'w-[114px] h-[114px]'
        : 'w-[104px] h-[104px]'
    : buttonLayout.buttonScale === 0.85
      ? 'w-[72px] h-[72px] sm:w-24 sm:h-24'
      : buttonLayout.buttonScale === 1.15
        ? 'w-[84px] h-[84px] sm:w-32 sm:h-32'
        : 'w-[76px] h-[76px] sm:w-28 sm:h-28';

  const abxyIconSize = 'w-3.5 h-3.5 sm:w-4 sm:h-4';

  const dpadCross = (
    <div className={`grid grid-cols-3 grid-rows-3 gap-1 ${dpadGridSize} touch-none shrink-0`}>
      <div />
      <button
        type="button"
        aria-label="D-Pad Up"
        tabIndex={-1}
        {...dpadProps('up')}
        className={`${dpadBtnClass} rounded-t`}
      >
        <ArrowUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
      </button>
      <div />
      <button
        type="button"
        aria-label="D-Pad Left"
        tabIndex={-1}
        {...dpadProps('left')}
        className={`${dpadBtnClass} rounded-l`}
      >
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
      </button>
      <div className="bg-white/10 border border-white/30 flex items-center justify-center">
        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-white/25" />
      </div>
      <button
        type="button"
        aria-label="D-Pad Right"
        tabIndex={-1}
        {...dpadProps('right')}
        className={`${dpadBtnClass} rounded-r`}
      >
        <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
      </button>
      <div />
      <button
        type="button"
        aria-label="D-Pad Down"
        tabIndex={-1}
        {...dpadProps('down')}
        className={`${dpadBtnClass} rounded-b`}
      >
        <ArrowDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={2.5} />
      </button>
      <div />
    </div>
  );

  const abxyDiamond = (
    <div className="grid grid-cols-3 grid-rows-3 gap-1 sm:gap-1.5 items-center justify-items-center touch-none shrink-0">
      <div />
      <button
        type="button"
        data-btn="X"
        aria-label="X Shoot Gun"
        tabIndex={-1}
        {...abxyProps('X')}
        className={`${abxyBtnSize} rounded-full ${transparentWhiteBtn}`}
      >
        <Crosshair className={abxyIconSize} strokeWidth={2.25} />
        <span className="font-pixel-title text-[6px] sm:text-[8px] leading-none mt-0.5">X</span>
      </button>
      <div />

      <button
        type="button"
        data-btn="Y"
        aria-label="Y Dash"
        tabIndex={-1}
        {...abxyProps('Y')}
        className={`${abxyBtnSize} rounded-full ${transparentWhiteBtn}`}
      >
        <Zap className={abxyIconSize} strokeWidth={2.25} />
        <span className="font-pixel-title text-[6px] sm:text-[8px] leading-none mt-0.5">Y</span>
      </button>
      <div className="w-2 h-2 rounded-full bg-white/15 border border-white/25" />
      <button
        type="button"
        data-btn="A"
        aria-label={isStagePlaying ? 'A Attack Sword' : 'A OK Select'}
        tabIndex={-1}
        {...abxyProps('A')}
        className={`${abxyBtnSize} rounded-full ${transparentWhiteBtn}`}
      >
        <Sword className={abxyIconSize} strokeWidth={2.25} />
        <span className="font-pixel-title text-[6px] sm:text-[8px] leading-none mt-0.5">A</span>
      </button>

      <div />
      <button
        type="button"
        data-btn="B"
        aria-label={isStagePlaying ? 'B Jump' : 'B Back'}
        tabIndex={-1}
        {...abxyProps('B')}
        className={`${abxyBtnSize} rounded-full ${transparentWhiteBtn}`}
      >
        <ArrowUp className={abxyIconSize} strokeWidth={2.25} />
        <span className="font-pixel-title text-[6px] sm:text-[8px] leading-none mt-0.5">B</span>
      </button>
      <div />
    </div>
  );

  const lBlockBtn = (
    <button
      type="button"
      data-btn="L"
      aria-label="L Block"
      tabIndex={-1}
      {...holdBtnProps('block')}
      className={`px-2 py-1 rounded ${transparentWhiteBtn}`}
    >
      <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={2.25} />
      <span className="font-pixel-title text-[6px] sm:text-[7px] mt-0.5">L·BLK</span>
    </button>
  );

  const turnBtn = (
    <button
      type="button"
      data-btn="TURN"
      aria-label="Balik Badan"
      tabIndex={-1}
      {...holdBtnProps('turnFlip')}
      className={`px-2 py-1 rounded ${transparentWhiteBtn}`}
    >
      <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={2.25} />
      <span className="font-pixel-title text-[6px] sm:text-[7px] mt-0.5">BALIK</span>
    </button>
  );

  const rHookBtn = (
    <button
      type="button"
      data-btn="R"
      aria-label="R Grappling Hook"
      tabIndex={-1}
      {...grappleBtnProps}
      className={`px-2.5 py-1 rounded touch-none ${transparentWhiteBtn}`}
    >
      <Anchor className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={2.25} />
      <span className="font-pixel-title text-[6px] sm:text-[7px] mt-0.5">R·HOOK</span>
    </button>
  );

  const startBtn = (
    <button
      type="button"
      data-btn="START"
      aria-label={isStagePlaying ? 'Start Pause Menu' : 'Start OK'}
      onClick={onStart}
      tabIndex={-1}
      onMouseUp={(e) => e.currentTarget.blur()}
      className="px-2 sm:px-3 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/35 border-2 border-white/60 rounded-full text-[6px] sm:text-[8px] font-pixel-title text-white cursor-pointer tracking-wider"
    >
      START
    </button>
  );

  const potionBtn = (
    <button
      type="button"
      data-btn="POTION"
      aria-label="Use HP Potion"
      tabIndex={-1}
      {...holdBtnProps('potion')}
      className="px-2 sm:px-2.5 py-1.5 bg-white/10 hover:bg-white/20 active:bg-white/35 border-2 border-white/55 rounded text-[6px] sm:text-[8px] font-pixel-title text-white cursor-pointer"
    >
      POT
    </button>
  );

  const dpadWing = (
    <div
      key="dpad-wing"
      data-wing="dpad"
      className={`flex flex-col items-center h-full ${alignClass} ${gapClass} w-[104px] sm:w-36 lg:w-44 shrink-0`}
    >
      <div className="flex items-center gap-1 sm:gap-1.5 w-full justify-center">
        {lBlockBtn}
        {turnBtn}
      </div>
      {dpadCross}
    </div>
  );

  const abxyWing = (
    <div
      key="abxy-wing"
      data-wing="abxy"
      className={`flex flex-col items-center h-full ${alignClass} ${gapClass} w-[104px] sm:w-36 lg:w-44 shrink-0`}
    >
      {rHookBtn}
      {abxyDiamond}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {startBtn}
        {potionBtn}
      </div>
    </div>
  );

  const screenBezel = (
    <div key="center-screen" className="flex flex-col items-center justify-center shrink-0">
      <div className="bg-[#0d1018] border-2 sm:border-4 border-[#171b26] rounded-xl p-1.5 sm:p-2.5 shadow-inner flex flex-col items-center">
        <div className="w-full flex items-center justify-between px-1 pb-1 text-[8px] sm:text-[9px] text-[#94a3b8]">
          <span className="font-pixel-title tracking-wider text-[#cbd5e1]">GBC 1:1</span>
          <div className="flex items-center gap-1">
            {isStagePlaying && (
              <button
                type="button"
                aria-label="Pause Game"
                onClick={onPause}
                tabIndex={-1}
                className="px-1.5 py-0.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[7px] sm:text-[8px] text-white flex items-center gap-1 cursor-pointer"
              >
                <Pause className="w-2.5 h-2.5" /> PAUSE
              </button>
            )}
          </div>
        </div>

        {/* Strict 1:1 Square Playfield Screen */}
        <div
          data-testid="square-lcd"
          className={`relative aspect-square bg-[#080c14] border-2 border-[#2a334d] overflow-hidden ${
            isPortrait ? 'w-[min(86vw,44vh,400px)]' : 'w-[min(68vh,45vw,512px)]'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );

  const portraitControlsDeck = (
    <div
      data-testid="portrait-controls"
      className="w-full flex-1 min-h-0 flex flex-col items-center justify-evenly gap-2 px-1 pb-1"
    >
      {/* Clean single-row Shoulder & Utility Buttons (no overlapping) */}
      <div className="w-full max-w-[360px] flex items-center justify-between gap-1.5">
        {lBlockBtn}
        {turnBtn}
        {startBtn}
        {potionBtn}
        {rHookBtn}
      </div>

      {/* Main Action Controls (D-Pad + ABXY Side-by-Side) */}
      <div className="w-full max-w-[360px] flex items-center justify-between gap-3 px-1">
        {buttonLayout.swapHands ? abxyDiamond : dpadCross}
        {buttonLayout.swapHands ? dpadCross : abxyDiamond}
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#12141f] flex items-center justify-center p-1 sm:p-3">
      <div
        data-testid="handheld-shell"
        data-orientation={isPortrait ? 'portrait' : 'landscape'}
        className={
          isPortrait
            ? 'w-full max-w-[460px] h-full max-h-[860px] flex flex-col items-center justify-between gap-2 bg-[#23273a] border-4 border-[#3a415e] rounded-2xl p-2 shadow-[0_10px_0_#0b0d14]'
            : 'w-full max-w-[1040px] h-full max-h-[680px] flex flex-row items-center justify-between sm:justify-center gap-1 sm:gap-4 bg-[#23273a] border-4 border-[#3a415e] rounded-2xl p-1.5 sm:p-4 shadow-[0_10px_0_#0b0d14]'
        }
      >
        {isPortrait ? (
          <>
            {screenBezel}
            {showPad ? portraitControlsDeck : null}
          </>
        ) : (
          <>
            {showPad ? (buttonLayout.swapHands ? abxyWing : dpadWing) : null}
            {screenBezel}
            {showPad ? (buttonLayout.swapHands ? dpadWing : abxyWing) : null}
          </>
        )}
      </div>
    </div>
  );
};
