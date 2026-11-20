import React, { useEffect, useRef } from 'react';
import { gameAudio } from '../game/audio';

interface TitleScreenProps {
  hasSave: boolean;
  onNewGame: () => void;
  onContinue: () => void;
  onOpenOptions: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave,
  onNewGame,
  onContinue,
  onOpenOptions,
}) => {
  const startBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Focus primary NEW GAME action so D-Pad / Enter works immediately
    startBtnRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      data-menu-root="true"
      className="absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-5 pointer-events-none select-none"
    >
      {/* Top 40% Calm Sky Space: Bespoke Inline SVG Title Emblem */}
      <div className="flex flex-col items-center pt-2 sm:pt-3">
        <svg
          viewBox="0 0 220 74"
          className="w-[88%] max-w-[300px] drop-shadow-[0_3px_0_#090d16]"
          aria-label="Sword & Gun RPG"
        >
          {/* Retro GBC Crest Shield & Crossed Sword/Buster */}
          <g transform="translate(94, 0)">
            <rect x="8" y="2" width="16" height="16" fill="#0f172a" stroke="#facc15" strokeWidth="1.5" />
            <path d="M10 15 L22 4 M19 4 L22 4 L22 7" stroke="#38bdf8" strokeWidth="2" strokeLinecap="square" />
            <rect x="11" y="9" width="9" height="4" fill="#facc15" />
          </g>
          {/* Main Title Typography */}
          <text
            x="110"
            y="42"
            textAnchor="middle"
            fill="#facc15"
            stroke="#0f172a"
            strokeWidth="4"
            paintOrder="stroke fill"
            fontFamily="'Press Start 2P', monospace"
            fontSize="15"
            fontWeight="700"
          >
            SWORD &amp; GUN
          </text>
          <text
            x="110"
            y="62"
            textAnchor="middle"
            fill="#38bdf8"
            stroke="#0f172a"
            strokeWidth="3.5"
            paintOrder="stroke fill"
            fontFamily="'Press Start 2P', monospace"
            fontSize="11"
            fontWeight="700"
            letterSpacing="2"
          >
            ACTION RPG
          </text>
        </svg>
      </div>

      {/* Menu Actions (<= 3 primary buttons) */}
      <div className="flex flex-col items-center gap-2 pointer-events-auto">
        <button
          ref={startBtnRef}
          type="button"
          data-start="true"
          onClick={() => {
            gameAudio.playMenuSelect();
            onNewGame();
          }}
          className="w-48 sm:w-52 py-2 px-4 bg-[#1d4ed8] hover:bg-[#2563eb] active:translate-y-0.5 border-2 border-[#facc15] text-white font-pixel-title text-[11px] sm:text-xs tracking-wide shadow-[0_3px_0_#090d16] cursor-pointer whitespace-nowrap"
        >
          NEW GAME
        </button>

        <button
          type="button"
          disabled={!hasSave}
          onClick={() => {
            gameAudio.playMenuSelect();
            onContinue();
          }}
          className={`w-48 sm:w-52 py-1.5 px-4 border-2 font-pixel-title text-[10px] sm:text-[11px] tracking-wide shadow-[0_3px_0_#090d16] whitespace-nowrap ${
            hasSave
              ? 'bg-[#0f172a]/90 hover:bg-[#1e293b] border-[#38bdf8] text-[#e2e8f0] cursor-pointer'
              : 'bg-[#0f172a]/60 border-[#334155] text-[#64748b] cursor-not-allowed'
          }`}
        >
          CONTINUE
        </button>

        <button
          type="button"
          onClick={() => {
            gameAudio.playMenuSelect();
            onOpenOptions();
          }}
          className="w-48 sm:w-52 py-1.5 px-4 bg-[#0f172a]/90 hover:bg-[#1e293b] border-2 border-[#475569] text-[#cbd5e1] font-pixel-title text-[10px] sm:text-[11px] tracking-wide shadow-[0_3px_0_#090d16] cursor-pointer whitespace-nowrap"
        >
          OPTION
        </button>

        <p className="mt-1 font-pixel-title text-[9px] text-[#fde047] tracking-widest animate-pulse drop-shadow-[0_1px_0_#000]">
          PRESS START
        </p>
      </div>

      {/* Flat bottom control hint line */}
      <div className="text-center text-[8px] sm:text-[9px] text-[#e2e8f0] bg-[#090d16]/75 px-2 py-1 rounded border border-[#1e293b]">
        Hold A/X: Charge Skill · Y+Back: Dodge · R: 360° Hook · L: Block · Q: Balik
      </div>
    </div>
  );
};
