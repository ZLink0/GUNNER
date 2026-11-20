import React from 'react';
import { gameAudio } from '../game/audio';
import { createDefaultButtonLayout } from '../game/rpgLogic';
import { ButtonLayoutConfig, GameSettings, ScreenPalette, TouchMode } from '../game/types';

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

  const layout = settings.buttonLayout;

  const updateLayout = (patch: Partial<ButtonLayoutConfig>) => {
    gameAudio.playMenuMove();
    onUpdate({
      ...settings,
      buttonLayout: { ...layout, ...patch },
    });
  };

  const applyPreset = (preset: ButtonLayoutConfig['preset']) => {
    if (preset === 'compact') {
      updateLayout({ preset, buttonScale: 0.85, gapSize: 'tight', verticalAlign: 'bottom' });
    } else if (preset === 'wide') {
      updateLayout({ preset, buttonScale: 1.15, gapSize: 'wide', verticalAlign: 'center' });
    } else {
      updateLayout({ preset, buttonScale: 1, gapSize: 'normal', verticalAlign: 'center' });
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#070a12]/90 p-2 sm:p-3">
      <div
        role="dialog"
        aria-label="Game Options"
        className="w-full max-w-[360px] max-h-[94%] overflow-y-auto gbc-scroll bg-[#111827] border-2 border-[#38bdf8] p-2.5 sm:p-3 text-[#f8fafc] shadow-[0_4px_0_#000]"
      >
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-1.5 mb-2">
          <h2 className="font-pixel-title text-[10px] text-[#facc15]">OPTION</h2>
          <button
            ref={closeBtnRef}
            type="button"
            data-back="true"
            onClick={() => {
              gameAudio.playMenuSelect();
              onClose();
            }}
            className="px-2 py-0.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[9px] cursor-pointer"
          >
            CLOSE
          </button>
        </div>

        <div className="space-y-2 text-[9px]">
          {/* Audio */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#cbd5e1]">Sound</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdate({ ...settings, muted: !settings.muted })}
                className={`px-2 py-0.5 border text-[8px] cursor-pointer ${
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
                  className={`px-1.5 py-0.5 border text-[8px] cursor-pointer ${
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
                  className={`px-1.5 py-0.5 border text-[8px] tabular-nums cursor-pointer ${
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
                  className={`px-1.5 py-0.5 border text-[8px] cursor-pointer ${
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

          {/* Custom Button Layout Section ("kostum tata letak tombol") */}
          <div className="border-t border-[#1e293b] pt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#facc15] font-bold">Tata Letak Tombol</span>
              <button
                type="button"
                onClick={() => {
                  gameAudio.playMenuSelect();
                  onUpdate({ ...settings, buttonLayout: createDefaultButtonLayout() });
                }}
                className="px-1.5 py-0.5 bg-[#1e293b] hover:bg-[#334155] border border-[#475569] text-[7px] text-[#cbd5e1] cursor-pointer"
              >
                Reset Layout
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#94a3b8]">Preset</span>
              <div className="flex gap-1">
                {(['standard', 'compact', 'wide'] as const).map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => applyPreset(pr)}
                    className={`px-1.5 py-0.5 border text-[8px] capitalize cursor-pointer ${
                      layout.preset === pr
                        ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                        : 'bg-[#0f172a] border-[#334155] text-[#94a3b8]'
                    }`}
                  >
                    {pr}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#94a3b8]">Posisi Tangan</span>
              <button
                type="button"
                data-testid="swap-hands-btn"
                onClick={() => updateLayout({ swapHands: !layout.swapHands })}
                className={`px-2 py-0.5 border text-[8px] cursor-pointer ${
                  layout.swapHands
                    ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                    : 'bg-[#0f172a] border-[#334155] text-[#cbd5e1]'
                }`}
              >
                {layout.swapHands ? 'Tukar (L:ABXY · R:D-Pad)' : 'Normal (L:D-Pad · R:ABXY)'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#94a3b8]">Ukuran</span>
              <div className="flex gap-1">
                {([0.85, 1, 1.15] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => updateLayout({ buttonScale: sc })}
                    className={`px-1.5 py-0.5 border text-[8px] cursor-pointer ${
                      layout.buttonScale === sc
                        ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                        : 'bg-[#0f172a] border-[#334155] text-[#94a3b8]'
                    }`}
                  >
                    {sc === 0.85 ? 'Kecil' : sc === 1 ? 'Sedang' : 'Besar'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#94a3b8]">Vertikal</span>
              <div className="flex gap-1">
                {(['top', 'center', 'bottom'] as const).map((va) => (
                  <button
                    key={va}
                    type="button"
                    onClick={() => updateLayout({ verticalAlign: va })}
                    className={`px-1.5 py-0.5 border text-[8px] capitalize cursor-pointer ${
                      layout.verticalAlign === va
                        ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                        : 'bg-[#0f172a] border-[#334155] text-[#94a3b8]'
                    }`}
                  >
                    {va}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[#94a3b8]">Jarak</span>
              <div className="flex gap-1">
                {(['tight', 'normal', 'wide'] as const).map((gp) => (
                  <button
                    key={gp}
                    type="button"
                    onClick={() => updateLayout({ gapSize: gp })}
                    className={`px-1.5 py-0.5 border text-[8px] capitalize cursor-pointer ${
                      layout.gapSize === gp
                        ? 'bg-[#1d4ed8] border-[#facc15] text-white'
                        : 'bg-[#0f172a] border-[#334155] text-[#94a3b8]'
                    }`}
                  >
                    {gp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Controls Summary */}
          <div className="border-t border-[#1e293b] pt-1.5 text-[8px] text-[#94a3b8] leading-relaxed">
            <div>Hold A: Charge Slash (30% Stun) · Hold X: Charge Shot (+DMG/+4 Blk)</div>
            <div>Y+Back: Backstep Dodge · R (360°): Hook/Tarik Musuh · L: Block</div>
          </div>

          {onResetSave && (
            <div className="border-t border-[#1e293b] pt-1.5 flex justify-between items-center">
              <span className="text-[8px] text-[#94a3b8]">Save Data</span>
              <button
                type="button"
                onClick={onResetSave}
                className="px-2 py-0.5 bg-[#7f1d1d] hover:bg-[#991b1b] border border-[#ef4444] text-[8px] text-white cursor-pointer"
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
