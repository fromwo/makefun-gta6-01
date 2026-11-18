// audio.js — all music and sound effects synthesized with WebAudio. No audio files.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.musicGain = null; this.sfxGain = null;
    this.muted = false; this.started = false;
    this.step = 0; this.nextStepTime = 0; this.tempo = 112;
    this.sirenOsc = null; this.sirenGain = null; this.engineOsc = null; this.engineGain = null;
    // A-minor sunset groove: bass roots + sparkle chords, 16 steps a bar.
    this.bassLine = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 65.41, 0];
    this.chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 220, 261.63]];
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.32; this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
      this.started = true; this.nextStepTime = this.ctx.currentTime + 0.1;
      this.startEngineHum(); this.startSiren();
    } catch { this.ctx = null; }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
  tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, filterFreq, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t);
  }
  shoot() { this.noise(0.14, 0.5, 2400); this.tone(190, 0.1, 'square', 0.25, 0, 60); }
  hit() { this.tone(120, 0.12, 'sawtooth', 0.3, 0, 50); }
  crash() { this.noise(0.35, 0.6, 700); this.tone(70, 0.3, 'sine', 0.4, 0, 35); }
  pickup() { this.tone(660, 0.09, 'sine', 0.3); this.tone(880, 0.14, 'sine', 0.3, 0.09); }
  cash() { this.tone(988, 0.08, 'triangle', 0.3); this.tone(1319, 0.12, 'triangle', 0.3, 0.08); this.tone(1568, 0.18, 'triangle', 0.3, 0.16); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.32, i * 0.11)); }
  wantedUp() { this.tone(440, 0.15, 'square', 0.22, 0, 330); this.tone(330, 0.2, 'square', 0.22, 0.15, 220); }
  busted() { this.tone(220, 0.5, 'sawtooth', 0.3, 0, 110); }
  door() { this.tone(300, 0.07, 'square', 0.18, 0, 180); }
  horn() { this.tone(370, 0.18, 'square', 0.2); this.tone(466, 0.18, 'square', 0.15); }
  startEngineHum() {
    if (!this.ctx) return;
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 40;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  setEngine(speedRatio) {
    if (!this.engineOsc) return;
    this.engineOsc.frequency.value = 38 + speedRatio * 90;
    this.engineGain.gain.value = this.muted ? 0 : speedRatio * 0.05;
  }
  startSiren() {
    if (!this.ctx) return;
    this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'sine'; this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }
  setSiren(on, time) {
    if (!this.sirenOsc) return;
    const target = on && !this.muted ? 0.045 : 0;
    this.sirenGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
    if (on) this.sirenOsc.frequency.value = 650 + Math.sin(time * 4) * 220;
  }
  // Called every frame: schedules the 16-step groove slightly ahead of time.
  updateMusic() {
    if (!this.ctx || this.muted) return;
    const stepDur = 60 / this.tempo / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      const s = this.step % 16; const t = this.nextStepTime - this.ctx.currentTime;
      const bass = this.bassLine[s];
      if (bass) this.musicTone(bass, stepDur * 1.8, 'triangle', 0.5, t);
      if (s % 4 === 0) {
        const chord = this.chords[(this.step >> 4) % 4];
        for (const f of chord) this.musicTone(f, stepDur * 3.5, 'sine', 0.12, t);
      }
      if (s % 2 === 0) this.musicNoise(0.03, s % 4 === 2 ? 0.16 : 0.07, 6000, t);
      if (s === 0 || s === 8) this.musicTone(110, 0.1, 'sine', 0.35, t);
      this.step++; this.nextStepTime += stepDur;
    }
  }
  musicTone(freq, dur, type, vol, when) {
    const t = this.ctx.currentTime + Math.max(0, when);
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + dur + 0.05);
  }
  musicNoise(dur, vol, freq, when) {
    const t = this.ctx.currentTime + Math.max(0, when);
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.musicGain); src.start(t);
  }
}
