// Moonvault — audio.js
// Every sound is synthesized with WebAudio: no audio files, no network.
// Footsteps are panned and faded by distance from the player so you can hear
// where a guard is; the rest are short one-shot phrases.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.muted = false;
  }

  // Browsers only allow audio after a user gesture; call from the first key
  // press or click. Safe to call repeatedly.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
    } catch (err) {
      this.ctx = null;
    }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // A very quiet low pad with a slow swell, so the night has a hum.
  startAmbient() {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    const oscA = ctx.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 55;
    const oscB = ctx.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = 82.4;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(this.master);
    oscA.start();
    oscB.start();
    lfo.start();
    this.ambient = { oscA, oscB, lfo, gain };
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // A short filtered-noise thud. `pan` is -1 (left) to 1 (right), `volume`
  // 0..1 fades with distance.
  footstep(pan, volume) {
    if (!this.ready || volume <= 0.02) return;
    const ctx = this.ctx;
    const dur = 0.09;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.5;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    src.start();
  }

  // A soft two-note chime for loot.
  pickup() {
    if (!this.ready) return;
    this.tone(880, 0.12, 'sine', 0.16);
    setTimeout(() => this.tone(1318, 0.18, 'sine', 0.14), 70);
  }

  // A bright rising arpeggio for the Moonstone.
  gem() {
    if (!this.ready) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.22, 'triangle', 0.2), i * 80);
    });
  }

  // Airy whoosh for a close call.
  whoosh() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const dur = 0.35;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  // Two-tone brass alarm for the Watch-Eye.
  alarm() {
    if (!this.ready) return;
    this.tone(466, 0.28, 'square', 0.12);
    setTimeout(() => this.tone(349, 0.34, 'square', 0.12), 300);
  }

  // A low dissonant sting for being caught.
  caught() {
    if (!this.ready) return;
    this.tone(220, 0.5, 'sawtooth', 0.18);
    setTimeout(() => this.tone(233, 0.6, 'sawtooth', 0.18), 90);
  }

  // A warm rising arpeggio for winning the night.
  win() {
    if (!this.ready) return;
    [392, 523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.3, 'triangle', 0.18), i * 110);
    });
  }

  // A soft click for menus.
  click() {
    if (!this.ready) return;
    this.tone(660, 0.06, 'sine', 0.1);
  }

  tone(freq, dur, type, volume) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }
}
