export class Sfx {
  private ctx: AudioContext | null = null;

  ensureContext(): void {
    if (typeof window === "undefined") {
      return;
    }
    if (!this.ctx) {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) {
        this.ctx = new AudioCtor();
      }
    }
    void this.ctx?.resume();
  }

  play(type: "success" | "coin" | "alert" | "start"): void {
    this.ensureContext();
    if (!this.ctx) {
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    const presets = {
      start: { freq: [392, 523], duration: 0.12, volume: 0.06 },
      success: { freq: [523, 659], duration: 0.14, volume: 0.08 },
      coin: { freq: [784, 988], duration: 0.1, volume: 0.07 },
      alert: { freq: [240, 180], duration: 0.18, volume: 0.05 },
    }[type];

    osc.type = "triangle";
    osc.frequency.setValueAtTime(presets.freq[0], now);
    osc.frequency.linearRampToValueAtTime(presets.freq[1], now + presets.duration);
    gain.gain.setValueAtTime(presets.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + presets.duration);
    osc.start(now);
    osc.stop(now + presets.duration);
  }
}
