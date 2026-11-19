// Solmar Heat — all sound is synthesised with WebAudio.
// No audio files, no network: engine hum, sirens, gunfire, impacts and a
// laid-back coastal groove are built from oscillators and filtered noise.
// Everything is lazy (no AudioContext until the first user gesture) and
// every call is safe before that point.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  _osc(type, freq, gainValue, dur, when) {
    if (!this.ctx) return;
    const t = when || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gainValue, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _noise(dur, filterFreq, gainValue) {
    if (!this.ctx) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  click() {
    this._osc('square', 660, 0.12, 0.06);
  }

  pickup() {
    if (!this.ctx) return;
    this._osc('sine', 880, 0.2, 0.1);
    this._osc('sine', 1318, 0.2, 0.16, this.ctx.currentTime + 0.08);
  }

  punch() {
    this._noise(0.09, 500, 0.35);
  }

  shot() {
    this._noise(0.14, 2600, 0.5);
    this._osc('square', 160, 0.25, 0.08);
  }

  crash() {
    this._noise(0.35, 900, 0.6);
    this._osc('sine', 70, 0.4, 0.25);
  }

  horn() {
    this._osc('square', 370, 0.16, 0.22);
    this._osc('square', 466, 0.12, 0.22);
  }

  // Win sting: a rising major arpeggio. Lose sting: two low notes.
  sting(win) {
    if (!this.ctx) return;
    const notes = win ? [523, 659, 784, 1046] : [220, 174];
    notes.forEach((f, i) => {
      this._osc('triangle', f, 0.22, 0.35, this.ctx.currentTime + i * 0.11);
    });
  }

  // A continuous engine voice whose pitch follows speed 0..1.
  engine(on, speed01) {
    if (!this.ctx) return;
    if (!on) {
      if (this.engineOsc) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 700;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.06);
    this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06, this.ctx.currentTime, 0.1);
  }

  // A two-tone police siren that starts and stops with the chase.
  siren(on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenOsc) {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 800;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.8;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    }
    this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.15);
  }

  // The coastal groove: a slow Am–F–C–G walk. A step every 240 ms plays
  // a bass note, a soft pad chord tone and a ticking hat.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [
      [110, 220, 261.6, 329.6],
      [87.3, 174.6, 220, 261.6],
      [130.8, 196, 261.6, 329.6],
      [98, 196, 246.9, 293.7],
    ];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const chord = chords[Math.floor(this.musicStep / 8) % chords.length];
      const bass = chord[0];
      this._osc('sine', bass, 0.16, 0.5);
      if (this.musicStep % 2 === 0) {
        this._osc('triangle', chord[2], 0.05, 0.45);
        this._osc('triangle', chord[3], 0.04, 0.45);
      }
      if (this.musicStep % 4 === 2) this._noise(0.03, 6000, 0.05);
      this.musicStep += 1;
    }, 240);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
