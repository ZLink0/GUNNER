import { useCallback, useEffect, useRef, useState } from 'react';
import { HandheldShell, MenuNavAction } from './components/HandheldShell';
import { OptionModal } from './components/OptionModal';
import { RpgHub } from './components/RpgHub';
import { PauseModal, RunSummaryModal } from './components/StatusModals';
import { TitleScreen } from './components/TitleScreen';
import { gameAudio } from './game/audio';
import { GameEngine, HudSnapshot, VirtualButton } from './game/engine';
import {
  createDefaultSave,
  loadSaveState,
  loadSettings,
  persistSaveState,
  persistSettings,
} from './game/rpgLogic';
import { ExtractedUiIcons, loadAllSprites } from './game/spriteAtlas';
import { CANVAS_SIZE } from './game/stageGenerator';
import { GamePhase, GameSettings, HubTab, PlaySubMode, RunSummary, SaveState } from './game/types';

declare global {
  interface Window {
    __SWORD_GUN_HUD__?: HudSnapshot;
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedMenuElRef = useRef<HTMLElement | null>(null);

  const [existingSaveFound, setExistingSaveFound] = useState<boolean>(() => loadSaveState() !== null);
  const [save, setSave] = useState<SaveState>(() => loadSaveState() ?? createDefaultSave());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());

  const [phase, setPhase] = useState<GamePhase>('title');
  const [subMode, setSubMode] = useState<PlaySubMode>('hub');
  const [hubTab, setHubTab] = useState<HubTab>('world');
  const [activeStage, setActiveStage] = useState<number>(1);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [icons, setIcons] = useState<ExtractedUiIcons | null>(null);
  const [spritesReady, setSpritesReady] = useState<boolean>(false);

  const saveRef = useRef(save);
  saveRef.current = save;

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const subModeRef = useRef(subMode);
  subModeRef.current = subMode;
  const hubTabRef = useRef(hubTab);
  hubTabRef.current = hubTab;
  const showOptionsRef = useRef(showOptions);
  showOptionsRef.current = showOptions;

  const isStagePlaying = phase === 'playing' && subMode === 'stage' && !showOptions;

  // Sync document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  // Sync audio settings
  useEffect(() => {
    gameAudio.muted = settings.muted;
    gameAudio.volume = settings.volume;
    persistSettings(settings);
    engineRef.current?.syncSettings(settings);
  }, [settings]);

  const handleSaveUpdate = useCallback((next: SaveState) => {
    setSave(next);
    setExistingSaveFound(true);
    persistSaveState(next);
    engineRef.current?.syncSave(next);
  }, []);

  const enterStage = useCallback((stageNumber: number, customSave?: SaveState) => {
    const s = customSave ?? saveRef.current;
    (document.activeElement as HTMLElement | null)?.blur?.();
    setRunSummary(null);
    setActiveStage(stageNumber);
    setSubMode('stage');
    setPhase('playing');
    engineRef.current?.startStage(stageNumber, s);
    canvasRef.current?.focus();
  }, []);

  // Initialize PNG sprite sheets and 60fps Canvas Engine once
  useEffect(() => {
    let mounted = true;
    loadAllSprites().then(({ sprites, icons: loadedIcons }) => {
      if (!mounted || !canvasRef.current) return;
      setIcons(loadedIcons);
      setSpritesReady(true);

      const engine = new GameEngine(
        canvasRef.current,
        sprites,
        saveRef.current,
        settings,
        {
          onHudUpdate: (hud) => {
            window.__SWORD_GUN_HUD__ = hud;
          },
          onSaveUpdate: (next) => {
            setSave(next);
            setExistingSaveFound(true);
            persistSaveState(next);
          },
          onRunComplete: (summary) => {
            setRunSummary(summary);
            setPhase('gameover');
          },
        },
      );

      engineRef.current = engine;
      engine.enterTitlePreview();
      engine.startLoop();

      // ?autostart=1 jumps directly into Stage 1 active gameplay
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        const fresh = loadSaveState() ?? createDefaultSave();
        setSave(fresh);
        persistSaveState(fresh);
        setActiveStage(1);
        setSubMode('stage');
        setPhase('playing');
        engine.startStage(1, fresh);
      }
    });

    return () => {
      mounted = false;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // Mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // D-Pad + A (OK) + B (Back) spatial menu navigator
  const handleMenuNav = useCallback((action: MenuNavAction) => {
    if (action === 'back') {
      if (showOptionsRef.current) {
        gameAudio.playMenuSelect();
        setShowOptions(false);
        return;
      }
      if (phaseRef.current === 'paused') {
        gameAudio.playMenuSelect();
        engineRef.current?.setPaused(false);
        setPhase('playing');
        return;
      }
      if (phaseRef.current === 'gameover') {
        gameAudio.playMenuSelect();
        setRunSummary(null);
        engineRef.current?.enterTitlePreview();
        setSubMode('hub');
        setPhase('playing');
        return;
      }
      if (phaseRef.current === 'playing' && subModeRef.current === 'hub') {
        if (hubTabRef.current !== 'world') {
          gameAudio.playMenuMove();
          setHubTab('world');
        } else {
          gameAudio.playMenuSelect();
          engineRef.current?.enterTitlePreview();
          setPhase('title');
        }
        return;
      }
      return;
    }

    const container = screenRef.current;
    if (!container) return;

    const dialogs = Array.from(container.querySelectorAll<HTMLElement>('[role="dialog"]'));
    const activeRoot =
      dialogs.length > 0
        ? dialogs[dialogs.length - 1]
        : container.querySelector<HTMLElement>('[data-menu-root="true"]');

    if (!activeRoot) return;

    const controls = Array.from(
      activeRoot.querySelectorAll<HTMLElement>('button:not(:disabled), input[type="range"]:not(:disabled)'),
    ).filter((el) => el.offsetParent !== null);

    if (controls.length === 0) return;

    const activeEl = document.activeElement as HTMLElement | null;
    let currentIndex = activeEl ? controls.indexOf(activeEl) : -1;
    if (currentIndex === -1 && lastFocusedMenuElRef.current) {
      currentIndex = controls.indexOf(lastFocusedMenuElRef.current);
    }

    if (action === 'ok') {
      const target =
        currentIndex >= 0
          ? controls[currentIndex]
          : controls.find((el) => el.dataset.start === 'true') ?? controls[0];
      lastFocusedMenuElRef.current = target;
      target.focus({ preventScroll: true });
      if (target instanceof HTMLInputElement && target.type === 'range') {
        gameAudio.playMenuSelect();
      } else {
        target.click();
      }
      return;
    }

    // Directional move (up / down / left / right)
    if (currentIndex === -1) {
      const first = controls.find((el) => el.dataset.start === 'true') ?? controls[0];
      lastFocusedMenuElRef.current = first;
      first.focus({ preventScroll: false });
      first.scrollIntoView({ block: 'nearest' });
      gameAudio.playMenuMove();
      return;
    }

    const currentEl = controls[currentIndex];
    if (
      currentEl instanceof HTMLInputElement &&
      currentEl.type === 'range' &&
      (action === 'left' || action === 'right')
    ) {
      const delta = action === 'right' ? 0.1 : -0.1;
      setSettings((s) => ({
        ...s,
        volume: Math.max(0, Math.min(1, Math.round((s.volume + delta) * 10) / 10)),
        muted: false,
      }));
      gameAudio.playMenuMove();
      return;
    }

    const curRect = currentEl.getBoundingClientRect();
    const curX = curRect.left + curRect.width / 2;
    const curY = curRect.top + curRect.height / 2;

    let bestEl: HTMLElement | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const cand of controls) {
      if (cand === currentEl) continue;
      const r = cand.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const dx = x - curX;
      const dy = y - curY;

      let matchesDir = false;
      let primary = 0;
      let secondary = 0;

      if (action === 'right' && dx > 4) {
        matchesDir = true;
        primary = dx;
        secondary = Math.abs(dy);
      } else if (action === 'left' && dx < -4) {
        matchesDir = true;
        primary = -dx;
        secondary = Math.abs(dy);
      } else if (action === 'down' && dy > 4) {
        matchesDir = true;
        primary = dy;
        secondary = Math.abs(dx);
      } else if (action === 'up' && dy < -4) {
        matchesDir = true;
        primary = -dy;
        secondary = Math.abs(dx);
      }

      if (!matchesDir) continue;
      // Favor same row/column strongly so grid D-Pad feels natural
      const score = primary + secondary * 2.2;
      if (score < bestScore) {
        bestScore = score;
        bestEl = cand;
      }
    }

    if (!bestEl) {
      if (action === 'down' || action === 'right') {
        bestEl = controls[(currentIndex + 1) % controls.length];
      } else {
        bestEl = controls[(currentIndex - 1 + controls.length) % controls.length];
      }
    }

    lastFocusedMenuElRef.current = bestEl;
    bestEl.focus({ preventScroll: false });
    bestEl.scrollIntoView({ block: 'nearest' });
    gameAudio.playMenuMove();
  }, []);

  // Keyboard shortcuts: Stage Pause (Esc/P) + Menu D-Pad/A/B navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const stageActive =
        phaseRef.current === 'playing' &&
        subModeRef.current === 'stage' &&
        !showOptionsRef.current;

      if (stageActive) {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          engineRef.current?.setPaused(true);
          setPhase('paused');
        }
        return;
      }

      // Menu navigation via Keyboard (Arrows/WASD, Enter/Space = A OK, Esc/Backspace = B Back)
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        handleMenuNav('up');
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        handleMenuNav('down');
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        handleMenuNav('left');
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        handleMenuNav('right');
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        handleMenuNav('ok');
      } else if (e.code === 'Escape' || e.code === 'Backspace') {
        e.preventDefault();
        handleMenuNav('back');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleMenuNav]);

  const handleNewGame = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const fresh = createDefaultSave();
    handleSaveUpdate(fresh);
    setRunSummary(null);
    setHubTab('world');
    setSubMode('hub');
    setPhase('playing');
  }, [handleSaveUpdate]);

  const handleContinue = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const loaded = loadSaveState() ?? saveRef.current;
    handleSaveUpdate(loaded);
    setRunSummary(null);
    setHubTab('world');
    setSubMode('hub');
    setPhase('playing');
  }, [handleSaveUpdate]);

  const handleVirtualButton = useCallback((btn: VirtualButton, down: boolean) => {
    engineRef.current?.setVirtualButton(btn, down);
  }, []);

  const handleStartButton = useCallback(() => {
    if (showOptionsRef.current) {
      gameAudio.playMenuSelect();
      setShowOptions(false);
      return;
    }
    if (phaseRef.current === 'playing' && subModeRef.current === 'stage') {
      gameAudio.playMenuSelect();
      engineRef.current?.setPaused(true);
      setPhase('paused');
      return;
    }
    if (phaseRef.current === 'paused') {
      gameAudio.playMenuSelect();
      engineRef.current?.setPaused(false);
      setPhase('playing');
      return;
    }
    handleMenuNav('ok');
  }, [handleMenuNav]);

  const paletteFilterClass =
    settings.palette === 'pocket'
      ? 'grayscale contrast-125 sepia-[.25]'
      : settings.palette === 'lcd'
        ? 'contrast-110 saturate-90'
        : '';

  return (
    <HandheldShell
      touchMode={settings.touchMode}
      buttonLayout={settings.buttonLayout}
      isStagePlaying={isStagePlaying}
      onVirtualButton={handleVirtualButton}
      onGrappleAimPreview={(ang) => engineRef.current?.setGrappleAimPreview(ang)}
      onGrappleFire={(ang) => engineRef.current?.fireGrappleWithAngle(ang)}
      onMenuNav={handleMenuNav}
      onPause={() => {
        if (subMode === 'stage' && phase === 'playing') {
          engineRef.current?.setPaused(true);
          setPhase('paused');
        }
      }}
      onStart={handleStartButton}
    >
      {/* Persistent 1:1 GBC Pixel Canvas */}
      <div ref={screenRef} className={`w-full h-full relative ${paletteFilterClass}`}>
        <canvas
          ref={canvasRef}
          data-testid="game-canvas"
          tabIndex={0}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          onPointerMove={(e) => {
            if (!isStagePlaying) return;
            const rect = e.currentTarget.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            const nx = (e.clientX - rect.left) / rect.width;
            const ny = (e.clientY - rect.top) / rect.height;
            engineRef.current?.setPointerAim(nx, ny);
          }}
          onPointerLeave={() => {
            engineRef.current?.setPointerAim(null, null);
          }}
          className="w-full h-full block pixelated outline-none"
        />

        {/* Subtle LCD scanline grid when LCD Grid palette is selected */}
        {settings.palette === 'lcd' && (
          <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(to_right,rgba(0,0,0,0.4)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.4)_1px,transparent_1px)] bg-[length:4px_4px]" />
        )}

        {!spritesReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080c14] text-xs font-pixel-title text-[#38bdf8]">
            LOADING SPRITES...
          </div>
        )}

        {/* Title Screen */}
        {spritesReady && phase === 'title' && (
          <TitleScreen
            hasSave={existingSaveFound}
            onNewGame={handleNewGame}
            onContinue={handleContinue}
            onOpenOptions={() => setShowOptions(true)}
          />
        )}

        {/* 5-Menu RPG Hub */}
        {spritesReady && phase === 'playing' && subMode === 'hub' && (
          <RpgHub
            save={save}
            icons={icons}
            activeTab={hubTab}
            onChangeTab={setHubTab}
            onUpdateSave={handleSaveUpdate}
            onEnterStage={(stg) => enterStage(stg)}
            onReturnTitle={() => {
              engineRef.current?.enterTitlePreview();
              setPhase('title');
            }}
          />
        )}

        {/* Pause Modal */}
        {phase === 'paused' && (
          <PauseModal
            stage={activeStage}
            onResume={() => {
              engineRef.current?.setPaused(false);
              setPhase('playing');
            }}
            onOptions={() => setShowOptions(true)}
            onRestart={() => enterStage(activeStage)}
            onHub={() => {
              engineRef.current?.setPaused(false);
              engineRef.current?.enterTitlePreview();
              setSubMode('hub');
              setPhase('playing');
            }}
            onTitle={() => {
              engineRef.current?.setPaused(false);
              engineRef.current?.enterTitlePreview();
              setPhase('title');
            }}
          />
        )}

        {/* Victory / Game Over Modal */}
        {phase === 'gameover' && runSummary && (
          <RunSummaryModal
            summary={runSummary}
            onNextStage={(nextStg) => enterStage(nextStg)}
            onRetry={() => enterStage(activeStage)}
            onHub={() => {
              setRunSummary(null);
              engineRef.current?.enterTitlePreview();
              setSubMode('hub');
              setPhase('playing');
            }}
          />
        )}

        {/* Option Modal */}
        {showOptions && (
          <OptionModal
            settings={settings}
            onUpdate={setSettings}
            onClose={() => setShowOptions(false)}
            onResetSave={() => {
              const fresh = createDefaultSave();
              handleSaveUpdate(fresh);
              setExistingSaveFound(false);
              setShowOptions(false);
              engineRef.current?.enterTitlePreview();
              setPhase('title');
            }}
          />
        )}
      </div>
    </HandheldShell>
  );
}
