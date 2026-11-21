// Solmar Heat — synthesized sound, no audio files.
// Everything is built from WebAudio oscillators and filtered noise, so the
// game ships zero sound assets and makes zero network requests.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.master = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }

  noise(dur, vol = 0.3, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shoot(kind) {
    if (kind === 'smg') { this.noise(0.09, 0.25, 2600); this.blip(180, 0.06, 'square', 0.12); }
    else if (kind === 'pistol') { this.noise(0.16, 0.4, 1800); this.blip(120, 0.1, 'square', 0.18); }
    else { this.noise(0.07, 0.2, 900); }
  }

  pickup() { this.blip(880, 0.09, 'sine', 0.22); setTimeout(() => this.blip(1320, 0.12, 'sine', 0.2), 70); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.22), i * 110)); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'triangle', 0.22), i * 120)); }
  missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'sawtooth', 0.14), i * 130)); }
  crash() { this.noise(0.3, 0.45, 700); }
  busted() { [440, 415, 392].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.16), i * 160)); }
  steal() { this.blip(220, 0.12, 'square', 0.15); setTimeout(() => this.blip(330, 0.14, 'square', 0.15), 100); }

  // Engine hum follows the driven car's speed; call every frame while driving.
  engine(speedRatio) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      this.engineOsc.connect(f);
      f.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = this.muted ? 0 : 0.05 + speedRatio * 0.09;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, this.ctx.currentTime, 0.08);
  }

  engineOff() {
    if (this.engineGain && this.ctx) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }

  // Two-tone police siren while any wanted heat is active.
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOn) {
      this.sirenOn = true;
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = this.muted ? 0 : 0.05;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let hi = true;
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc) return;
        hi = !hi;
        this.sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, this.ctx.currentTime, 0.05);
      }, 380);
    } else if (!on && this.sirenOn) {
      this.sirenOn = false;
      if (this.sirenTimer) clearInterval(this.sirenTimer);
      const osc = this.sirenOsc;
      const gain = this.sirenGain;
      this.sirenOsc = null;
      this.sirenGain = null;
      if (gain) gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      if (osc) setTimeout(() => { try { osc.stop(); } catch (e) { /* already stopped */ } }, 400);
    }
  }
}
