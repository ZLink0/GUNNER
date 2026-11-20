class ChiptuneAudio {
  private ctx: AudioContext | null = null;
  public muted = false;
  public volume = 0.65;

  private ensureCtx(): AudioContext | null {
    if (this.muted || this.volume <= 0.01) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    type: OscillatorType,
    freqStart: number,
    freqEnd: number,
    duration: number,
    gainScale = 0.14,
    delay = 0,
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const jitter = 1 + (Math.random() * 0.1 - 0.05);
    osc.frequency.setValueAtTime(Math.max(40, freqStart * jitter), t);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd * jitter), t + duration);
    }
    const peak = Math.max(0.001, gainScale * this.volume);
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  playJump() {
    this.tone('square', 240, 560, 0.11, 0.11);
  }

  playLand() {
    this.tone('triangle', 140, 65, 0.07, 0.11);
  }

  playDash() {
    this.tone('sawtooth', 420, 170, 0.12, 0.10);
  }

  playSword(comboStep = 1, isHeavy = false) {
    const base = comboStep === 3 || isHeavy ? 620 : comboStep === 2 ? 540 : 480;
    this.tone('square', base, 140, isHeavy ? 0.15 : 0.09, 0.12);
    if (isHeavy) {
      this.tone('triangle', 220, 90, 0.16, 0.14);
    }
  }

  playShoot() {
    this.tone('square', 780, 260, 0.09, 0.11);
  }

  playNoAmmo() {
    this.tone('triangle', 160, 110, 0.06, 0.10);
  }

  playHit(isCrit = false) {
    if (isCrit) {
      this.tone('square', 920, 320, 0.12, 0.15);
      this.tone('triangle', 480, 190, 0.14, 0.15, 0.02);
    } else {
      this.tone('square', 340, 130, 0.08, 0.11);
    }
  }

  playExplosion() {
    this.tone('sawtooth', 160, 48, 0.19, 0.15);
    this.tone('triangle', 110, 42, 0.21, 0.14, 0.02);
  }

  playHurt() {
    this.tone('sawtooth', 260, 85, 0.18, 0.16);
  }

  playPickup(isRare = false) {
    if (isRare) {
      this.tone('square', 523, 659, 0.08, 0.12, 0);
      this.tone('square', 659, 1046, 0.14, 0.12, 0.07);
    } else {
      this.tone('square', 580, 880, 0.08, 0.10);
    }
  }

  playPotion() {
    this.tone('triangle', 392, 587, 0.10, 0.13, 0);
    this.tone('triangle', 587, 784, 0.15, 0.13, 0.08);
  }

  playMenuMove() {
    this.tone('square', 440, 520, 0.04, 0.07);
  }

  playMenuSelect() {
    this.tone('square', 520, 780, 0.07, 0.09);
  }

  playBossTelegraph() {
    this.tone('sawtooth', 220, 440, 0.24, 0.12);
  }

  playVictory() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, idx) => {
      this.tone('square', n, n, 0.14, 0.12, idx * 0.1);
    });
  }

  playGameOver() {
    const notes = [392, 349, 311, 261];
    notes.forEach((n, idx) => {
      this.tone('triangle', n, n * 0.94, 0.18, 0.14, idx * 0.14);
    });
  }
}

export const gameAudio = new ChiptuneAudio();
