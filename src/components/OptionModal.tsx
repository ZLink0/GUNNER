import React from 'react';
import { gameAudio } from '../game/audio';
import { GameSettings, ScreenPalette, TouchMode } from '../game/types';

interface OptionModalProps {
  settings: GameSettings;
  onUpdate: (next: GameSettings) => void;
  onClose: () => void;
  onResetSave?: () => void;
}

export const OptionModal: React.FC<OptionModalProps> = ({
  settings,
  onUpdate,
  onClose,
  onResetSave,
}) => {
  const closeBtnRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    closeBtnRef.current?.focus({ preventScroll: true });
  }, []);

  const palettes: { id: ScreenPalette; label: string }[] = [
    { id: 'vivid', label: 'GBC Vivid' },
    { id: 'pocket', label: 'Pocket' },
    { id: 'lcd', label: 'LCD Grid' },
  ];

  const speeds: (0.85 | 1 | 1.2)[] = [0.85, 1, 1.2];
  const touchModes: { id: TouchMode; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'always', label: 'Show' },
    { id: 'hidden', label: 'Hide' },
  ];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#070a12]/90 p-3">
      <div
        role="dialog"
        aria-label="Game Options"
        className="w-full max-w-[360px] bg-[#111827] border-2 border-[#38bdf8] p-3 text-[#f8fafc] shadow-[0_4px_0_#000]"
      >
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-2.5">
          <h2 className="font-pixel-title text-[11px] text-[#facc15]">OPTION</h2>
          <button
            ref={closeBtnRef}
            type="button"
            data-back="true"
            onClick={() => {
              gameAudio.playMenuSelect();
              onClose();
            }}
            className="px-2 py-0.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[10px] cursor-pointer"
          >
            CLOSE
          </button>
        </div>

        <div className="space-y-2.5 text-[10px]">
          {/* Audio */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#cbd5e1]">Sound</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdate({ ...settings, muted: !settings.muted });
                }}
                className={`px-2 py-1 border text-[9px] cursor-pointer ${
                  settings.muted
                    ? 'bg-[#7f1d1d] border-[#ef4444] text-white'
                    : 'bg-[#14532d] border-[#22c55e] text-white'
                }`}
              >
                {settings.muted ? 'MUTED' : 'ON'}
              </button>
              <input
                aria-label="Sound Volume"
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.volume * 100)}
                onChange={(e) =>
                  onUpdate({ ...settings, volume: Number(e.target.value) / 100, muted: false })
                }
                className="w-20 accent-[#facc15]"
              />
            </div>
          </div>

          {/* Screen Palette */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#cbd5e1]">Screen</span>
            <div className="flex gap-1">
              {palettes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    gameAudio.playMenuMove();
                    onUpdate({ ...settings, palette: p.id });
                  }}
                  className={`px-2 py-1 border text-[9px] cursor-pointer ${
                    settings.palette === p.id
                      ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                      : 'bg-[#0f172a] border-[#334155] text-[#94a3b8]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Game Speed */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#cbd5e1]">Speed</span>
            <div className="flex gap-1">
              {speeds.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => {
                    gameAudio.playMenuMove();
                    onUpdate({ ...settings, gameSpeed: sp });
                  }}
                  className={`px-2 py-1 border text-[9px] tabular-nums cursor-pointer ${
                    settings.gameSpeed === sp
                      ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                      : 'bg-[#0f172a] border-[#334155] text-[#94a3b8]'
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>

          {/* Touch Controls */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#cbd5e1]">Pad UI</span>
            <div className="flex gap-1">
              {touchModes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    gameAudio.playMenuMove();
                    onUpdate({ ...settings, touchMode: m.id });
                  }}
                  className={`px-2 py-1 border text-[9px] cursor-pointer ${
                    settings.touchMode === m.id
                      ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                      : 'bg-[#0f172a] border-[#334155] text-[#94a3b8]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Summary */}
          <div className="border-t border-[#1e293b] pt-2 text-[9px] text-[#94a3b8] leading-relaxed">
            <div>Pad: A Attack/OK · B Jump/Back · X Shoot · Y Dash</div>
            <div>Key: WASD/Arrows · J/Z Atk · Space/C Jmp · K/X Gun · Shift/L Dash</div>
          </div>

          {onResetSave && (
            <div className="border-t border-[#1e293b] pt-2 flex justify-between items-center">
              <span className="text-[9px] text-[#94a3b8]">Save Data</span>
              <button
                type="button"
                onClick={onResetSave}
                className="px-2 py-1 bg-[#7f1d1d] hover:bg-[#991b1b] border border-[#ef4444] text-[9px] text-white cursor-pointer"
              >
                Reset Save
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
