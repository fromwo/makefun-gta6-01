// Solmar Heat — every sound is synthesized with WebAudio.
// No audio files, no network: oscillators and filtered noise, plus a small
// bass-and-pad loop that plays while the player drives around the city.

const NOTE = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0,
  C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88, D4: 293.66,
};

// A slow sunset-drive bass line (A minor) with a soft pad on top.
const BASS_LINE = [NOTE.A2, NOTE.A2, NOTE.F2, NOTE.G2, NOTE.A2, NOTE.C3, NOTE.E3, NOTE.G2];
const PAD_CHORDS = [
  [NOTE.A3, NOTE.C4, NOTE.E4],
  [NOTE.F3, NOTE.A3, NOTE.C4],
  [NOTE.C3, NOTE.E3, NOTE.G3],
  [NOTE.G3, NOTE.B4, NOTE.D4],
];

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicStep = 0;
    this.musicTimer = 0;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
      this._startEngine();
      this._startSiren();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.value = muted ? 0 : 0.5;
    }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  _startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  /** Engine hum follows the driven car's speed; call every frame. */
  engine(speed, driving) {
    if (!this.ctx || !this.engineGain) return;
    const target = driving ? 0.015 + Math.min(0.05, Math.abs(speed) * 0.00012) : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + Math.abs(speed) * 0.22, this.ctx.currentTime, 0.1);
  }

  /** Two-tone siren that wails while any police are close. */
  siren(active, time) {
    if (!this.ctx || !this.sirenGain) return;
    if (!active) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    const wave = Math.sin(time * 2.4) > 0 ? 715 : 540;
    this.sirenOsc.frequency.setTargetAtTime(wave, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.2);
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + dur + 0.02);
    } catch {
      // Sound is garnish; a failed blip never breaks the game.
    }
  }

  noise(dur, vol, cutoff) {
    if (!this.ctx || this.muted) return;
    try {
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff || 1200;
      const gain = this.ctx.createGain();
      gain.gain.value = vol || 0.25;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start();
    } catch {
      // See tone(): sound never breaks the game.
    }
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'shoot': this.noise(0.09, 0.3, 3200); this.tone(190, 0.08, 'square', 0.12, 60); break;
      case 'punch': this.noise(0.07, 0.22, 900); break;
      case 'hit': this.tone(120, 0.12, 'sawtooth', 0.2, 70); break;
      case 'crash': this.noise(0.28, 0.4, 700); this.tone(90, 0.25, 'sawtooth', 0.18, 40); break;
      case 'pickup': this.tone(660, 0.1, 'sine', 0.2); this.tone(990, 0.14, 'sine', 0.2); break;
      case 'cash': this.tone(880, 0.09, 'triangle', 0.2); this.tone(1174, 0.12, 'triangle', 0.2); break;
      case 'horn': this.tone(370, 0.22, 'square', 0.12); this.tone(466, 0.22, 'square', 0.1); break;
      case 'door': this.tone(220, 0.08, 'triangle', 0.15, 160); break;
      case 'mission': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.2), i * 90)); break;
      case 'fail': [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'sawtooth', 0.12), i * 120)); break;
      case 'busted': this.tone(440, 0.4, 'sawtooth', 0.16, 220); break;
      case 'wasted': this.tone(220, 0.6, 'sawtooth', 0.18, 55); break;
      default: break;
    }
  }

  /** Advance the music loop; call every frame with the frame time. */
  update(dt) {
    if (!this.ctx || !this.musicOn || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.42;
    const step = this.musicStep % 8;
    const bass = BASS_LINE[step];
    this.tone(bass, 0.38, 'triangle', 0.085);
    if (step % 4 === 0) {
      const chord = PAD_CHORDS[(this.musicStep / 4 | 0) % PAD_CHORDS.length];
      for (const note of chord) this.tone(note, 1.5, 'sine', 0.028);
    }
    if (step === 2 || step === 6) this.tone(bass * 2, 0.2, 'sine', 0.04);
    this.musicStep += 1;
  }
}
